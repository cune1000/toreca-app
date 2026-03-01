import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { shouldRunCronJob, markCronJobRun } from '@/lib/cron-gate'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * 日次価格インデックス集計
 * 毎朝7:00 JST実行（Cronジョブ）
 * 
 * 集計対象:
 * 1. スニダン売買履歴（PSA10, 状態A, 1BOX）
 * 2. 買取価格（最新）
 * 
 * グルーピング: category × sub_category(世代) × rarity × grade
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const dateParam = searchParams.get('date')

        // CRON_SECRET認証
        const authHeader = req.headers.get('authorization')
        const cronSecret = process.env.CRON_SECRET
        if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            )
        }

        const gate = await shouldRunCronJob('daily-price-aggregate')
        if (!gate.shouldRun) {
            return NextResponse.json({ skipped: true, reason: gate.reason })
        }

        const supabase = createServiceClient()

        // 対象日付を決定
        let targetDate: string
        if (dateParam) {
            targetDate = dateParam
        } else {
            const now = new Date()
            const jstOffset = 9 * 60 * 60 * 1000
            const jstNow = new Date(now.getTime() + jstOffset)
            jstNow.setDate(jstNow.getDate() - 1)
            targetDate = jstNow.toISOString().split('T')[0]
        }

        console.log(`[Price Index] Aggregating for date: ${targetDate}`)

        const dayStart = `${targetDate}T00:00:00+09:00`
        const dayEnd = `${targetDate}T23:59:59+09:00`

        const results: any[] = []

        // =====================================================================
        // マスターデータ取得
        // =====================================================================
        const { data: allCategories } = await supabase
            .from('category_large')
            .select('id, name')
        const { data: allMediumCategories } = await supabase
            .from('category_medium')
            .select('id, name, large_id')
        const { data: allRarities } = await supabase
            .from('rarities')
            .select('id, name')

        const categoryMap: Record<string, string> = {}
        const categoryMediumMap: Record<string, { name: string; largeId: string }> = {}
        const rarityMap: Record<string, string> = {}

        allCategories?.forEach((c: any) => categoryMap[c.id] = c.name)
        allMediumCategories?.forEach((c: any) => categoryMediumMap[c.id] = { name: c.name, largeId: c.large_id })
        allRarities?.forEach((r: any) => rarityMap[r.id] = r.name)

        // カードIDからカテゴリ中を逆引きするマップ
        // cards テーブルから category_medium_id を取得
        const { data: cardMediumData } = await supabase
            .from('cards')
            .select('id, category_large_id, category_medium_id, rarity_id')

        const cardInfoMap: Record<string, { catLargeId: string; catMediumId: string | null; rarityId: string | null }> = {}
        cardMediumData?.forEach((c: any) => {
            cardInfoMap[c.id] = {
                catLargeId: c.category_large_id,
                catMediumId: c.category_medium_id,
                rarityId: c.rarity_id
            }
        })

        // =====================================================================
        // 1. スニダン売買履歴を集計（sale）: PSA10, A, 1BOX
        // =====================================================================
        const { data: salesData, error: salesError } = await supabase
            .from('snkrdunk_sales_history')
            .select('card_id, price, grade, sold_at')
            .gte('sold_at', dayStart)
            .lte('sold_at', dayEnd)
            .in('grade', ['PSA10', 'A', '1BOX'])
            .gt('price', 0)

        if (salesError) {
            console.error('Sales query error:', salesError)
        } else if (salesData && salesData.length > 0) {
            // グルーピング: category × sub_category × rarity × grade
            const groups: Record<string, { prices: number[]; cardIds: Set<string> }> = {}

            for (const sale of salesData) {
                const cardInfo = cardInfoMap[sale.card_id]
                if (!cardInfo) continue

                const catName = categoryMap[cardInfo.catLargeId] || 'UNKNOWN'
                const subCatName = cardInfo.catMediumId
                    ? (categoryMediumMap[cardInfo.catMediumId]?.name || 'ALL')
                    : 'ALL'
                const rarName = cardInfo.rarityId ? (rarityMap[cardInfo.rarityId] || 'UNKNOWN') : 'UNKNOWN'
                const grade = sale.grade

                // BOXは rarity='BOX' として統一
                const effectiveRarity = grade === '1BOX' ? 'BOX' : rarName
                const key = `${catName}|${subCatName}|${effectiveRarity}|${grade}`

                if (!groups[key]) groups[key] = { prices: [], cardIds: new Set() }
                groups[key].prices.push(sale.price)
                groups[key].cardIds.add(sale.card_id)
            }

            for (const [key, group] of Object.entries(groups)) {
                const [category, subCategory, rarity, grade] = key.split('|')
                const sorted = group.prices.sort((a, b) => a - b)
                const avg = sorted.reduce((s, v) => s + v, 0) / sorted.length
                const median = sorted.length % 2 === 0
                    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
                    : sorted[Math.floor(sorted.length / 2)]

                results.push({
                    date: targetDate,
                    category,
                    sub_category: subCategory,
                    rarity,
                    grade,
                    price_type: 'sale',
                    avg_price: Math.round(avg),
                    median_price: Math.round(median),
                    card_count: group.cardIds.size,
                    trade_count: group.prices.length
                })
            }
        }

        console.log(`[Price Index] Sales: ${salesData?.length || 0} records -> ${results.length} groups`)

        // =====================================================================
        // 2. 買取価格を集計（purchase）
        // =====================================================================
        const { data: purchaseData, error: purchaseError } = await supabase
            .from('purchase_prices')
            .select('card_id, price, created_at')
            .gte('created_at', dayStart)
            .lte('created_at', dayEnd)
            .gt('price', 0)

        if (purchaseError) {
            console.error('Purchase query error:', purchaseError)
        } else if (purchaseData && purchaseData.length > 0) {
            const groups: Record<string, { prices: number[]; cardIds: Set<string> }> = {}

            for (const p of purchaseData) {
                const cardInfo = cardInfoMap[p.card_id]
                if (!cardInfo) continue

                const catName = categoryMap[cardInfo.catLargeId] || 'UNKNOWN'
                const subCatName = cardInfo.catMediumId
                    ? (categoryMediumMap[cardInfo.catMediumId]?.name || 'ALL')
                    : 'ALL'
                const rarName = cardInfo.rarityId ? (rarityMap[cardInfo.rarityId] || 'UNKNOWN') : 'UNKNOWN'
                const key = `${catName}|${subCatName}|${rarName}`

                if (!groups[key]) groups[key] = { prices: [], cardIds: new Set() }
                groups[key].prices.push(p.price)
                groups[key].cardIds.add(p.card_id)
            }

            const purchaseStart = results.length
            for (const [key, group] of Object.entries(groups)) {
                const [category, subCategory, rarity] = key.split('|')
                const sorted = group.prices.sort((a, b) => a - b)
                const avg = sorted.reduce((s, v) => s + v, 0) / sorted.length
                const median = sorted.length % 2 === 0
                    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
                    : sorted[Math.floor(sorted.length / 2)]

                results.push({
                    date: targetDate,
                    category,
                    sub_category: subCategory,
                    rarity,
                    grade: 'ALL',
                    price_type: 'purchase',
                    avg_price: Math.round(avg),
                    median_price: Math.round(median),
                    card_count: group.cardIds.size,
                    trade_count: group.prices.length
                })
            }
            console.log(`[Price Index] Purchase: ${purchaseData.length} records -> ${results.length - purchaseStart} groups`)
        }

        // =====================================================================
        // 3. 結果をUPSERT
        // =====================================================================
        if (results.length > 0) {
            const { error: upsertError } = await supabase
                .from('daily_price_index')
                .upsert(results, {
                    onConflict: 'date,category,sub_category,rarity,grade,price_type'
                })

            if (upsertError) {
                console.error('Upsert error:', upsertError)
                return NextResponse.json({
                    success: false,
                    error: upsertError.message
                }, { status: 500 })
            }
        }

        console.log(`[Price Index] Saved ${results.length} records for ${targetDate}`)

        // =====================================================================
        // 4. カード単位の日次集計（chart_daily_card_prices）
        // =====================================================================
        let chartCardCount = 0

        // 4-1. スニダン売買履歴からカード別販売平均を集計
        const saleByCard: Record<string, { prices: number[] }> = {}
        if (salesData && salesData.length > 0) {
            for (const sale of salesData) {
                if (!saleByCard[sale.card_id]) saleByCard[sale.card_id] = { prices: [] }
                saleByCard[sale.card_id].prices.push(sale.price)
            }
        }

        // 4-2. 買取価格からカード別平均を集計
        const purchaseByCard: Record<string, { prices: number[] }> = {}
        if (purchaseData && purchaseData.length > 0) {
            for (const p of purchaseData) {
                if (!purchaseByCard[p.card_id]) purchaseByCard[p.card_id] = { prices: [] }
                purchaseByCard[p.card_id].prices.push(p.price)
            }
        }

        // 4-3. 全カードIDをマージ
        const allCardIds = new Set([
            ...Object.keys(saleByCard),
            ...Object.keys(purchaseByCard),
        ])

        const chartRecords: any[] = []
        for (const cardId of allCardIds) {
            const salePrices = saleByCard[cardId]?.prices || []
            const purchasePrices2 = purchaseByCard[cardId]?.prices || []

            const saleAvg = salePrices.length > 0
                ? Math.round(salePrices.reduce((s, v) => s + v, 0) / salePrices.length)
                : null
            const purchaseAvg = purchasePrices2.length > 0
                ? Math.round(purchasePrices2.reduce((s, v) => s + v, 0) / purchasePrices2.length)
                : null

            chartRecords.push({
                card_id: cardId,
                date: targetDate,
                sale_avg: saleAvg,
                purchase_avg: purchaseAvg,
                sale_count: salePrices.length,
                purchase_count: purchasePrices2.length,
            })
        }

        // 4-4. chart_daily_card_pricesにUPSERT（100件ずつ）
        if (chartRecords.length > 0) {
            for (let i = 0; i < chartRecords.length; i += 100) {
                const chunk = chartRecords.slice(i, i + 100)
                const { error: chartError } = await supabase
                    .from('chart_daily_card_prices')
                    .upsert(chunk, { onConflict: 'card_id,date' })

                if (chartError) {
                    console.error(`[Chart Prices] Upsert error (batch ${i / 100 + 1}):`, chartError)
                }
            }
            chartCardCount = chartRecords.length
        }

        console.log(`[Chart Prices] Saved ${chartCardCount} card-level records for ${targetDate}`)

        await markCronJobRun('daily-price-aggregate', 'success')
        return NextResponse.json({
            success: true,
            date: targetDate,
            count: results.length,
            chartCardCount,
            salesRecords: salesData?.length || 0,
            purchaseRecords: purchaseData?.length || 0,
            results: results.slice(0, 30)
        })

    } catch (error: any) {
        console.error('[Price Index] Error:', error)
        await markCronJobRun('daily-price-aggregate', 'error', error.message)
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}
