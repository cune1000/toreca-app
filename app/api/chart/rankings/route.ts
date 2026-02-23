import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { CATEGORY_SLUG_MAP } from '@/lib/chart/constants'

export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl
    const type = searchParams.get('type') || 'loose_up_pct'
    const category = searchParams.get('category') || 'all'
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 50)

    // type から priceType と sortBy を解決
    const RANKING_MAP: Record<string, { priceType: 'loose' | 'graded' | 'purchase'; sortBy: string }> = {
        loose_up_pct: { priceType: 'loose', sortBy: 'change_pct_desc' },
        loose_down_pct: { priceType: 'loose', sortBy: 'change_pct_asc' },
        graded_up_pct: { priceType: 'graded', sortBy: 'change_pct_desc' },
        graded_down_pct: { priceType: 'graded', sortBy: 'change_pct_asc' },
        high_price_loose: { priceType: 'loose', sortBy: 'price_desc' },
        purchase_up_pct: { priceType: 'purchase', sortBy: 'change_pct_desc' },
        purchase_down_pct: { priceType: 'purchase', sortBy: 'change_pct_asc' },
    }

    const config = RANKING_MAP[type]
    if (!config) {
        return NextResponse.json({ error: 'Invalid ranking type' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const categoryFilter = category !== 'all' ? CATEGORY_SLUG_MAP[category] || null : null

    // 買取ランキングは chart_daily_card_prices を使用
    if (config.priceType === 'purchase') {
        return handlePurchaseRanking(supabase, config.sortBy, categoryFilter, limit)
    }

    // 海外相場ランキング
    const priceCol = config.priceType === 'graded' ? 'graded_price_jpy' : 'loose_price_jpy'
    const priceColUsd = config.priceType === 'graded' ? 'graded_price_usd' : 'loose_price_usd'

    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()

    // overseas_prices から最新30日分を取得
    let query = supabase
        .from('overseas_prices')
        .select(`
            card_id,
            ${priceCol},
            ${priceColUsd},
            recorded_at,
            cards!inner (
                id,
                name,
                image_url,
                card_number,
                pricecharting_id,
                rarity:rarity_id (name),
                category:category_large_id (name)
            )
        `)
        .gte('recorded_at', thirtyDaysAgo)
        .not(priceCol, 'is', null)
        .order('recorded_at', { ascending: false })

    if (categoryFilter) {
        query = query.eq('cards.category.name', categoryFilter)
    }

    const { data: priceData, error } = await query

    if (error) {
        console.error('Rankings API error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!priceData?.length) {
        return NextResponse.json([])
    }

    // カードごとに最新価格と過去価格を集計
    const cardMap = new Map<string, {
        card: any
        latestPrice: number
        latestPriceUsd: number
        latestDate: string
        prices: { date: string; price: number }[]
    }>()

    for (const row of priceData) {
        const cardId = row.card_id
        const price = (row as any)[priceCol]
        const priceUsd = (row as any)[priceColUsd]
        if (!price || !cardId) continue

        const dateStr = (row.recorded_at || '').split('T')[0]

        const existing = cardMap.get(cardId)
        if (!existing) {
            cardMap.set(cardId, {
                card: (row as any).cards,
                latestPrice: price,
                latestPriceUsd: priceUsd || 0,
                latestDate: row.recorded_at || '',
                prices: [{ date: dateStr, price }],
            })
        } else {
            if ((row.recorded_at || '') > existing.latestDate) {
                existing.latestPrice = price
                existing.latestPriceUsd = priceUsd || 0
                existing.latestDate = row.recorded_at || ''
            }
            existing.prices.push({ date: dateStr, price })
        }
    }

    // 変動率計算
    const now = new Date()
    const dayAgo = new Date(now.getTime() - 86400000).toISOString().split('T')[0]
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0]
    const monthAgo = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0]

    const cards = Array.from(cardMap.entries()).map(([id, data]) => {
        // 各期間に最も近い価格を取得
        const findClosestPrice = (targetDate: string) => {
            const sorted = data.prices
                .filter(p => p.date <= targetDate)
                .sort((a, b) => b.date.localeCompare(a.date))
            return sorted[0]?.price
        }

        const calcChange = (oldPrice?: number) => {
            if (!oldPrice || oldPrice === 0) return 0
            return ((data.latestPrice - oldPrice) / oldPrice) * 100
        }

        const yesterdayPrice = findClosestPrice(dayAgo)
        const weekPrice = findClosestPrice(weekAgo)
        const monthPrice = findClosestPrice(monthAgo)

        return {
            id,
            name: data.card?.name || '',
            image_url: data.card?.image_url || '',
            category: data.card?.category?.name || '',
            rarity: data.card?.rarity?.name || '',
            card_number: data.card?.card_number || '',
            loose_price_jpy: config.priceType === 'loose' ? data.latestPrice : 0,
            loose_price_usd: config.priceType === 'loose' ? data.latestPriceUsd : 0,
            graded_price_jpy: config.priceType === 'graded' ? data.latestPrice : 0,
            graded_price_usd: config.priceType === 'graded' ? data.latestPriceUsd : 0,
            price_change_24h: calcChange(yesterdayPrice),
            price_change_7d: calcChange(weekPrice),
            price_change_30d: calcChange(monthPrice),
            display_price: data.latestPrice,
            display_price_usd: data.latestPriceUsd,
        }
    })

    // ソート
    switch (config.sortBy) {
        case 'change_pct_desc':
            cards.sort((a, b) => b.price_change_30d - a.price_change_30d)
            break
        case 'change_pct_asc':
            cards.sort((a, b) => a.price_change_30d - b.price_change_30d)
            break
        case 'price_desc':
            cards.sort((a, b) => b.display_price - a.display_price)
            break
    }

    const result = cards.slice(0, limit)

    return NextResponse.json(result, {
        headers: {
            'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
        },
    })
}

// ============================================================================
// 買取ランキング（chart_daily_card_prices ベース）
// ============================================================================

async function handlePurchaseRanking(
    supabase: any,
    sortBy: string,
    categoryFilter: string | null,
    limit: number,
) {
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

    let query = supabase
        .from('chart_daily_card_prices')
        .select(`
            card_id,
            date,
            purchase_avg,
            cards!inner (
                id,
                name,
                image_url,
                card_number,
                rarity:rarity_id (name),
                category:category_large_id (name)
            )
        `)
        .gte('date', monthAgo)
        .not('purchase_avg', 'is', null)

    if (categoryFilter) {
        query = query.eq('cards.category.name', categoryFilter)
    }

    const { data: priceData, error } = await query

    if (error) {
        console.error('Purchase rankings API error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!priceData?.length) {
        return NextResponse.json([])
    }

    // カードごとに集計
    const cardMap = new Map<string, {
        card: any
        latestPrice: number
        latestDate: string
        prices: { date: string; price: number }[]
    }>()

    for (const row of priceData) {
        const cardId = row.card_id
        const price = row.purchase_avg
        if (!price || !cardId) continue

        const existing = cardMap.get(cardId)
        if (!existing) {
            cardMap.set(cardId, {
                card: (row as any).cards,
                latestPrice: price,
                latestDate: row.date,
                prices: [{ date: row.date, price }],
            })
        } else {
            if (row.date > existing.latestDate) {
                existing.latestPrice = price
                existing.latestDate = row.date
            }
            existing.prices.push({ date: row.date, price })
        }
    }

    const now = new Date()
    const dayAgo = new Date(now.getTime() - 86400000).toISOString().split('T')[0]
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0]
    const monthAgoStr = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0]

    const cards = Array.from(cardMap.entries()).map(([id, data]) => {
        const findClosestPrice = (targetDate: string) => {
            const sorted = data.prices
                .filter(p => p.date <= targetDate)
                .sort((a, b) => b.date.localeCompare(a.date))
            return sorted[0]?.price
        }

        const calcChange = (oldPrice?: number) => {
            if (!oldPrice || oldPrice === 0) return 0
            return ((data.latestPrice - oldPrice) / oldPrice) * 100
        }

        return {
            id,
            name: data.card?.name || '',
            image_url: data.card?.image_url || '',
            category: data.card?.category?.name || '',
            rarity: data.card?.rarity?.name || '',
            card_number: data.card?.card_number || '',
            loose_price_jpy: 0,
            loose_price_usd: 0,
            graded_price_jpy: 0,
            graded_price_usd: 0,
            price_change_24h: calcChange(findClosestPrice(dayAgo)),
            price_change_7d: calcChange(findClosestPrice(weekAgo)),
            price_change_30d: calcChange(findClosestPrice(monthAgoStr)),
            display_price: data.latestPrice,
            display_price_usd: 0,
        }
    })

    switch (sortBy) {
        case 'change_pct_desc':
            cards.sort((a, b) => b.price_change_30d - a.price_change_30d)
            break
        case 'change_pct_asc':
            cards.sort((a, b) => a.price_change_30d - b.price_change_30d)
            break
    }

    return NextResponse.json(cards.slice(0, limit), {
        headers: {
            'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
        },
    })
}
