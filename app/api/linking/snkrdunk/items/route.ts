import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const supabase = createServiceClient()

/**
 * スニダン商品一覧API（紐づけ状態付き）
 * GET /api/linking/snkrdunk/items?page=1&perPage=100&search=xxx&filter=all|linked|unlinked&sort=name&order=asc
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const perPage = Math.min(200, Math.max(1, parseInt(searchParams.get('perPage') || '100')))
    const search = searchParams.get('search')?.trim() || ''
    const filter = searchParams.get('filter') || 'all'  // all | linked | unlinked
    const sort = searchParams.get('sort') || 'name'      // name | price | linked
    const order = searchParams.get('order') || 'asc'

    // 1. snkrdunk_items_cache から商品取得
    let query = supabase
      .from('snkrdunk_items_cache')
      .select('*', { count: 'exact' })

    // テキスト検索
    if (search) {
      query = query.ilike('name', `%${search}%`)
    }

    // ソート
    const ascending = order === 'asc'
    if (sort === 'price') {
      query = query.order('min_price', { ascending, nullsFirst: false })
    } else {
      query = query.order('name', { ascending })
    }

    // ページネーション
    const from = (page - 1) * perPage
    query = query.range(from, from + perPage - 1)

    const { data: items, error, count } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 2. 紐づけ済み apparel_id を取得
    const apparelIds = (items || []).map(i => i.apparel_id)
    let linkedMap: Record<number, { cardId: string; cardName: string }> = {}

    if (apparelIds.length > 0) {
      const { data: links } = await supabase
        .from('card_sale_urls')
        .select('apparel_id, card_id, card:card_id(name)')
        .in('apparel_id', apparelIds)

      if (links) {
        for (const link of links) {
          if (link.apparel_id) {
            linkedMap[link.apparel_id] = {
              cardId: link.card_id,
              cardName: (link as any).card?.name || '',
            }
          }
        }
      }
    }

    // 3. レスポンス整形
    let result = (items || []).map(item => ({
      id: String(item.apparel_id),
      name: item.name,
      modelno: item.product_number,
      imageUrl: item.image_url,
      price: item.min_price,
      meta: {
        apparelId: item.apparel_id,
        productNumber: item.product_number || '',
        totalListingCount: item.total_listing_count || 0,
        releasedAt: item.released_at,
      },
      linkedCardId: linkedMap[item.apparel_id]?.cardId || null,
      linkedCardName: linkedMap[item.apparel_id]?.cardName || null,
    }))

    // 紐づけ状態フィルタ（DB側で効率的にできないためJS側で）
    if (filter === 'linked') {
      result = result.filter(r => r.linkedCardId !== null)
    } else if (filter === 'unlinked') {
      result = result.filter(r => r.linkedCardId === null)
    }

    // 紐づけ状態ソート
    if (sort === 'linked') {
      result.sort((a, b) => {
        const aLinked = a.linkedCardId ? 1 : 0
        const bLinked = b.linkedCardId ? 1 : 0
        return ascending ? aLinked - bLinked : bLinked - aLinked
      })
    }

    const total = count ?? 0

    return NextResponse.json({
      items: result,
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
      },
    })
  } catch (error: any) {
    console.error('[linking/snkrdunk/items] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
