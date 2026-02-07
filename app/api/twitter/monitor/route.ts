import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * X自動監視API
 * POST /api/twitter/monitor
 * Vercel Cronから毎時呼び出される
 * 
 * フロー:
 * 1. 休止時間チェック（店舗ごとのカスタム設定）
 * 2. 監視ON店舗のツイート取得
 * 3. 重複・固定ツイート除外
 * 4. Gemini AIで買取表か判別
 * 5. 買取表→保留に追加→バックグラウンドAI解析
 */
export async function POST(request: NextRequest) {
    const startTime = Date.now()

    try {
        // 現在のJST時刻
        const now = new Date()
        const jstHour = (now.getUTCHours() + 9) % 24

        // 監視対象の店舗を取得
        const { data: settings, error: settingsError } = await supabase
            .from('shop_monitor_settings')
            .select(`
                *,
                shop:shop_id(id, name, x_account)
            `)
            .eq('is_active', true)

        if (settingsError) {
            throw new Error(`Failed to fetch settings: ${settingsError.message}`)
        }

        const results = {
            total_shops: settings?.length || 0,
            processed: 0,
            skipped_quiet: 0,
            new_tweets: 0,
            pinned_skipped: 0,
            purchase_lists_found: 0,
            added_to_pending: 0,
            errors: [] as string[]
        }

        // ベースURL
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
            || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

        // 各店舗のツイートをチェック
        for (const setting of settings || []) {
            const shop = setting.shop
            if (!shop?.x_account) {
                results.errors.push(`Shop ${shop?.name || setting.shop_id} has no x_account`)
                continue
            }

            // 店舗ごとの休止時間チェック
            const quietStart = setting.quiet_start ?? 2
            const quietEnd = setting.quiet_end ?? 9
            if (isQuietHour(jstHour, quietStart, quietEnd)) {
                results.skipped_quiet++
                continue
            }

            try {
                // ツイート取得
                const tweetsRes = await fetch(`${baseUrl}/api/twitter?username=${shop.x_account}`)
                const tweetsData = await tweetsRes.json()

                if (!tweetsData.success) {
                    results.errors.push(`Failed to fetch tweets for ${shop.name}: ${tweetsData.error || 'Unknown error'}`)
                    continue
                }

                const pinnedTweetId = tweetsData.user?.pinnedTweetId

                // 各ツイートを処理
                for (const tweet of tweetsData.tweets || []) {
                    // 固定ツイートチェック
                    if (pinnedTweetId && tweet.id === pinnedTweetId) {
                        results.pinned_skipped++
                        // 記録だけして続行
                        await supabase.from('fetched_tweets').upsert({
                            tweet_id: tweet.id,
                            shop_id: shop.id,
                            is_purchase_related: false,
                            is_pinned: true
                        }, { onConflict: 'tweet_id,shop_id' })
                        continue
                    }

                    // 重複チェック
                    const { data: existing } = await supabase
                        .from('fetched_tweets')
                        .select('id')
                        .eq('tweet_id', tweet.id)
                        .eq('shop_id', shop.id)
                        .single()

                    if (existing) {
                        continue // 既に取得済み
                    }

                    results.new_tweets++

                    // 画像なしツイート
                    if (!tweet.images || tweet.images.length === 0) {
                        await supabase.from('fetched_tweets').insert({
                            tweet_id: tweet.id,
                            shop_id: shop.id,
                            is_purchase_related: false,
                            is_pinned: false
                        })
                        continue
                    }

                    // Geminiで買取表かどうか判別
                    let isPurchaseList = false
                    try {
                        const classifyRes = await fetch(`${baseUrl}/api/gemini/classify`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                imageUrl: tweet.images[0],
                                tweetText: tweet.text
                            })
                        })
                        const classifyData = await classifyRes.json()
                        isPurchaseList = classifyData.is_purchase_list && (classifyData.confidence || 0) >= 70

                        if (isPurchaseList) {
                            results.purchase_lists_found++
                        }
                    } catch (classifyErr: any) {
                        console.error(`Classify error for tweet ${tweet.id}:`, classifyErr)
                    }

                    // 買取表なら保留に追加
                    if (isPurchaseList) {
                        for (const imageUrl of tweet.images) {
                            const { data: pendingImage, error: pendingError } = await supabase
                                .from('pending_images')
                                .insert({
                                    shop_id: shop.id,
                                    image_url: imageUrl,
                                    tweet_url: `https://x.com/${shop.x_account}/status/${tweet.id}`,
                                    tweet_time: tweet.created_at,
                                    status: 'pending'
                                })
                                .select()
                                .single()

                            if (!pendingError && pendingImage) {
                                results.added_to_pending++

                                // バックグラウンドでAI解析
                                fetch(`${baseUrl}/api/pending-images/analyze`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ pendingImageId: pendingImage.id })
                                }).catch(err => console.error('Background analysis error:', err))
                            }
                        }
                    }

                    // 取得済みツイートとして記録
                    await supabase.from('fetched_tweets').insert({
                        tweet_id: tweet.id,
                        shop_id: shop.id,
                        is_purchase_related: isPurchaseList,
                        is_pinned: false
                    })
                }

                // 最終チェック時刻を更新
                await supabase
                    .from('shop_monitor_settings')
                    .update({
                        last_checked_at: new Date().toISOString(),
                        last_tweet_id: tweetsData.tweets?.[0]?.id,
                        updated_at: new Date().toISOString()
                    })
                    .eq('shop_id', shop.id)

                results.processed++

            } catch (shopErr: any) {
                results.errors.push(`Error processing ${shop.name}: ${shopErr.message}`)
            }
        }

        return NextResponse.json({
            success: true,
            duration_ms: Date.now() - startTime,
            current_jst_hour: jstHour,
            results
        })

    } catch (error: any) {
        console.error('Monitor error:', error)
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}

// Vercel Cronからの呼び出し用
export async function GET(request: NextRequest) {
    return POST(request)
}

/**
 * 休止時間判定
 * 例: quietStart=2, quietEnd=9 → 2時〜9時は休止
 */
function isQuietHour(currentHour: number, quietStart: number, quietEnd: number): boolean {
    if (quietStart <= quietEnd) {
        return currentHour >= quietStart && currentHour < quietEnd
    }
    // 日をまたぐ場合（例: 23時〜6時）
    return currentHour >= quietStart || currentHour < quietEnd
}
