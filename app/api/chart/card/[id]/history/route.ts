import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const period = req.nextUrl.searchParams.get('period') || '30d'

    const periodDays: Record<string, number> = {
        '7d': 7,
        '30d': 30,
        '90d': 90,
        '1y': 365,
        'all': 9999,
    }
    const days = periodDays[period] || 30
    const fromDate = new Date(Date.now() - days * 86400000).toISOString()

    const supabase = createServiceClient()

    // overseas_prices と justtcg_price_history を並列取得
    let overseasQuery = supabase
        .from('overseas_prices')
        .select('recorded_at, loose_price_jpy, loose_price_usd, graded_price_jpy, graded_price_usd')
        .eq('card_id', id)
        .order('recorded_at', { ascending: true })

    let jtcgQuery = supabase
        .from('justtcg_price_history')
        .select('recorded_at, price_usd')
        .eq('card_id', id)
        .order('recorded_at', { ascending: true })

    if (period !== 'all') {
        overseasQuery = overseasQuery.gte('recorded_at', fromDate)
        jtcgQuery = jtcgQuery.gte('recorded_at', fromDate)
    }

    const [{ data, error }, { data: jtcgData }] = await Promise.all([overseasQuery, jtcgQuery])

    if (error) {
        console.error('Price history API error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 日付をキーにしてマージ
    const dateMap = new Map<string, any>()

    for (const row of (data || [])) {
        const date = (row.recorded_at || '').split('T')[0]
        if (!dateMap.has(date)) {
            dateMap.set(date, { date, loose_price_jpy: 0, loose_price_usd: 0, graded_price_jpy: 0, graded_price_usd: 0 })
        }
        const entry = dateMap.get(date)!
        entry.loose_price_jpy = row.loose_price_jpy || entry.loose_price_jpy
        entry.loose_price_usd = row.loose_price_usd || entry.loose_price_usd
        entry.graded_price_jpy = row.graded_price_jpy || entry.graded_price_jpy
        entry.graded_price_usd = row.graded_price_usd || entry.graded_price_usd
    }

    for (const row of (jtcgData || [])) {
        const date = (row.recorded_at || '').split('T')[0]
        if (!dateMap.has(date)) {
            dateMap.set(date, { date, loose_price_jpy: 0, loose_price_usd: 0, graded_price_jpy: 0, graded_price_usd: 0 })
        }
        dateMap.get(date)!.justtcg_nm_usd = row.price_usd
    }

    const result = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date))

    return NextResponse.json(result, {
        headers: {
            'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
        },
    })
}
