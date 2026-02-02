import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

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
            url.site?.name?.toLowerCase().includes('スニダン') ||
            url.site?.name?.toLowerCase().includes('snkrdunk')
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
    const TORECA_SCRAPER_URL = process.env.TORECA_SCRAPER_URL || 'https://skillful-love-production.up.railway.app'

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

    const salesHistory = scrapeData.data || []

    // データを整形
    const now = new Date()
    const scrapedData: Array<{
        grade: string
        price: number
        sold_at: string
        user_icon_number: number | null
    }> = []

    salesHistory.forEach((item: any) => {
        const soldAt = parseRelativeTime(item.dateText, now)
        if (!soldAt) return

        const grade = normalizeGrade(item.gradeText)
        if (!grade) return

        const price = parsePrice(item.priceText)
        if (!price) return

        scrapedData.push({
            grade,
            price,
            sold_at: soldAt.toISOString(),
            user_icon_number: item.userIconNumber || null
        })
    })

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
                context_fingerprint: context,
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
        const { error } = await supabase
            .from('snkrdunk_sales_history')
            .insert(item)

        if (error) {
            // 重複エラー（23505）は無視、それ以外はログ出力
            if (error.code === '23505') {
                console.log(`[DB duplicate] ${item.grade} ¥${item.price} icon:${item.user_icon_number}`)
                skippedCount++
            } else {
                console.error(`[Insert error] ${error.code}: ${error.message}`, item)
            }
        } else {
            insertedCount++
        }
    }

    return {
        total: scrapedData.length,
        inserted: insertedCount,
        skipped: skippedCount
    }
}

// ヘルパー関数（既存のsnkrdunk-scrape/route.tsと同じ）
function parseRelativeTime(timeStr: string, baseTime: Date): Date | null {
    const pattern = /(\d+)(分|時間|日)前/
    const match = timeStr.match(pattern)
    if (!match) return null

    const value = parseInt(match[1], 10)
    const unit = match[2]
    const result = new Date(baseTime)

    switch (unit) {
        case '分':
            result.setMinutes(result.getMinutes() - value)
            break
        case '時間':
            result.setHours(result.getHours() - value)
            break
        case '日':
            result.setDate(result.getDate() - value)
            break
        default:
            return null
    }

    return result
}

function normalizeGrade(gradeText: string): string | null {
    const cleaned = gradeText.replace(/\s+/g, '').toUpperCase()

    if (cleaned.includes('PSA10')) return 'PSA10'
    if (cleaned.includes('PSA9')) return 'PSA9'
    if (cleaned.includes('PSA8') || cleaned.includes('PSA7') || cleaned.includes('PSA6')) return 'PSA8以下'
    if (cleaned.includes('BGS10BL')) return 'BGS10BL'
    if (cleaned.includes('BGS10GL')) return 'BGS10GL'
    if (cleaned.includes('BGS9.5')) return 'BGS9.5'
    if (cleaned.includes('BGS9')) return 'BGS9以下'
    if (cleaned.includes('ARS10+')) return 'ARS10+'
    if (cleaned.includes('ARS10')) return 'ARS10'
    if (cleaned.includes('ARS9')) return 'ARS9'
    if (cleaned.includes('ARS8')) return 'ARS8以下'
    if (cleaned.includes('A') || cleaned === 'A') return 'A'
    if (cleaned.includes('B') || cleaned === 'B') return 'B'
    if (cleaned.includes('C') || cleaned === 'C') return 'C'
    if (cleaned.includes('D') || cleaned === 'D') return 'D'

    return null
}

function parsePrice(priceText: string): number | null {
    const cleaned = priceText.replace(/[¥,]/g, '')
    const price = parseInt(cleaned, 10)
    return isNaN(price) ? null : price
}
