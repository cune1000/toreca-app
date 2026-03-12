import { NextResponse } from 'next/server'
import { createServiceClient, fetchAllPaginated } from '@/lib/supabase'

/**
 * スニダン売買履歴を取得
 * サービスロールクライアントを使用（RLSバイパス）
 */
export async function GET(req: Request) {
    try {
        const supabase = createServiceClient()
        const { searchParams } = new URL(req.url)
        const cardId = searchParams.get('cardId')
        const daysParam = searchParams.get('days')
        const days = daysParam !== null ? parseInt(daysParam) : 30

        if (!cardId) {
            return NextResponse.json(
                { success: false, error: 'cardId is required' },
                { status: 400 }
            )
        }

        // 期間フィルタ（days=0 は全期間）、1000行制限回避
        const buildQuery = () => {
            let q = supabase
                .from('snkrdunk_sales_history')
                .select('id, card_id, grade, price, sold_at, product_type, size, condition, label')
                .eq('card_id', cardId)
                .order('sold_at', { ascending: true })

            if (days > 0) {
                const cutoffDate = new Date()
                cutoffDate.setDate(cutoffDate.getDate() - days)
                q = q.gte('sold_at', cutoffDate.toISOString())
            }
            return q
        }

        const data = await fetchAllPaginated(buildQuery)

        return NextResponse.json({ success: true, data }, {
            headers: {
                'Cache-Control': 'private, s-maxage=300, stale-while-revalidate=60',
            },
        })
    } catch (error: unknown) {
        console.error('API error:', error)
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        )
    }
}
