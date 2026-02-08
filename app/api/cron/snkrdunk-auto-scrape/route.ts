import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { parseRelativeTime, normalizeGrade, parsePrice } from '@/lib/scraping/helpers'
import { TORECA_SCRAPER_URL } from '@/lib/config'

/**
 * Vercel Cron Job: スニダン自動スクレイピング
 * 10分ごとに実行され、設定に応じて各カードをスクレイピング
 */
export async function GET(req: Request) {
    try {
        // 認証チェック
        const authHeader = req.headers.get('authorization')
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return new Response('Unauthorized', { status: 401 })
        }

        const now = new Date()
        const MAX_SCRAPES_PER_RUN = 10 // 1回の実行で最大10件まで

        // スニダンのURLを持つカードを取得
        const { data: saleUrls, error: fetchError } = await supabase
            .from('card_sale_urls')
            .select('*, site:site_id(id, name), card:card_id(id, name)')
            .neq('auto_scrape_mode', 'off')
            .or('next_scrape_at.is.null,next_scrape_at.lte.' + now.toISOString())
            .order('next_scrape_at', { ascending: true, nullsFirst: true })
            .limit(MAX_SCRAPES_PER_RUN)

        if (fetchError) {
            console.error('Failed to fetch sale URLs:', fetchError)
            return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 })
        }

        // スニダンのURLのみフィルタ
        const snkrdunkUrls = (saleUrls || []).filter((url: any) =>
            url.site?.name?.includes('スニダン') ||
            url.site?.name?.includes('スニーカーダンク') ||
            url.site?.name?.toLowerCase().includes('snkrdunk') ||
            url.product_url?.includes('snkrdunk.com')
        )

        if (snkrdunkUrls.length === 0) {
            return NextResponse.json({ success: true, processed: 0, message: 'No URLs to scrape' })
        }

        const results = []

        for (const saleUrl of snkrdunkUrls) {
            try {
                // 間隔を計算
                let intervalMinutes: number

                if (saleUrl.auto_scrape_mode === 'auto') {
                    // オートメーション: アダプティブアルゴリズム
                    intervalMinutes = await calculateAdaptiveInterval(saleUrl.card_id)
                } else if (saleUrl.auto_scrape_mode === 'manual') {
                    // 手動設定: ユーザー指定の間隔
                    intervalMinutes = saleUrl.auto_scrape_interval_minutes || 360
                } else {
                    continue
                }

                // スクレイピング実行
                const scrapeResult = await scrapeSnkrdunkHistory(saleUrl.card_id, saleUrl.product_url)

                // 次回スクレイピング時刻を計算
                const nextScrapeAt = new Date(now.getTime() + intervalMinutes * 60 * 1000)

                // 更新
                await supabase
                    .from('card_sale_urls')
                    .update({
                        last_scraped_at: now.toISOString(),
                        last_scrape_status: 'success',
                        last_scrape_error: null,
                        next_scrape_at: nextScrapeAt.toISOString()
                    })
                    .eq('id', saleUrl.id)

                results.push({
                    cardId: saleUrl.card_id,
                    cardName: saleUrl.card?.name,
                    status: 'success',
                    inserted: scrapeResult.inserted,
                    skipped: scrapeResult.skipped,
                    nextScrapeAt: nextScrapeAt.toISOString(),
                    intervalMinutes
                })
            } catch (error: any) {
                console.error(`Failed to scrape card ${saleUrl.card_id}:`, error)

                // エラー時は間隔を2倍に延長
                const intervalMinutes = saleUrl.auto_scrape_mode === 'manual'
                    ? saleUrl.auto_scrape_interval_minutes || 360
                    : 360
                const nextScrapeAt = new Date(now.getTime() + intervalMinutes * 2 * 60 * 1000)

                await supabase
                    .from('card_sale_urls')
                    .update({
                        last_scraped_at: now.toISOString(),
                        last_scrape_status: 'error',
                        last_scrape_error: error.message,
                        next_scrape_at: nextScrapeAt.toISOString()
                    })
                    .eq('id', saleUrl.id)

                results.push({
                    cardId: saleUrl.card_id,
                    cardName: saleUrl.card?.name,
                    status: 'error',
                    error: error.message
                })
            }
        }

        return NextResponse.json({
            success: true,
            processed: results.length,
            results
        })
    } catch (error: any) {
        console.error('Cron job error:', error)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}

/**
 * アダプティブアルゴリズム: 売買頻度に応じて間隔を調整
 */
async function calculateAdaptiveInterval(cardId: string): Promise<number> {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

    const { data: recentSales } = await supabase
        .from('snkrdunk_sales_history')
        .select('id')
        .eq('card_id', cardId)
        .gte('sold_at', twentyFourHoursAgo.toISOString())

    const salesPerHour = (recentSales?.length || 0) / 24

    let intervalMinutes: number

    if (salesPerHour >= 5) {
        // 非常に活発: 5件/時間以上 → 30分
        intervalMinutes = 30
    } else if (salesPerHour >= 2) {
        // 活発: 2-5件/時間 → 1時間
        intervalMinutes = 60
    } else if (salesPerHour >= 1) {
        // 中程度: 1-2件/時間 → 2時間
        intervalMinutes = 120
    } else if (salesPerHour >= 0.5) {
        // やや静か: 0.5-1件/時間 → 3時間
        intervalMinutes = 180
    } else if (salesPerHour >= 0.2) {
        // 静か: 0.2-0.5件/時間 → 4時間
        intervalMinutes = 240
    } else {
        // 非常に静か: 0.2件/時間未満 → 6時間
        intervalMinutes = 360
    }

    // ランダム化（±10%）
    const randomOffset = Math.floor(intervalMinutes * 0.1 * (Math.random() * 2 - 1))
    intervalMinutes += randomOffset

    return intervalMinutes
}

/**
 * スニダン売買履歴をスクレイピング（toreca-scraper経由）
 */
async function scrapeSnkrdunkHistory(cardId: string, url: string) {
    // toreca-scraperを呼び出してスクレイピング
    const scrapeResponse = await fetch(`${TORECA_SCRAPER_URL}/api/snkrdunk-scrape`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
    })

    if (!scrapeResponse.ok) {
        throw new Error(`Scraper failed: ${scrapeResponse.statusText}`)
    }

    const scrapeData = await scrapeResponse.json()

    if (!scrapeData.success) {
        throw new Error(scrapeData.error || 'Scraping failed')
    }

    let salesHistory: any[]

    // バックグラウンド処理の場合: ジョブIDを返す → ポーリングで結果を待つ
    if (scrapeData.jobId) {
        console.log(`[Snkrdunk Cron] Background job started: ${scrapeData.jobId}`)

        // ポーリング処理
        const pollInterval = 2000 // 2秒ごと
        const maxAttempts = 60 // 最大2分
        let attempts = 0

        const pollJob = async (): Promise<any[]> => {
            attempts++

            const statusRes = await fetch(`${TORECA_SCRAPER_URL}/scrape/status/${scrapeData.jobId}`)
            const statusData = await statusRes.json()

            if (statusData.status === 'completed') {
                // 成功: 結果を返す
                const salesHistory = statusData.result?.sales || []
                console.log(`[Snkrdunk Cron] Job completed: ${salesHistory.length} sales`)
                return salesHistory
            } else if (statusData.status === 'failed') {
                // 失敗
                throw new Error(statusData.error || 'Scraping failed')
            } else if (attempts >= maxAttempts) {
                // タイムアウト
                throw new Error('Timeout: Job took too long')
            }

            // まだ処理中: 再度ポーリング
            await new Promise(resolve => setTimeout(resolve, pollInterval))
            return pollJob()
        }

        salesHistory = await pollJob()
        console.log(`[Snkrdunk Cron] Polling completed, salesHistory length: ${salesHistory?.length || 0}`)
        // ポーリング完了後、既存のデータ処理ロジックへ続く
    } else {
        // 同期処理の場合（後方互換性）
        salesHistory = scrapeData.sales || []
    }

    // データを整形
    const now = new Date()
    const scrapedData: Array<{
        grade: string
        price: number
        sold_at: string
        user_icon_number: number | null
    }> = []

    salesHistory.forEach((item: any, index: number) => {
        // 最初の1件だけ詳細ログ
        if (index === 0) {
            console.log(`[DEBUG] Raw item 0:`, JSON.stringify(item))
        }

        // スクレイパーが返すフィールド名: date, size, price, userIconNumber
        const soldAt = parseRelativeTime(item.date, now)
        if (!soldAt) {
            if (index === 0) console.log(`[DEBUG] soldAt is null for item 0, date=${item.date}`)
            return
        }

        const grade = normalizeGrade(item.size)
        if (!grade) {
            if (index === 0) console.log(`[DEBUG] grade is null for item 0, size=${item.size}`)
            return
        }

        // priceは既に数値として返ってくる
        const price = typeof item.price === 'number' ? item.price : parsePrice(String(item.price))
        if (!price) {
            if (index === 0) console.log(`[DEBUG] price is null for item 0, price=${item.price}`)
            return
        }

        if (index === 0) {
            console.log(`[DEBUG] Parsed item 0: soldAt=${soldAt.toISOString()}, grade=${grade}, price=${price}`)
        }

        scrapedData.push({
            grade,
            price,
            sold_at: soldAt.toISOString(),
            user_icon_number: item.userIconNumber || null
        })
    })

    console.log(`[Snkrdunk Cron] After processing: ${scrapedData.length} valid items from ${salesHistory.length} raw items`)

    // 既存データを取得
    const { data: existingData } = await supabase
        .from('snkrdunk_sales_history')
        .select('grade, price, sold_at, user_icon_number')
        .eq('card_id', cardId)

    // 新規データのみを抽出（user_icon_numberベースの重複判定）
    const newData: any[] = []
    let skippedCount = 0

    for (let i = 0; i < scrapedData.length; i++) {
        const sale = scrapedData[i]

        // 前後の取引情報（将来の拡張用）
        const context = {
            prev_1: i >= 1 ? {
                grade: scrapedData[i - 1].grade,
                price: scrapedData[i - 1].price,
                icon: scrapedData[i - 1].user_icon_number
            } : null,
            next_1: i < scrapedData.length - 1 ? {
                grade: scrapedData[i + 1].grade,
                price: scrapedData[i + 1].price,
                icon: scrapedData[i + 1].user_icon_number
            } : null
        }

        // 重複チェック
        let isDuplicate = false

        if (sale.user_icon_number) {
            // アイコン番号がある場合: グレード・価格・アイコン番号で判定
            isDuplicate = existingData?.some(existing =>
                existing.grade === sale.grade &&
                existing.price === sale.price &&
                existing.user_icon_number === sale.user_icon_number
            ) || false
        } else {
            // アイコン番号がない場合: 従来通り時刻も含めて判定
            isDuplicate = existingData?.some(existing =>
                existing.grade === sale.grade &&
                existing.price === sale.price &&
                existing.sold_at === sale.sold_at &&
                !existing.user_icon_number
            ) || false
        }

        if (!isDuplicate) {
            newData.push({
                card_id: cardId,
                grade: sale.grade,
                price: sale.price,
                sold_at: sale.sold_at,
                user_icon_number: sale.user_icon_number,
                // context_fingerprint: context, // 一時的に無効化（スキーマキャッシュ問題）
                sequence_number: 0,
                scraped_at: new Date().toISOString()
            })
        } else {
            skippedCount++
        }
    }

    // 新規データのみ挿入
    let insertedCount = 0
    for (const item of newData) {
        // マイグレーション前の互換性: user_icon_numberとcontext_fingerprintがnullの場合は除外
        const insertData: any = {
            card_id: item.card_id,
            grade: item.grade,
            price: item.price,
            sold_at: item.sold_at,
            sequence_number: item.sequence_number,
            scraped_at: item.scraped_at
        }

        // 新しいカラムは存在する場合のみ追加
        if (item.user_icon_number !== null && item.user_icon_number !== undefined) {
            insertData.user_icon_number = item.user_icon_number
        }
        // context_fingerprintは一時的に無効化
        // if (item.context_fingerprint !== null && item.context_fingerprint !== undefined) {
        //     insertData.context_fingerprint = item.context_fingerprint
        // }

        const { error } = await supabase
            .from('snkrdunk_sales_history')
            .insert(insertData)

        if (error) {
            // 重複エラー（23505）は無視、それ以外はログ出力
            if (error.code === '23505') {
                console.log(`[DB duplicate] ${item.grade} ¥${item.price} icon:${item.user_icon_number}`)
                skippedCount++
            } else {
                console.error(`[Insert error] ${error.code}: ${error.message}`, insertData)
            }
        } else {
            insertedCount++
        }
    }

    console.log(`[Snkrdunk Cron] DB write complete - Total: ${scrapedData.length}, Inserted: ${insertedCount}, Skipped: ${skippedCount}`)

    return {
        total: scrapedData.length,
        inserted: insertedCount,
        skipped: skippedCount
    }
}
