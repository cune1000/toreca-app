import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import {
    extractApparelId,
    getProductInfo,
    getSalesHistory,
    getListings,
} from '@/lib/snkrdunk-api'
import { normalizeGrade } from '@/lib/scraping/helpers'

// アイコン番号を抽出するヘルパー
function extractIconNumber(imageUrl: string): number | null {
    if (!imageUrl) return null
    const match = imageUrl.match(/user-icon-(\d+)/)
    return match ? parseInt(match[1]) : null
}

/**
 * Vercel Cron Job: スニダン自動スクレイピング（新API方式）
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
        const MAX_SCRAPES_PER_RUN = 10

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
                    intervalMinutes = await calculateAdaptiveInterval(saleUrl.card_id)
                } else if (saleUrl.auto_scrape_mode === 'manual') {
                    intervalMinutes = saleUrl.auto_scrape_interval_minutes || 1440
                } else {
                    continue
                }

                // 新API方式でスクレイピング実行
                const scrapeResult = await scrapeViaAPI(saleUrl.card_id, saleUrl.product_url, saleUrl.site_id)

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
                    listingPrices: scrapeResult.listingPrices,
                    nextScrapeAt: nextScrapeAt.toISOString(),
                    intervalMinutes
                })
            } catch (error: any) {
                console.error(`Failed to scrape card ${saleUrl.card_id}:`, error)

                const intervalMinutes = saleUrl.auto_scrape_mode === 'manual'
                    ? saleUrl.auto_scrape_interval_minutes || 1440
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
 * 段階: 3h → 6h → 12h → 24h → 48h → 72h
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
        intervalMinutes = 180     // 5件/時間以上 → 3時間
    } else if (salesPerHour >= 2) {
        intervalMinutes = 360     // 2-5件/時間 → 6時間
    } else if (salesPerHour >= 1) {
        intervalMinutes = 720     // 1-2件/時間 → 12時間
    } else if (salesPerHour >= 0.5) {
        intervalMinutes = 1440    // 0.5-1件/時間 → 24時間
    } else if (salesPerHour >= 0.2) {
        intervalMinutes = 2880    // 0.2-0.5件/時間 → 48時間
    } else {
        intervalMinutes = 4320    // 0.2件/時間未満 → 72時間
    }

    // ランダム化（±10%）
    const randomOffset = Math.floor(intervalMinutes * 0.1 * (Math.random() * 2 - 1))
    intervalMinutes += randomOffset

    return Math.max(180, Math.min(4320, intervalMinutes))
}

/**
 * 新API方式: スニダンAPIを直接呼び出して売買履歴を取得・保存
 * ZenRows/Railwayを使わず、snkrdunk.com/v1/apparels/ を直接呼ぶ
 */
async function scrapeViaAPI(cardId: string, url: string, siteId: string) {
    // apparelId 抽出
    const apparelId = extractApparelId(url)
    if (!apparelId) {
        throw new Error(`Invalid URL: ${url}`)
    }

    // 商品情報を取得
    const productInfo = await getProductInfo(apparelId)
    const productType = productInfo.isBox ? 'box' : 'single'

    console.log(`[AutoScrape] ${productInfo.localizedName} (type=${productType}, apparelId=${apparelId})`)

    // apparel_idを更新
    await supabase
        .from('card_sale_urls')
        .update({ apparel_id: apparelId })
        .eq('card_id', cardId)
        .eq('product_url', url)

    // 売買履歴を取得（1ページ目のみ）
    const { history: salesHistory } = await getSalesHistory(apparelId, 1, 20)

    // データ整形
    const processedData = salesHistory
        .map((item: any) => {
            const gradeSource = productType === 'box' ? item.size : item.condition
            const grade = normalizeGrade(gradeSource)
            if (!grade) return null

            return {
                card_id: cardId,
                apparel_id: apparelId,
                grade,
                price: item.price,
                sold_at: item.soldAt,
                product_type: productType,
                user_icon_number: extractIconNumber(item.imageUrl),
            }
        })
        .filter(Boolean)

    // 既存データ取得（重複チェック用）
    const { data: existingData } = await supabase
        .from('snkrdunk_sales_history')
        .select('grade, price, sold_at, user_icon_number')
        .eq('card_id', cardId)
        .order('sold_at', { ascending: false })
        .limit(100)

    // 重複チェック・挿入
    let insertedCount = 0
    let skippedCount = 0

    for (const sale of processedData) {
        let isDuplicate = false

        if (sale.user_icon_number) {
            isDuplicate = existingData?.some(existing =>
                existing.grade === sale.grade &&
                existing.price === sale.price &&
                existing.user_icon_number === sale.user_icon_number
            ) || false
        } else {
            isDuplicate = existingData?.some(existing =>
                existing.grade === sale.grade &&
                existing.price === sale.price &&
                existing.sold_at === sale.sold_at &&
                !existing.user_icon_number
            ) || false
        }

        if (isDuplicate) {
            skippedCount++
        } else {
            const { error } = await supabase
                .from('snkrdunk_sales_history')
                .insert(sale)
            if (!error) {
                insertedCount++
            } else {
                console.error(`[AutoScrape] Insert error:`, error.message)
                skippedCount++
            }
        }
    }

    // 販売最安値を取得・保存
    const listingPrices: Record<string, number | null> = {}

    if (productType === 'single') {
        try {
            const listings = await getListings(apparelId, 'single', 1, 50)
            const psa10Items = listings.filter(l => l.condition.includes('PSA10'))
            listingPrices['PSA10'] = psa10Items.length > 0 ? Math.min(...psa10Items.map(l => l.price)) : null

            const gradeAItems = listings.filter(l => l.condition.startsWith('A') || l.condition.includes('A（'))
            listingPrices['A'] = gradeAItems.length > 0 ? Math.min(...gradeAItems.map(l => l.price)) : null
        } catch (e: any) {
            console.error(`[AutoScrape] Listings fetch error: ${e.message}`)
        }
    } else {
        listingPrices['BOX'] = productInfo.minPrice
    }

    // sale_prices に保存
    if (siteId) {
        for (const [grade, price] of Object.entries(listingPrices)) {
            if (price !== null && price > 0) {
                await supabase
                    .from('sale_prices')
                    .insert({ card_id: cardId, site_id: siteId, price, grade })
            }
        }
    }

    console.log(`[AutoScrape] Done: inserted=${insertedCount}, skipped=${skippedCount}, listingPrices=${JSON.stringify(listingPrices)}`)

    return { inserted: insertedCount, skipped: skippedCount, listingPrices }
}
