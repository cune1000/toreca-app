import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

/**
 * X自動監視API
 * POST /api/twitter/monitor
 * Vercel Cronから毎時呼び出される
 */
export async function POST(request: NextRequest) {
    const startTime = Date.now()

    try {
        // 1. 時刻チェック（深夜2時〜朝9時は停止）JST
        const now = new Date()
        const jstHour = (now.getUTCHours() + 9) % 24
        if (jstHour >= 2 && jstHour < 9) {
            return NextResponse.json({
                success: true,
                message: 'Monitoring paused during 2:00-9:00 JST',
                skipped: true,
                current_jst_hour: jstHour
            })
        }

        // 2. 監視対象の店舗を取得
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
            new_tweets: 0,
            purchase_lists_found: 0,
            added_to_pending: 0,
            errors: [] as string[]
        }

        // ベースURLを取得
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
            || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

        // 3. 各店舗のツイートをチェック
        for (const setting of settings || []) {
            const shop = setting.shop
            if (!shop?.x_account) {
                results.errors.push(`Shop ${shop?.name || setting.shop_id} has no x_account`)
                continue
            }

            try {
                // 3.1 ツイート取得
                const tweetsRes = await fetch(`${baseUrl}/api/twitter?username=${shop.x_account}`)
                const tweetsData = await tweetsRes.json()

                if (!tweetsData.success) {
                    results.errors.push(`Failed to fetch tweets for ${shop.name}: ${tweetsData.error || 'Unknown error'}`)
                    continue
                }

                // 3.2 各ツイートを処理
                for (const tweet of tweetsData.tweets || []) {
                    // 重複チェック
                    const { data: existing } = await supabase
                        .from('fetched_tweets')
                        .select('id')
                        .eq('tweet_id', tweet.id)
                        .single()

                    if (existing) {
                        continue // 既に取得済み
                    }

                    results.new_tweets++

                    // 3.3 画像付きツイートのみ処理
                    if (!tweet.images || tweet.images.length === 0) {
                        // 取得済みとして記録（画像なし）
                        await supabase.from('fetched_tweets').insert({
                            tweet_id: tweet.id,
                            shop_id: shop.id,
                            is_purchase_related: false
                        })
                        continue
                    }

                    // 3.4 Geminiで買取表かどうか判別
                    let isPurchaseList = false
                    let classifyConfidence = 0
                    let classifyReason = ''

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

                        classifyConfidence = classifyData.confidence || 0
                        classifyReason = classifyData.reason || ''

                        // confidence 70%以上で買取表と判定
                        isPurchaseList = classifyData.is_purchase_list && classifyConfidence >= 70

                        if (isPurchaseList) {
                            results.purchase_lists_found++
                        }
                    } catch (classifyErr: any) {
                        console.error(`Classify error for tweet ${tweet.id}:`, classifyErr)
                        // 判別エラーでも続行（買取表として扱わない）
                    }

                    // 3.5 買取表なら保留に追加
                    if (isPurchaseList) {
                        // 各画像を保留に追加
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

                                // バックグラウンドでAI解析開始（既存のAPIを使用）
                                fetch(`${baseUrl}/api/pending-images/analyze`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ pendingImageId: pendingImage.id })
                                }).catch(err => console.error('Background analysis error:', err))
                            } else if (pendingError) {
                                console.error(`Failed to add pending image for tweet ${tweet.id}:`, pendingError)
                            }
                        }
                    }

                    // 3.6 取得済みツイートとして記録
                    await supabase.from('fetched_tweets').insert({
                        tweet_id: tweet.id,
                        shop_id: shop.id,
                        is_purchase_related: isPurchaseList
                    })
                }

                // 3.7 最終チェック時刻を更新
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

        const duration = Date.now() - startTime

        return NextResponse.json({
            success: true,
            duration_ms: duration,
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

// Vercel Cronからの呼び出し用（GETも対応）
export async function GET(request: NextRequest) {
    return POST(request)
}
