import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const period = req.nextUrl.searchParams.get('period') || '30d'

    const periodDays: Record<string, number> = {
        '30d': 30,
        '90d': 90,
        '1y': 365,
        'all': 9999,
    }
    const days = periodDays[period] || 30
    const fromDate = new Date(Date.now() - days * 86400000).toISOString()

    const supabase = createServiceClient()

    let query = supabase
        .from('overseas_prices')
        .select('recorded_at, loose_price_jpy, loose_price_usd, graded_price_jpy, graded_price_usd')
        .eq('card_id', id)
        .order('recorded_at', { ascending: true })

    if (period !== 'all') {
        query = query.gte('recorded_at', fromDate)
    }

    const { data, error } = await query

    if (error) {
        console.error('Price history API error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const result = (data || []).map(row => ({
        date: (row.recorded_at || '').split('T')[0],
        loose_price_jpy: row.loose_price_jpy || 0,
        loose_price_usd: row.loose_price_usd || 0,
        graded_price_jpy: row.graded_price_jpy || 0,
        graded_price_usd: row.graded_price_usd || 0,
    }))

    return NextResponse.json(result, {
        headers: {
            'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
        },
    })
}
