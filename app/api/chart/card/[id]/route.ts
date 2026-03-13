import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { normalizeCondition } from '@/lib/condition'

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServiceClient()

    // カード基本情報
    const { data: card, error: cardError } = await supabase
        .from('cards')
        .select(`
            id,
            name,
            name_en,
            image_url,
            card_number,
            expansion,
            set_name_en,
            release_date,
            pricecharting_id,
            pricecharting_url,
            rarity
        `)
        .eq('id', id)
        .single()

    if (cardError || !card) {
        return NextResponse.json({ error: 'Card not found' }, { status: 404 })
    }

    // 全サブクエリを並列実行
    const [
        { data: latestPrices, error: e1 },
        { data: maxPrice, error: e2 },
        { data: minPrice, error: e3 },
        { data: purchaseData, error: e4 },
    ] = await Promise.all([
        // 最新の overseas_prices を取得（最新31日分）
        supabase
            .from('overseas_prices')
            .select('loose_price_jpy, loose_price_usd, graded_price_jpy, graded_price_usd, recorded_at')
            .eq('card_id', id)
            .order('recorded_at', { ascending: false })
            .limit(31),
        // 最高値（loose_price_jpy）
        supabase
            .from('overseas_prices')
            .select('loose_price_jpy')
            .eq('card_id', id)
            .not('loose_price_jpy', 'is', null)
            .order('loose_price_jpy', { ascending: false })
            .limit(1),
        // 最安値（loose_price_jpy）
        supabase
            .from('overseas_prices')
            .select('loose_price_jpy')
            .eq('card_id', id)
            .not('loose_price_jpy', 'is', null)
            .order('loose_price_jpy', { ascending: true })
            .limit(1),
        // 買取価格（店舗別・条件別）
        supabase
            .from('purchase_prices')
            .select('price, condition, created_at, shop:shop_id(name, icon), link:link_id(label)')
            .eq('card_id', id)
            .gt('price', 0)
            .order('created_at', { ascending: false })
            .limit(200),
    ])

    const subErrors = [e1, e2, e3, e4].filter(Boolean)
    if (subErrors.length > 0) {
        console.error('Chart card sub-query errors:', subErrors.map(e => e!.message))
    }

    const latest = latestPrices?.[0]
    // 日付ベースで変動率計算（インデックスベースだと欠損日でずれる）
    const now = new Date()
    const dayAgoStr = new Date(now.getTime() - 86400000).toISOString().split('T')[0]
    const weekAgoStr = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0]
    const monthAgoStr = new Date(now.getTime() - 30 * 86400000).toISOString().split('T')[0]
    const findClosest = (target: string) =>
        latestPrices?.filter(r => (r.recorded_at || '').split('T')[0] <= target)
            .sort((a, b) => (b.recorded_at || '').localeCompare(a.recorded_at || ''))[0]
    const yesterday = findClosest(dayAgoStr)
    const weekAgo = findClosest(weekAgoStr)
    const monthAgo = findClosest(monthAgoStr)

    const calcChange = (oldPrice?: number | null, newPrice?: number | null) => {
        if (!oldPrice || !newPrice || oldPrice === 0) return 0
        return ((newPrice - oldPrice) / oldPrice) * 100
    }

    // 店舗×条件ごとに最新価格だけ取得
    const shopCondMap = new Map<string, {
        shop_name: string
        shop_icon?: string
        condition: string
        price: number
        updated_at: string
    }>()

    let purchaseLooseBest = 0
    let purchasePsa10Best = 0

    for (const row of purchaseData || []) {
        const shopName = (row as any).shop?.name || '不明'
        const label = (row as any).link?.label || ''
        // condition を決定: label優先 → condition正規化 → デフォルト'素体'
        const condition = normalizeCondition(row.condition || '素体', label)

        const key = `${shopName}::${condition}`
        if (shopCondMap.has(key)) continue // 最新のみ

        shopCondMap.set(key, {
            shop_name: shopName,
            shop_icon: (row as any).shop?.icon || undefined,
            condition,
            price: row.price,
            updated_at: row.created_at,
        })

        // 条件別の最高値を記録
        if (condition === 'PSA10') {
            purchasePsa10Best = Math.max(purchasePsa10Best, row.price)
        } else if (condition === '素体') {
            purchaseLooseBest = Math.max(purchaseLooseBest, row.price)
        }
    }

    const purchasePrices = Array.from(shopCondMap.values())
        .sort((a, b) => b.price - a.price)

    const result = {
        id: (card as any).id,
        name: (card as any).name,
        name_en: (card as any).name_en || '',
        image_url: (card as any).image_url,
        rarity: (card as any).rarity || '',
        card_number: (card as any).card_number || '',
        expansion: (card as any).expansion || '',
        set_name_en: (card as any).set_name_en || '',
        release_date: (card as any).release_date || '',
        pricecharting_id: (card as any).pricecharting_id || null,
        pricecharting_url: (card as any).pricecharting_url || null,
        loose_price_jpy: latest?.loose_price_jpy ?? 0,
        loose_price_usd: latest?.loose_price_usd ?? 0,
        graded_price_jpy: latest?.graded_price_jpy ?? 0,
        graded_price_usd: latest?.graded_price_usd ?? 0,
        price_change_24h: calcChange(yesterday?.loose_price_jpy, latest?.loose_price_jpy),
        price_change_7d: calcChange(weekAgo?.loose_price_jpy, latest?.loose_price_jpy),
        price_change_30d: calcChange(monthAgo?.loose_price_jpy, latest?.loose_price_jpy),
        display_price: latest?.loose_price_jpy || 0,
        display_price_usd: latest?.loose_price_usd || 0,
        high_price: maxPrice?.[0]?.loose_price_jpy || 0,
        low_price: minPrice?.[0]?.loose_price_jpy || 0,
        purchase_loose_best: purchaseLooseBest || undefined,
        purchase_psa10_best: purchasePsa10Best || undefined,
        purchase_prices: purchasePrices,
    }

    return NextResponse.json(result, {
        headers: {
            'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=600',
        },
    })
  } catch (error: unknown) {
    console.error('Chart card API error:', error)
    return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Internal server error' },
        { status: 500 }
    )
  }
}
