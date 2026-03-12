import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, fetchAllPaginated } from '@/lib/supabase'

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

    const buildQuery = () => {
      let q = supabase
        .from('overseas_prices')
        .select('card_id, loose_price_usd, loose_price_jpy, graded_price_usd, graded_price_jpy, recorded_at')
        .eq('card_id', cardId)
        .order('recorded_at', { ascending: true })

      if (days) {
        const since = new Date()
        since.setDate(since.getDate() - days)
        q = q.gte('recorded_at', since.toISOString())
      }
      return q
    }

    const data = await fetchAllPaginated(buildQuery)

    return NextResponse.json({
      success: true,
      data,
    }, {
      headers: {
        'Cache-Control': 'private, s-maxage=3600, stale-while-revalidate=300',
      },
    })
  } catch (error: unknown) {
    console.error('Overseas prices fetch error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
