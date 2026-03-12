import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, fetchAllPaginated } from '@/lib/supabase'

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
  try {
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

    // overseas_prices と justtcg_price_history を並列取得（1000行制限回避）
    const buildOverseasQuery = () => {
        let q = supabase
            .from('overseas_prices')
            .select('recorded_at, loose_price_jpy, loose_price_usd, graded_price_jpy, graded_price_usd')
            .eq('card_id', id)
            .order('recorded_at', { ascending: true })
        if (period !== 'all') q = q.gte('recorded_at', fromDate)
        return q
    }

    const buildJtcgQuery = () => {
        let q = supabase
            .from('justtcg_price_history')
            .select('recorded_at, price_usd')
            .eq('card_id', id)
            .order('recorded_at', { ascending: true })
        if (period !== 'all') q = q.gte('recorded_at', fromDate)
        return q
    }

    const [data, jtcgData] = await Promise.all([
        fetchAllPaginated(buildOverseasQuery),
        fetchAllPaginated(buildJtcgQuery),
    ])

    // 日付をキーにしてマージ（デフォルトは null = データなし）
    const dateMap = new Map<string, any>()

    for (const row of (data || [])) {
        const date = (row.recorded_at || '').split('T')[0]
        if (!dateMap.has(date)) {
            dateMap.set(date, { date, loose_price_jpy: null, loose_price_usd: null, graded_price_jpy: null, graded_price_usd: null })
        }
        const entry = dateMap.get(date)!
        if (row.loose_price_jpy != null) entry.loose_price_jpy = row.loose_price_jpy
        if (row.loose_price_usd != null) entry.loose_price_usd = row.loose_price_usd
        if (row.graded_price_jpy != null) entry.graded_price_jpy = row.graded_price_jpy
        if (row.graded_price_usd != null) entry.graded_price_usd = row.graded_price_usd
    }

    for (const row of (jtcgData || [])) {
        const date = (row.recorded_at || '').split('T')[0]
        if (!dateMap.has(date)) {
            dateMap.set(date, { date, loose_price_jpy: null, loose_price_usd: null, graded_price_jpy: null, graded_price_usd: null })
        }
        dateMap.get(date)!.justtcg_nm_usd = row.price_usd
    }

    const sorted = Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date))

    // 前方補完: 各系列で初回データ取得後の欠損は直前の値で埋める
    const priceKeys = ['loose_price_jpy', 'loose_price_usd', 'graded_price_jpy', 'graded_price_usd', 'justtcg_nm_usd'] as const
    const lastSeen: Record<string, number | null> = {}
    for (const key of priceKeys) lastSeen[key] = null

    for (const entry of sorted) {
        for (const key of priceKeys) {
            if (entry[key] != null && entry[key] > 0) {
                // 実データがある → 記憶を更新
                lastSeen[key] = entry[key]
            } else if (lastSeen[key] != null) {
                // 初回データ取得済みだが今回欠損 → 前日値で補完
                entry[key] = lastSeen[key]
            }
            // lastSeen が null = まだ初回データなし → null のまま（線を描かない）
        }
    }

    const result = sorted

    return NextResponse.json(result, {
        headers: {
            'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
        },
    })
  } catch (error: unknown) {
    console.error('Chart history API error:', error)
    return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal server error' },
        { status: 500 }
    )
  }
}
