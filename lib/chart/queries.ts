// チャートサイト用クエリレイヤー（ハイブリッドアプローチ）
// 現在: 直接Supabaseアクセス
// 独立時: fetchAPI呼び出しに差し替え

import { createClient } from '@supabase/supabase-js'
import { ChartCard, CardDetail, PricePoint, PurchaseShopPrice } from './types'
import { CATEGORY_SLUG_MAP } from './constants'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ============================================================================
// ランキング取得
// ============================================================================

export async function getRanking(params: {
    dataSource: string
    sortBy: string
    category?: string
    limit?: number
}): Promise<ChartCard[]> {
    const limit = params.limit || 10
    const categoryFilter = params.category && params.category !== 'all'
        ? CATEGORY_SLUG_MAP[params.category] || params.category
        : null

    // 日次集計テーブルから最新2日分を取得して変動率を計算
    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

    // カードの最新価格と変動率を取得
    const priceColumn = params.dataSource === 'purchase' ? 'purchase_avg' : 'sale_avg'

    // 最新日の集計データを取得
    let query = supabase
        .from('chart_daily_card_prices')
        .select(`
      card_id,
      date,
      sale_avg,
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
        .not(priceColumn, 'is', null)

    if (categoryFilter) {
        query = query.eq('cards.category.name', categoryFilter)
    }

    const { data: priceData, error } = await query

    if (error || !priceData?.length) {
        console.error('getRanking error:', error)
        return []
    }

    // カードごとに最新価格と過去価格を集計
    const cardMap = new Map<string, {
        card: any
        latestPrice: number
        latestDate: string
        yesterdayPrice?: number
        weekAgoPrice?: number
        monthAgoPrice?: number
    }>()

    for (const row of priceData) {
        const cardId = row.card_id
        const price = (row as any)[priceColumn]
        if (!price) continue

        const existing = cardMap.get(cardId)
        if (!existing || row.date > existing.latestDate) {
            cardMap.set(cardId, {
                card: (row as any).cards,
                latestPrice: price,
                latestDate: row.date,
                yesterdayPrice: existing?.yesterdayPrice,
                weekAgoPrice: existing?.weekAgoPrice,
                monthAgoPrice: existing?.monthAgoPrice,
            })
        }

        const entry = cardMap.get(cardId)!
        if (row.date <= yesterday && (!entry.yesterdayPrice || row.date > yesterday)) {
            entry.yesterdayPrice = price
        }
        if (row.date <= weekAgo) {
            entry.weekAgoPrice = entry.weekAgoPrice || price
        }
        if (row.date <= monthAgo) {
            entry.monthAgoPrice = entry.monthAgoPrice || price
        }
    }

    // ChartCard型に変換
    const cards: ChartCard[] = Array.from(cardMap.entries()).map(([id, data]) => {
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
            avg_price: data.latestPrice,
            price_change_24h: calcChange(data.yesterdayPrice),
            price_change_7d: calcChange(data.weekAgoPrice),
            price_change_30d: calcChange(data.monthAgoPrice),
            purchase_price_avg: params.dataSource === 'sale' ? undefined : data.latestPrice,
        }
    })

    // ソート
    switch (params.sortBy) {
        case 'change_pct_desc':
            cards.sort((a, b) => b.price_change_24h - a.price_change_24h)
            break
        case 'change_pct_asc':
            cards.sort((a, b) => a.price_change_24h - b.price_change_24h)
            break
        case 'change_yen_desc':
            cards.sort((a, b) => {
                const aChange = a.avg_price * (a.price_change_24h / 100)
                const bChange = b.avg_price * (b.price_change_24h / 100)
                return bChange - aChange
            })
            break
        case 'change_yen_asc':
            cards.sort((a, b) => {
                const aChange = a.avg_price * (a.price_change_24h / 100)
                const bChange = b.avg_price * (b.price_change_24h / 100)
                return aChange - bChange
            })
            break
        case 'price_desc':
            cards.sort((a, b) => b.avg_price - a.avg_price)
            break
    }

    return cards.slice(0, limit)
}

// ============================================================================
// カード詳細
// ============================================================================

export async function getCardDetail(id: string): Promise<CardDetail | null> {
    const { data: card, error } = await supabase
        .from('cards')
        .select(`
      id,
      name,
      image_url,
      card_number,
      rarity:rarity_id (name),
      category:category_large_id (name)
    `)
        .eq('id', id)
        .single()

    if (error || !card) return null

    // 最新の価格情報を取得
    const { data: latestPrices } = await supabase
        .from('chart_daily_card_prices')
        .select('sale_avg, purchase_avg, date')
        .eq('card_id', id)
        .order('date', { ascending: false })
        .limit(31)

    const latest = latestPrices?.[0]
    const yesterday = latestPrices?.find((p, i) => i > 0)
    const weekAgo = latestPrices?.find((_, i) => i >= 7)
    const monthAgo = latestPrices?.find((_, i) => i >= 30)

    const calcChange = (oldPrice?: number, newPrice?: number) => {
        if (!oldPrice || !newPrice || oldPrice === 0) return 0
        return ((newPrice - oldPrice) / oldPrice) * 100
    }

    // 過去の最高値・最安値
    const { data: minMax } = await supabase
        .from('chart_daily_card_prices')
        .select('sale_avg')
        .eq('card_id', id)
        .not('sale_avg', 'is', null)
        .order('sale_avg', { ascending: false })
        .limit(1)

    const { data: minPrice } = await supabase
        .from('chart_daily_card_prices')
        .select('sale_avg')
        .eq('card_id', id)
        .not('sale_avg', 'is', null)
        .order('sale_avg', { ascending: true })
        .limit(1)

    return {
        id: (card as any).id,
        name: (card as any).name,
        image_url: (card as any).image_url,
        category: (card as any).category?.name || '',
        rarity: (card as any).rarity?.name || '',
        card_number: (card as any).card_number || '',
        avg_price: latest?.sale_avg || 0,
        price_change_24h: calcChange(yesterday?.sale_avg, latest?.sale_avg),
        price_change_7d: calcChange(weekAgo?.sale_avg, latest?.sale_avg),
        price_change_30d: calcChange(monthAgo?.sale_avg, latest?.sale_avg),
        purchase_price_avg: latest?.purchase_avg || undefined,
        high_price: minMax?.[0]?.sale_avg || 0,
        low_price: minPrice?.[0]?.sale_avg || 0,
    }
}

// ============================================================================
// 価格履歴
// ============================================================================

export async function getPriceHistory(
    cardId: string,
    period: '30d' | '90d' | '1y' | 'all'
): Promise<PricePoint[]> {
    const periodDays: Record<string, number> = {
        '30d': 30,
        '90d': 90,
        '1y': 365,
        'all': 9999,
    }
    const days = periodDays[period] || 30
    const fromDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]

    let query = supabase
        .from('chart_daily_card_prices')
        .select('date, sale_avg, purchase_avg')
        .eq('card_id', cardId)
        .order('date', { ascending: true })

    if (period !== 'all') {
        query = query.gte('date', fromDate)
    }

    const { data, error } = await query

    if (error || !data) return []

    return data.map(row => ({
        date: row.date,
        avg_price: row.sale_avg || 0,
        purchase_avg: row.purchase_avg || undefined,
    }))
}

// ============================================================================
// 店舗別買取価格
// ============================================================================

export async function getPurchasePrices(cardId: string): Promise<PurchaseShopPrice[]> {
    const { data, error } = await supabase
        .from('purchase_prices')
        .select('price, created_at, shop:shop_id(name, icon)')
        .eq('card_id', cardId)
        .order('created_at', { ascending: false })
        .limit(50)

    if (error || !data) return []

    // 店舗ごとに最新価格だけ取得
    const shopMap = new Map<string, PurchaseShopPrice>()
    for (const row of data) {
        const shopName = (row as any).shop?.name
        if (!shopName || shopMap.has(shopName)) continue
        shopMap.set(shopName, {
            shop_name: shopName,
            shop_icon: (row as any).shop?.icon || undefined,
            price: row.price,
            updated_at: row.created_at,
        })
    }

    return Array.from(shopMap.values()).sort((a, b) => b.price - a.price)
}

// ============================================================================
// カード検索
// ============================================================================

export async function searchCards(query: string, filters?: {
    category?: string
    rarity?: string
}): Promise<ChartCard[]> {
    let dbQuery = supabase
        .from('cards')
        .select(`
      id,
      name,
      image_url,
      card_number,
      rarity:rarity_id (name),
      category:category_large_id (name)
    `)
        .ilike('name', `%${query}%`)
        .limit(50)

    if (filters?.category && filters.category !== 'all') {
        const catName = CATEGORY_SLUG_MAP[filters.category]
        if (catName) {
            dbQuery = dbQuery.eq('category.name', catName)
        }
    }

    const { data, error } = await dbQuery
    if (error || !data) return []

    // 各カードの最新価格を取得
    const cardIds = data.map((c: any) => c.id)
    const { data: prices } = await supabase
        .from('chart_daily_card_prices')
        .select('card_id, sale_avg, purchase_avg, date')
        .in('card_id', cardIds)
        .order('date', { ascending: false })

    const priceMap = new Map<string, { sale_avg: number; purchase_avg?: number }>()
    prices?.forEach(p => {
        if (!priceMap.has(p.card_id)) {
            priceMap.set(p.card_id, {
                sale_avg: p.sale_avg || 0,
                purchase_avg: p.purchase_avg || undefined,
            })
        }
    })

    return data.map((card: any) => {
        const price = priceMap.get(card.id)
        return {
            id: card.id,
            name: card.name,
            image_url: card.image_url,
            category: card.category?.name || '',
            rarity: card.rarity?.name || '',
            card_number: card.card_number || '',
            avg_price: price?.sale_avg || 0,
            price_change_24h: 0,
            price_change_7d: 0,
            price_change_30d: 0,
            purchase_price_avg: price?.purchase_avg,
        }
    })
}

// ============================================================================
// カテゴリ一覧（カード数付き）
// ============================================================================

export async function getCategories(): Promise<{ slug: string; name: string; card_count: number }[]> {
    const { data, error } = await supabase
        .from('category_large')
        .select('id, name')
        .order('sort_order')

    if (error || !data) return []

    // TODO: カード数を効率的に取得
    return data.map(cat => ({
        slug: Object.entries(CATEGORY_SLUG_MAP).find(([_, v]) => v === cat.name)?.[0] || cat.id,
        name: cat.name,
        card_count: 0,
    }))
}
