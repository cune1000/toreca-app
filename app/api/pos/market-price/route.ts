import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// POS用: api_card_id から相場情報を取得（見込み利益計算用）
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const cardId = searchParams.get('card_id')
        if (!cardId) {
            return NextResponse.json({ success: false, error: 'card_id required' }, { status: 400 })
        }

        const days = parseInt(searchParams.get('days') || '30')
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - days)
        const cutoffStr = cutoff.toISOString()

        // 並行取得
        const [salesRes, purchaseRes, saleRes] = await Promise.all([
            // スニダン売買履歴
            supabase
                .from('snkrdunk_sales_history')
                .select('price, grade, sold_at')
                .eq('card_id', cardId)
                .gt('price', 0)
                .gte('sold_at', cutoffStr)
                .order('sold_at', { ascending: false })
                .limit(200),
            // 買取価格（各サイト）
            supabase
                .from('purchase_prices')
                .select('price, created_at')
                .eq('card_id', cardId)
                .gt('price', 0)
                .gte('created_at', cutoffStr)
                .order('created_at', { ascending: false })
                .limit(50),
            // 販売価格（各サイト）
            supabase
                .from('sale_prices')
                .select('price, created_at')
                .eq('card_id', cardId)
                .gt('price', 0)
                .gte('created_at', cutoffStr)
                .order('created_at', { ascending: false })
                .limit(50),
        ])

        const sales = salesRes.data || []
        const purchases = purchaseRes.data || []
        const shopSales = saleRes.data || []

        const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null
        const latest = (arr: { price: number }[]) => arr.length > 0 ? arr[0].price : null

        // グレード別分類
        const psa10 = sales.filter(s => s.grade === 'PSA10')
        const gradeA = sales.filter(s => s.grade === 'A')
        const boxSales = sales.filter(s => s.grade?.includes('個') || s.grade?.includes('BOX'))
        const singleSales = sales.filter(s => !s.grade?.includes('個') && !s.grade?.includes('BOX'))

        // BOX は 1BOX あたりの単価に正規化
        const boxUnitPrices = boxSales.map(s => {
            const match = s.grade?.match(/(\d+)/)
            const quantity = match ? parseInt(match[1]) : 1
            return Math.round(s.price / quantity)
        })

        // カードの種別判定（BOXかシングルか）
        // BOX取引が存在すればBOX、それ以外はシングル
        const isBox = boxSales.length > singleSales.length

        // 日次平均推移 (直近7日分で最新を返す)
        const byDate: Record<string, {
            psa10: number[], a: number[], box: number[],
            purchase: number[], shopSale: number[], allSingle: number[]
        }> = {}

        const ensureDate = (dateStr: string) => {
            const d = new Date(dateStr).toISOString().split('T')[0]
            if (!byDate[d]) {
                byDate[d] = { psa10: [], a: [], box: [], purchase: [], shopSale: [], allSingle: [] }
            }
            return byDate[d]
        }

        for (const s of sales) {
            if (s.grade === 'PSA10') {
                ensureDate(s.sold_at).psa10.push(s.price)
            } else if (s.grade === 'A') {
                ensureDate(s.sold_at).a.push(s.price)
            } else if (s.grade?.includes('個') || s.grade?.includes('BOX')) {
                const match = s.grade.match(/(\d+)/)
                const qty = match ? parseInt(match[1]) : 1
                ensureDate(s.sold_at).box.push(Math.round(s.price / qty))
            } else {
                ensureDate(s.sold_at).allSingle.push(s.price)
            }
        }
        for (const p of purchases) ensureDate(p.created_at).purchase.push(p.price)
        for (const s of shopSales) ensureDate(s.created_at).shopSale.push(s.price)

        const dailyData = Object.entries(byDate)
            .map(([date, d]) => ({
                date,
                psa10_avg: avg(d.psa10), psa10_count: d.psa10.length,
                a_avg: avg(d.a), a_count: d.a.length,
                box_avg: avg(d.box), box_count: d.box.length,
                single_avg: avg(d.allSingle), single_count: d.allSingle.length,
                purchase_avg: avg(d.purchase), purchase_count: d.purchase.length,
                shop_sale_avg: avg(d.shopSale), shop_sale_count: d.shopSale.length,
            }))
            .sort((a, b) => b.date.localeCompare(a.date)) // 新しい順

        // 直近の相場（estimatedMarketPrice）= 見込み利益の基準値
        // BOX: 直近のBOX売買平均
        // シングル: PSA10 + A + サイト販売の直近平均
        const latestPsa10 = latest(psa10 as any)
        const latestGradeA = latest(gradeA as any)
        const latestBoxUnit = boxUnitPrices.length > 0 ? boxUnitPrices[0] : null
        const latestShopSale = latest(shopSales as any)
        const latestPurchasePrice = latest(purchases as any)

        return NextResponse.json({
            success: true,
            data: {
                isBox,
                // --- BOX用 ---
                box: {
                    latestUnitPrice: latestBoxUnit,
                    avgUnitPrice: avg(boxUnitPrices),
                    count: boxSales.length,
                },
                // --- シングル用 ---
                psa10: {
                    latest: latestPsa10,
                    avg: avg(psa10.map(s => s.price)),
                    count: psa10.length,
                },
                gradeA: {
                    latest: latestGradeA,
                    avg: avg(gradeA.map(s => s.price)),
                    count: gradeA.length,
                },
                // --- 共通 ---
                shopSale: {
                    latest: latestShopSale,
                    avg: avg(shopSales.map(s => s.price)),
                    count: shopSales.length,
                },
                purchase: {
                    latest: latestPurchasePrice,
                    avg: avg(purchases.map(p => p.price)),
                    count: purchases.length,
                },
                // 日次推移（新しい順、最大30日分）
                daily: dailyData.slice(0, 30),
                // 直近取引一覧
                recentSales: sales.slice(0, 10).map(s => ({
                    price: s.price, grade: s.grade, date: s.sold_at,
                })),
                recentPurchases: purchases.slice(0, 5).map(p => ({
                    price: p.price, date: p.created_at,
                })),
                recentShopSales: shopSales.slice(0, 5).map(s => ({
                    price: s.price, date: s.created_at,
                })),
            },
        })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
