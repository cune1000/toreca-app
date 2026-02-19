import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// 条件→グレードマッピング
function getGradeMapping(condition: string): { snkrdunkGrade: string | null; overseasField: 'graded' | 'loose' | null; overseasDiscount: number } {
    const c = condition.toUpperCase()
    if (c === 'PSA10') return { snkrdunkGrade: 'PSA10', overseasField: 'graded', overseasDiscount: 1.0 }
    if (c === 'PSA9') return { snkrdunkGrade: 'PSA9', overseasField: 'graded', overseasDiscount: 0.7 }
    if (c === 'A') return { snkrdunkGrade: 'A', overseasField: 'loose', overseasDiscount: 1.0 }
    if (c === 'B') return { snkrdunkGrade: 'B', overseasField: null, overseasDiscount: 1.0 }
    return { snkrdunkGrade: null, overseasField: null, overseasDiscount: 1.0 }
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

        // Snkrdunk最新価格を一括取得（sale_pricesからgradeありのものを取得）
        const snkrdunkPrices: Record<string, Record<string, number>> = {}
        for (const cardId of cardIds) {
            const { data: prices } = await supabase
                .from('sale_prices')
                .select('grade, price, created_at')
                .eq('card_id', cardId)
                .not('grade', 'is', null)
                .order('created_at', { ascending: false })

            if (prices && prices.length > 0) {
                // グレードごとに最新1件のみ
                const gradeMap: Record<string, number> = {}
                for (const p of prices) {
                    if (p.grade && !gradeMap[p.grade] && p.price > 0) {
                        gradeMap[p.grade] = p.price
                    }
                }
                snkrdunkPrices[cardId] = gradeMap
            }
        }

        // 海外価格を一括取得
        const overseasPrices: Record<string, { graded: number | null; loose: number | null }> = {}
        for (const cardId of cardIds) {
            const { data: op } = await supabase
                .from('overseas_prices')
                .select('graded_price_jpy, loose_price_jpy')
                .eq('card_id', cardId)
                .order('created_at', { ascending: false })
                .limit(1)
                .single()

            if (op) {
                overseasPrices[cardId] = {
                    graded: op.graded_price_jpy,
                    loose: op.loose_price_jpy,
                }
            }
        }

        // 各在庫のmarket_priceを計算・更新
        let updated = 0
        for (const inv of targets) {
            const cardId = (inv as any).catalog.api_card_id
            const mapping = getGradeMapping(inv.condition)

            let snkrdunkPrice: number | null = null
            let overseasPrice: number | null = null

            // Snkrdunk価格
            if (mapping.snkrdunkGrade && snkrdunkPrices[cardId]) {
                snkrdunkPrice = snkrdunkPrices[cardId][mapping.snkrdunkGrade] || null
            }

            // 海外価格
            if (mapping.overseasField && overseasPrices[cardId]) {
                const raw = mapping.overseasField === 'graded'
                    ? overseasPrices[cardId].graded
                    : overseasPrices[cardId].loose
                if (raw && raw > 0) {
                    overseasPrice = Math.round(raw * mapping.overseasDiscount)
                }
            }

            // 平均計算
            let marketPrice: number | null = null
            if (snkrdunkPrice && overseasPrice) {
                marketPrice = Math.round((snkrdunkPrice + overseasPrice) / 2)
            } else if (snkrdunkPrice) {
                marketPrice = snkrdunkPrice
            } else if (overseasPrice) {
                marketPrice = overseasPrice
            }

            if (marketPrice !== null) {
                await supabase
                    .from('pos_inventory')
                    .update({ market_price: marketPrice })
                    .eq('id', inv.id)
                updated++
            }
        }

        return NextResponse.json({
            success: true,
            data: { updated, skipped },
        })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
