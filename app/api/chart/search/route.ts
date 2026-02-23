import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { CATEGORY_SLUG_MAP } from '@/lib/chart/constants'

export async function GET(req: NextRequest) {
    const { searchParams } = req.nextUrl
    const q = searchParams.get('q') || ''
    const category = searchParams.get('category') || 'all'

    if (!q || q.length < 1) {
        return NextResponse.json([])
    }

    const supabase = createServiceClient()

    // カード検索
    let cardQuery = supabase
        .from('cards')
        .select(`
            id,
            name,
            image_url,
            card_number,
            pricecharting_id,
            rarity:rarity_id (name),
            category:category_large_id (name)
        `)
        .ilike('name', `%${q}%`)
        .limit(50)

    if (category !== 'all') {
        const catName = CATEGORY_SLUG_MAP[category]
        if (catName) {
            cardQuery = cardQuery.eq('category.name', catName)
        }
    }

    const { data: cards, error } = await cardQuery
    if (error || !cards) {
        return NextResponse.json([])
    }

    // 各カードの最新 overseas_prices を取得
    const cardIds = cards.map((c: any) => c.id)
    if (cardIds.length === 0) {
        return NextResponse.json([])
    }

    const { data: prices } = await supabase
        .from('overseas_prices')
        .select('card_id, loose_price_jpy, loose_price_usd, graded_price_jpy, graded_price_usd, recorded_at')
        .in('card_id', cardIds)
        .order('recorded_at', { ascending: false })

    // カードごとの最新価格マップ
    const priceMap = new Map<string, {
        loose_price_jpy: number
        loose_price_usd: number
        graded_price_jpy: number
        graded_price_usd: number
    }>()

    prices?.forEach(p => {
        if (!priceMap.has(p.card_id)) {
            priceMap.set(p.card_id, {
                loose_price_jpy: p.loose_price_jpy || 0,
                loose_price_usd: p.loose_price_usd || 0,
                graded_price_jpy: p.graded_price_jpy || 0,
                graded_price_usd: p.graded_price_usd || 0,
            })
        }
    })

    const result = cards.map((card: any) => {
        const price = priceMap.get(card.id)
        return {
            id: card.id,
            name: card.name,
            image_url: card.image_url,
            category: card.category?.name || '',
            rarity: card.rarity?.name || '',
            card_number: card.card_number || '',
            loose_price_jpy: price?.loose_price_jpy || 0,
            loose_price_usd: price?.loose_price_usd || 0,
            graded_price_jpy: price?.graded_price_jpy || 0,
            graded_price_usd: price?.graded_price_usd || 0,
            price_change_24h: 0,
            price_change_7d: 0,
            price_change_30d: 0,
            display_price: price?.loose_price_jpy || 0,
            display_price_usd: price?.loose_price_usd || 0,
        }
    })

    return NextResponse.json(result, {
        headers: {
            'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=300',
        },
    })
}
