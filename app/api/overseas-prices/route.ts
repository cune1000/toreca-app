import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, TABLES } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * 海外価格履歴取得
 * GET /api/overseas-prices?card_id=xxx&days=30
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const cardId = searchParams.get('card_id')
    const daysParam = searchParams.get('days')
    const days = daysParam !== null ? parseInt(daysParam) : 30

    if (!cardId) {
      return NextResponse.json(
        { success: false, error: 'card_id は必須です' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()
    let query = supabase
      .from(TABLES.OVERSEAS_PRICES)
      .select('*')
      .eq('card_id', cardId)
      .order('recorded_at', { ascending: true })

    if (days) {
      const since = new Date()
      since.setDate(since.getDate() - days)
      query = query.gte('recorded_at', since.toISOString())
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: data || [],
    })
  } catch (error: any) {
    console.error('Overseas prices fetch error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
