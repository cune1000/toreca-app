import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// POS用: api_card_id から相場情報を取得
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

        // スニダン売買履歴
        const { data: salesData } = await supabase
            .from('snkrdunk_sales_history')
            .select('price, grade, sold_at')
            .eq('card_id', cardId)
            .gt('price', 0)
            .gte('sold_at', cutoffStr)
            .order('sold_at', { ascending: false })
            .limit(100)

        // 買取価格
        const { data: purchaseData } = await supabase
            .from('purchase_prices')
            .select('price, created_at')
            .eq('card_id', cardId)
            .gt('price', 0)
            .gte('created_at', cutoffStr)
            .order('created_at', { ascending: false })
            .limit(50)

        // 最新の相場まとめ
        const sales = salesData || []
        const purchases = purchaseData || []

        const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null
        const latest = (arr: { price: number }[]) => arr.length > 0 ? arr[0].price : null

        // グレード別集計
        const psa10 = sales.filter(s => s.grade === 'PSA10')
        const gradeA = sales.filter(s => s.grade === 'A')
        const allSales = sales.filter(s => !s.grade?.includes('個') && !s.grade?.includes('BOX'))

        return NextResponse.json({
            success: true,
            data: {
                latestSalePrice: latest(allSales as any),
                avgSalePrice: avg(allSales.map(s => s.price)),
                psa10: { latest: latest(psa10 as any), avg: avg(psa10.map(s => s.price)), count: psa10.length },
                gradeA: { latest: latest(gradeA as any), avg: avg(gradeA.map(s => s.price)), count: gradeA.length },
                latestPurchasePrice: latest(purchases as any),
                avgPurchasePrice: avg(purchases.map(p => p.price)),
                salesCount: sales.length,
                purchasesCount: purchases.length,
                recentSales: sales.slice(0, 10).map(s => ({
                    price: s.price, grade: s.grade, date: s.sold_at,
                })),
                recentPurchases: purchases.slice(0, 5).map(p => ({
                    price: p.price, date: p.created_at,
                })),
            },
        })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
