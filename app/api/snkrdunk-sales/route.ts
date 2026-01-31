import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

/**
 * スニダン売買履歴を取得
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const cardId = searchParams.get('cardId')
        const days = parseInt(searchParams.get('days') || '30')

        if (!cardId) {
            return NextResponse.json(
                { success: false, error: 'cardId is required' },
                { status: 400 }
            )
        }

        // 期間フィルタ
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - days)

        const { data, error } = await supabase
            .from('snkrdunk_sales_history')
            .select('*')
            .eq('card_id', cardId)
            .gte('sold_at', cutoffDate.toISOString())
            .order('sold_at', { ascending: true })

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
