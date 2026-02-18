import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

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

        // 期間フィルタ（days=0 は全期間）
        let query = supabase
            .from('snkrdunk_sales_history')
            .select('*')
            .eq('card_id', cardId)
            .order('sold_at', { ascending: true })

        if (days > 0) {
            const cutoffDate = new Date()
            cutoffDate.setDate(cutoffDate.getDate() - days)
            query = query.gte('sold_at', cutoffDate.toISOString())
        }

        const { data, error } = await query

        if (error) {
            console.error('Database query error:', error)
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 500 }
            )
        }

        return NextResponse.json({ success: true, data: data || [] })
    } catch (error: any) {
        console.error('API error:', error)
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}
