import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * 日次価格インデックス集計
 * 毎朝7:00 JST実行（Cronジョブ）
 * 
 * 集計対象:
 * 1. スニダン売買履歴（PSA10, 状態A）
 * 2. 買取価格（最新）
 */
export async function GET(req: Request) {
    try {
        // CRON_SECRET認証
        const authHeader = req.headers.get('authorization')
        const cronSecret = process.env.CRON_SECRET

        if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            )
        }

        const supabase = createServiceClient()

        // 前日の日付を計算（JST）
        const now = new Date()
        const jstOffset = 9 * 60 * 60 * 1000
        const jstNow = new Date(now.getTime() + jstOffset)
        jstNow.setDate(jstNow.getDate() - 1)
        const targetDate = jstNow.toISOString().split('T')[0]

        console.log(`[Price Index] Aggregating for date: ${targetDate}`)

        const results: any[] = []

        // ==========================================================================
        // 1. スニダン売買履歴を集計（sale）
        // ==========================================================================
        const { data: salesData, error: salesError } = await supabase.rpc(
            'aggregate_snkrdunk_sales',
            { target_date: targetDate }
        )

        if (salesError) {
            console.error('Sales aggregation error:', salesError)
        } else if (salesData) {
            for (const row of salesData) {
                results.push({
                    date: targetDate,
                    category: row.category,
                    rarity: row.rarity || 'UNKNOWN',
                    grade: row.grade,
                    price_type: 'sale',
                    avg_price: Math.round(row.avg_price),
                    median_price: Math.round(row.median_price || row.avg_price),
                    card_count: row.card_count,
                    trade_count: row.trade_count
                })
            }
        }

        // ==========================================================================
        // 2. 買取価格を集計（purchase）
        // ==========================================================================
        const { data: purchaseData, error: purchaseError } = await supabase.rpc(
            'aggregate_purchase_prices',
            { target_date: targetDate }
        )

        if (purchaseError) {
            console.error('Purchase aggregation error:', purchaseError)
        } else if (purchaseData) {
            for (const row of purchaseData) {
                results.push({
                    date: targetDate,
                    category: row.category,
                    rarity: row.rarity || 'UNKNOWN',
                    grade: 'ALL', // 買取は状態グレードなし
                    price_type: 'purchase',
                    avg_price: Math.round(row.avg_price),
                    median_price: Math.round(row.median_price || row.avg_price),
                    card_count: row.card_count,
                    trade_count: row.trade_count
                })
            }
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

        console.log(`[Price Index] Saved ${results.length} records`)

        return NextResponse.json({
            success: true,
            date: targetDate,
            count: results.length,
            results: results.slice(0, 10) // サンプル表示
        })

    } catch (error: any) {
        console.error('[Price Index] Error:', error)
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}
