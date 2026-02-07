import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * 日次価格インデックス集計
 * 毎朝7:00 JST実行（Cronジョブ）
 * 
 * RPC関数不要版: 直接クエリ + JS集計
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const isTestMode = searchParams.get('test') === '1'
        // dateパラメータ指定で特定日の集計が可能
        const dateParam = searchParams.get('date')

        // CRON_SECRET認証（テストモード以外）
        if (!isTestMode) {
            const authHeader = req.headers.get('authorization')
            const cronSecret = process.env.CRON_SECRET

            if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
                return NextResponse.json(
                    { success: false, error: 'Unauthorized' },
                    { status: 401 }
                )
            }
        }

        const supabase = createServiceClient()

        // 対象日付を決定
        let targetDate: string
        if (dateParam) {
            targetDate = dateParam
        } else {
            // 前日の日付を計算（JST）
            const now = new Date()
            const jstOffset = 9 * 60 * 60 * 1000
            const jstNow = new Date(now.getTime() + jstOffset)
            jstNow.setDate(jstNow.getDate() - 1)
            targetDate = jstNow.toISOString().split('T')[0]
        }

        console.log(`[Price Index] Aggregating for date: ${targetDate}`)

        // 対象日の範囲（JST基準）
        const dayStart = `${targetDate}T00:00:00+09:00`
        const dayEnd = `${targetDate}T23:59:59+09:00`

        const results: any[] = []

        // ==========================================================================
        // 1. スニダン売買履歴を集計（sale）
        // ==========================================================================
        const { data: salesData, error: salesError } = await supabase
            .from('snkrdunk_sales_history')
            .select('card_id, price, grade, sold_at, cards!inner(category_large_id, rarity_id)')
            .gte('sold_at', dayStart)
            .lte('sold_at', dayEnd)
            .in('grade', ['PSA10', 'A'])
            .gt('price', 0)

        if (salesError) {
            console.error('Sales query error:', salesError)
        } else if (salesData && salesData.length > 0) {
            // カテゴリ名とレアリティ名を取得
            const categoryIds = [...new Set(salesData.map((s: any) => s.cards?.category_large_id).filter(Boolean))]
            const rarityIds = [...new Set(salesData.map((s: any) => s.cards?.rarity_id).filter(Boolean))]

            const { data: categories } = await supabase
                .from('category_large')
                .select('id, name')
                .in('id', categoryIds)

            const { data: rarities } = await supabase
                .from('rarities')
                .select('id, name')
                .in('id', rarityIds.length > 0 ? rarityIds : ['__none__'])

            const categoryMap: Record<string, string> = {}
            const rarityMap: Record<string, string> = {}
            categories?.forEach((c: any) => categoryMap[c.id] = c.name)
            rarities?.forEach((r: any) => rarityMap[r.id] = r.name)

            // グルーピング: category + rarity + grade
            const groups: Record<string, number[]> = {}
            for (const sale of salesData) {
                const card = sale.cards as any
                const catName = categoryMap[card?.category_large_id] || 'UNKNOWN'
                const rarName = rarityMap[card?.rarity_id] || 'UNKNOWN'
                const grade = sale.grade
                const key = `${catName}|${rarName}|${grade}`

                if (!groups[key]) groups[key] = []
                groups[key].push(sale.price)
            }

            // 集計
            for (const [key, prices] of Object.entries(groups)) {
                const [category, rarity, grade] = key.split('|')
                const sorted = prices.sort((a, b) => a - b)
                const avg = sorted.reduce((s, v) => s + v, 0) / sorted.length
                const median = sorted.length % 2 === 0
                    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
                    : sorted[Math.floor(sorted.length / 2)]

                results.push({
                    date: targetDate,
                    category,
                    rarity,
                    grade,
                    price_type: 'sale',
                    avg_price: Math.round(avg),
                    median_price: Math.round(median),
                    card_count: new Set(salesData.filter((s: any) => {
                        const c = s.cards as any
                        return categoryMap[c?.category_large_id] === category
                            && (rarityMap[c?.rarity_id] || 'UNKNOWN') === rarity
                            && s.grade === grade
                    }).map((s: any) => s.card_id)).size,
                    trade_count: prices.length
                })
            }
        }

        console.log(`[Price Index] Sales records: ${salesData?.length || 0}, groups: ${results.length}`)

        // ==========================================================================
        // 2. 買取価格を集計（purchase）
        // ==========================================================================
        const { data: purchaseData, error: purchaseError } = await supabase
            .from('purchase_prices')
            .select('card_id, price, created_at, cards!inner(category_large_id, rarity_id)')
            .gte('created_at', dayStart)
            .lte('created_at', dayEnd)
            .gt('price', 0)

        if (purchaseError) {
            console.error('Purchase query error:', purchaseError)
        } else if (purchaseData && purchaseData.length > 0) {
            const categoryIds = [...new Set(purchaseData.map((p: any) => p.cards?.category_large_id).filter(Boolean))]
            const rarityIds = [...new Set(purchaseData.map((p: any) => p.cards?.rarity_id).filter(Boolean))]

            const { data: categories } = await supabase
                .from('category_large')
                .select('id, name')
                .in('id', categoryIds)

            const { data: rarities } = await supabase
                .from('rarities')
                .select('id, name')
                .in('id', rarityIds.length > 0 ? rarityIds : ['__none__'])

            const categoryMap: Record<string, string> = {}
            const rarityMap: Record<string, string> = {}
            categories?.forEach((c: any) => categoryMap[c.id] = c.name)
            rarities?.forEach((r: any) => rarityMap[r.id] = r.name)

            const groups: Record<string, number[]> = {}
            for (const p of purchaseData) {
                const card = p.cards as any
                const catName = categoryMap[card?.category_large_id] || 'UNKNOWN'
                const rarName = rarityMap[card?.rarity_id] || 'UNKNOWN'
                const key = `${catName}|${rarName}`

                if (!groups[key]) groups[key] = []
                groups[key].push(p.price)
            }

            const purchaseResultsStart = results.length
            for (const [key, prices] of Object.entries(groups)) {
                const [category, rarity] = key.split('|')
                const sorted = prices.sort((a, b) => a - b)
                const avg = sorted.reduce((s, v) => s + v, 0) / sorted.length
                const median = sorted.length % 2 === 0
                    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
                    : sorted[Math.floor(sorted.length / 2)]

                results.push({
                    date: targetDate,
                    category,
                    rarity,
                    grade: 'ALL',
                    price_type: 'purchase',
                    avg_price: Math.round(avg),
                    median_price: Math.round(median),
                    card_count: new Set(purchaseData.filter((p: any) => {
                        const c = p.cards as any
                        return categoryMap[c?.category_large_id] === category
                            && (rarityMap[c?.rarity_id] || 'UNKNOWN') === rarity
                    }).map((p: any) => p.card_id)).size,
                    trade_count: prices.length
                })
            }
            console.log(`[Price Index] Purchase groups: ${results.length - purchaseResultsStart}`)
        }

        // ==========================================================================
        // 3. 結果をUPSERT
        // ==========================================================================
        if (results.length > 0) {
            const { error: upsertError } = await supabase
                .from('daily_price_index')
                .upsert(results, {
                    onConflict: 'date,category,rarity,grade,price_type'
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

        return NextResponse.json({
            success: true,
            date: targetDate,
            count: results.length,
            salesRecords: salesData?.length || 0,
            purchaseRecords: purchaseData?.length || 0,
            results: results.slice(0, 20)
        })

    } catch (error: any) {
        console.error('[Price Index] Error:', error)
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}
