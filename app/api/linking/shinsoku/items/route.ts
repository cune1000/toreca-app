import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const supabase = createServiceClient()

/**
 * シンソク商品一覧API（紐づけ状態付き）
 * GET /api/linking/shinsoku/items?page=1&perPage=100&search=xxx&filter=all|linked|unlinked
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const perPage = Math.min(200, Math.max(1, parseInt(searchParams.get('perPage') || '100')))
    const search = searchParams.get('search')?.trim() || ''
    const filter = searchParams.get('filter') || 'all'
    const sort = searchParams.get('sort') || 'name'
    const order = searchParams.get('order') || 'asc'

    // 1. shinsoku_items からポケカ商品取得
    let query = supabase
      .from('shinsoku_items')
      .select('*', { count: 'exact' })
      .eq('brand', 'ポケモン')

    if (search) {
      query = query.ilike('name', `%${search}%`)
    }

    const ascending = order === 'asc'
    if (sort === 'price') {
      query = query.order('price_a', { ascending, nullsFirst: false })
    } else {
      query = query.order('name', { ascending })
    }

    const from = (page - 1) * perPage
    query = query.range(from, from + perPage - 1)

    const { data: items, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 2. シンソクshop_idを取得
    const { data: shops } = await supabase
      .from('purchase_shops')
      .select('id')
      .eq('name', 'シンソク（郵送買取）')
      .limit(1)

    const shopId = shops?.[0]?.id

    // 3. 紐づけ済み external_key を取得
    const itemIds = (items || []).map(i => i.item_id)
    let linkedMap: Record<string, { cardId: string; cardName: string }> = {}

    if (shopId && itemIds.length > 0) {
      const { data: links } = await supabase
        .from('card_purchase_links')
        .select('external_key, card_id, card:card_id(name)')
        .eq('shop_id', shopId)
        .in('external_key', itemIds)

      if (links) {
        for (const link of links) {
          linkedMap[link.external_key] = {
            cardId: link.card_id,
            cardName: (link as any).card?.name || '',
          }
        }
      }
    }

    // 4. レスポンス整形
    let result = (items || []).map(item => ({
      id: item.item_id,
      name: item.name,
      modelno: item.modelno,
      imageUrl: item.image_url,
      price: item.price_a,
      meta: {
        itemId: item.item_id,
        brand: item.brand,
        rarity: item.rarity,
        type: item.type,
        priceS: item.price_s,
        priceA: item.price_a,
        priceAm: item.price_am,
        priceB: item.price_b,
        priceC: item.price_c,
      },
      linkedCardId: linkedMap[item.item_id]?.cardId || null,
      linkedCardName: linkedMap[item.item_id]?.cardName || null,
    }))

    if (filter === 'linked') {
      result = result.filter(r => r.linkedCardId !== null)
    } else if (filter === 'unlinked') {
      result = result.filter(r => r.linkedCardId === null)
    }

    if (sort === 'linked') {
      result.sort((a, b) => {
        const aLinked = a.linkedCardId ? 1 : 0
        const bLinked = b.linkedCardId ? 1 : 0
        return ascending ? aLinked - bLinked : bLinked - aLinked
      })
    }

    return NextResponse.json({
      items: result,
      pagination: {
        page,
        perPage,
        total: count ?? 0,
        totalPages: Math.ceil((count ?? 0) / perPage),
      },
    })
  } catch (error: any) {
    console.error('[linking/shinsoku/items] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
