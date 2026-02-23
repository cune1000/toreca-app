import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params
    const supabase = createServiceClient()

    // カード基本情報
    const { data: card, error: cardError } = await supabase
        .from('cards')
        .select(`
            id,
            name,
            image_url,
            card_number,
            pricecharting_id,
            pricecharting_url,
            rarity:rarity_id (name),
            category:category_large_id (name)
        `)
        .eq('id', id)
        .single()

    if (cardError || !card) {
        return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    }

    // 最新の overseas_prices を取得（最新31日分）
    const { data: latestPrices } = await supabase
        .from('overseas_prices')
        .select('loose_price_jpy, loose_price_usd, graded_price_jpy, graded_price_usd, recorded_at')
        .eq('card_id', id)
        .order('recorded_at', { ascending: false })
        .limit(31)

    const latest = latestPrices?.[0]
    const yesterday = latestPrices?.find((_, i) => i > 0)
    const weekAgo = latestPrices?.find((_, i) => i >= 7)
    const monthAgo = latestPrices?.find((_, i) => i >= 30)

    const calcChange = (oldPrice?: number | null, newPrice?: number | null) => {
        if (!oldPrice || !newPrice || oldPrice === 0) return 0
        return ((newPrice - oldPrice) / oldPrice) * 100
    }

    // 最高値・最安値（loose_price_jpy）
    const { data: maxPrice } = await supabase
        .from('overseas_prices')
        .select('loose_price_jpy')
        .eq('card_id', id)
        .not('loose_price_jpy', 'is', null)
        .order('loose_price_jpy', { ascending: false })
        .limit(1)

    const { data: minPrice } = await supabase
        .from('overseas_prices')
        .select('loose_price_jpy')
        .eq('card_id', id)
        .not('loose_price_jpy', 'is', null)
        .order('loose_price_jpy', { ascending: true })
        .limit(1)

    const result = {
        id: (card as any).id,
        name: (card as any).name,
        image_url: (card as any).image_url,
        category: (card as any).category?.name || '',
        rarity: (card as any).rarity?.name || '',
        card_number: (card as any).card_number || '',
        pricecharting_id: (card as any).pricecharting_id || null,
        pricecharting_url: (card as any).pricecharting_url || null,
        loose_price_jpy: latest?.loose_price_jpy || 0,
        loose_price_usd: latest?.loose_price_usd || 0,
        graded_price_jpy: latest?.graded_price_jpy || 0,
        graded_price_usd: latest?.graded_price_usd || 0,
        price_change_24h: calcChange(yesterday?.loose_price_jpy, latest?.loose_price_jpy),
        price_change_7d: calcChange(weekAgo?.loose_price_jpy, latest?.loose_price_jpy),
        price_change_30d: calcChange(monthAgo?.loose_price_jpy, latest?.loose_price_jpy),
        display_price: latest?.loose_price_jpy || 0,
        display_price_usd: latest?.loose_price_usd || 0,
        high_price: maxPrice?.[0]?.loose_price_jpy || 0,
        low_price: minPrice?.[0]?.loose_price_jpy || 0,
    }

    return NextResponse.json(result, {
        headers: {
            'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
        },
    })
}
