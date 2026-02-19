import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// 統計サマリー
export async function GET() {
    try {
        const today = new Date().toISOString().split('T')[0]

        // 在庫データ（market_price, predicted_price含む）
        const { data: inventory } = await supabase
            .from('pos_inventory')
            .select('quantity, avg_purchase_price, market_price, predicted_price, catalog:pos_catalogs(fixed_price)')

        const totalItems = (inventory || []).reduce((s: number, i: any) => s + i.quantity, 0)
        const totalKinds = (inventory || []).length
        const totalCost = (inventory || []).reduce(
            (s: number, i: any) => s + i.avg_purchase_price * i.quantity, 0
        )
        const estimatedValue = (inventory || []).reduce(
            (s: number, i: any) => s + (i.catalog?.fixed_price || i.avg_purchase_price) * i.quantity, 0
        )

        // 予測販売総額（predicted_price >> market_price >> fixed_price >> avg_purchase_price）
        const predictedSaleTotal = (inventory || []).reduce(
            (s: number, i: any) => {
                const price = i.predicted_price ?? i.market_price ?? i.catalog?.fixed_price ?? i.avg_purchase_price
                return s + price * i.quantity
            }, 0
        )

        // 仕入れ費用合計（全取引の expenses を合算）
        const { data: allPurchaseTx } = await supabase
            .from('pos_transactions')
            .select('expenses')
            .eq('type', 'purchase')

        const totalExpenses = (allPurchaseTx || []).reduce((s: number, t: any) => s + (t.expenses || 0), 0)

        // 本日の取引
        const { data: todayTx } = await supabase
            .from('pos_transactions')
            .select('type, total_price, profit, expenses')
            .eq('transaction_date', today)

        const todayPurchase = (todayTx || [])
            .filter((t: any) => t.type === 'purchase')
            .reduce((s: number, t: any) => s + t.total_price, 0)
        const todaySale = (todayTx || [])
            .filter((t: any) => t.type === 'sale')
            .reduce((s: number, t: any) => s + t.total_price, 0)
        const todayProfit = (todayTx || [])
            .filter((t: any) => t.type === 'sale')
            .reduce((s: number, t: any) => s + (t.profit || 0), 0)
        const todayExpenses = (todayTx || [])
            .filter((t: any) => t.type === 'purchase')
            .reduce((s: number, t: any) => s + (t.expenses || 0), 0)

        return NextResponse.json({
            success: true,
            data: {
                totalItems,
                totalKinds,
                totalCost,
                estimatedValue,
                estimatedProfit: estimatedValue - totalCost,
                predictedSaleTotal,
                predictedProfit: predictedSaleTotal - totalCost,
                totalExpenses,
                todayPurchase,
                todaySale,
                todayProfit,
                todayExpenses,
            },
        })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
