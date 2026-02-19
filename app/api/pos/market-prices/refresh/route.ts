import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// 条件→各データソースのマッピング
interface GradeMapping {
    snkrdunkGrade: string | null       // sale_prices.grade
    purchaseCondition: string | null   // purchase_prices.condition
    overseasField: 'graded' | 'loose' | null
    overseasDiscount: number
}

function getGradeMapping(condition: string): GradeMapping {
    const c = condition.toUpperCase()
    if (c === 'PSA10')  return { snkrdunkGrade: 'PSA10', purchaseCondition: 'PSA10', overseasField: 'graded', overseasDiscount: 1.0 }
    if (c === 'PSA9')   return { snkrdunkGrade: 'PSA9',  purchaseCondition: null,    overseasField: 'graded', overseasDiscount: 0.7 }
    if (c === '未開封')  return { snkrdunkGrade: 'BOX',   purchaseCondition: '未開封', overseasField: 'loose',  overseasDiscount: 1.0 }
    if (c === 'A')      return { snkrdunkGrade: 'A',     purchaseCondition: '素体',   overseasField: 'loose',  overseasDiscount: 1.0 }
    if (c === 'B')      return { snkrdunkGrade: 'B',     purchaseCondition: 'B',     overseasField: null,     overseasDiscount: 1.0 }
    return { snkrdunkGrade: null, purchaseCondition: null, overseasField: null, overseasDiscount: 1.0 }
}

export async function POST() {
    try {
        // 全在庫をカタログ情報付きで取得
        const { data: inventoryItems } = await supabase
            .from('pos_inventory')
            .select('id, condition, catalog:pos_catalogs(api_card_id)')

        if (!inventoryItems || inventoryItems.length === 0) {
            return NextResponse.json({ success: true, data: { updated: 0, skipped: 0 } })
        }

        // api_card_id があるものだけ対象
        const targets = inventoryItems.filter((inv: any) => inv.catalog?.api_card_id)
        const skipped = inventoryItems.length - targets.length

        // card_id のユニークリスト
        const cardIds = [...new Set(targets.map((inv: any) => inv.catalog.api_card_id))]

        // ① Snkrdunk出品価格をIN句で一括取得
        const snkrdunkPrices: Record<string, Record<string, number>> = {}
        const { data: allSalePrices } = await supabase
            .from('sale_prices')
            .select('card_id, grade, price, created_at')
            .in('card_id', cardIds)
            .not('grade', 'is', null)
            .gt('price', 0)
            .order('created_at', { ascending: false })

        if (allSalePrices) {
            for (const p of allSalePrices) {
                if (!p.grade || !p.card_id) continue
                if (!snkrdunkPrices[p.card_id]) snkrdunkPrices[p.card_id] = {}
                // グレードごとに最新1件のみ
                if (!snkrdunkPrices[p.card_id][p.grade]) {
                    snkrdunkPrices[p.card_id][p.grade] = p.price
                }
            }
        }

        // ② 買取価格をIN句で一括取得
        const purchasePrices: Record<string, Record<string, number>> = {}
        const { data: allPurchasePrices } = await supabase
            .from('purchase_prices')
            .select('card_id, condition, price, created_at')
            .in('card_id', cardIds)
            .not('condition', 'is', null)
            .gt('price', 0)
            .order('created_at', { ascending: false })

        if (allPurchasePrices) {
            for (const p of allPurchasePrices) {
                if (!p.condition || !p.card_id) continue
                if (!purchasePrices[p.card_id]) purchasePrices[p.card_id] = {}
                // conditionごとに最新1件のみ
                if (!purchasePrices[p.card_id][p.condition]) {
                    purchasePrices[p.card_id][p.condition] = p.price
                }
            }
        }

        // ③ 海外価格をIN句で一括取得
        const overseasPrices: Record<string, { graded: number | null; loose: number | null }> = {}
        const { data: allOverseasPrices } = await supabase
            .from('overseas_prices')
            .select('card_id, graded_price_jpy, loose_price_jpy, created_at')
            .in('card_id', cardIds)
            .order('created_at', { ascending: false })

        if (allOverseasPrices) {
            for (const op of allOverseasPrices) {
                if (!op.card_id || overseasPrices[op.card_id]) continue  // 最新1件のみ
                overseasPrices[op.card_id] = {
                    graded: op.graded_price_jpy,
                    loose: op.loose_price_jpy,
                }
            }
        }

        // 各在庫のmarket_priceを計算（3ソースの平均）
        const updatePromises: PromiseLike<any>[] = []
        let updated = 0
        for (const inv of targets) {
            const cardId = (inv as any).catalog.api_card_id
            const mapping = getGradeMapping(inv.condition)
            const prices: number[] = []

            // Snkrdunk出品価格
            if (mapping.snkrdunkGrade && snkrdunkPrices[cardId]?.[mapping.snkrdunkGrade]) {
                prices.push(snkrdunkPrices[cardId][mapping.snkrdunkGrade])
            }

            // 買取価格
            if (mapping.purchaseCondition && purchasePrices[cardId]?.[mapping.purchaseCondition]) {
                prices.push(purchasePrices[cardId][mapping.purchaseCondition])
            }

            // 海外価格
            if (mapping.overseasField && overseasPrices[cardId]) {
                const raw = mapping.overseasField === 'graded'
                    ? overseasPrices[cardId].graded
                    : overseasPrices[cardId].loose
                if (raw && raw > 0) {
                    prices.push(Math.round(raw * mapping.overseasDiscount))
                }
            }

            // 利用可能なソースの平均
            if (prices.length > 0) {
                const marketPrice = Math.round(prices.reduce((s, p) => s + p, 0) / prices.length)
                updatePromises.push(
                    supabase.from('pos_inventory')
                        .update({ market_price: marketPrice })
                        .eq('id', inv.id)
                        .then(() => {})
                )
                updated++
            }
        }

        // 更新を並列実行
        await Promise.all(updatePromises)

        return NextResponse.json({
            success: true,
            data: { updated, skipped },
        })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
