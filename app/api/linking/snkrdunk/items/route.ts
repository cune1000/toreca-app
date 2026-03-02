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
    const filter = searchParams.get('filter') || 'all'
    const sort = searchParams.get('sort') || 'name'
    const order = searchParams.get('order') || 'asc'
    // 除外フィルタ
    const excludeLangs = searchParams.get('excludeLangs')?.split(',').filter(Boolean) || []
    const minPrice = searchParams.get('minPrice') ? parseInt(searchParams.get('minPrice')!) : null
    const excludeNoPrice = searchParams.get('excludeNoPrice') === 'true'
    const setCode = searchParams.get('setCode')?.trim() || ''

    // 1. linked/unlinkedフィルタ: 紐づけ済みapparel_idを先に取得
    let linkedApparelIds: Set<number> = new Set()
    let linkedMap: Record<number, { cardId: string; cardName: string }> = {}

    if (filter !== 'all' || sort === 'linked') {
      // フィルタ or ソートで紐づけ状態が必要 → 全linked apparel_id を取得
      const { data: allLinks } = await supabase
        .from('card_sale_urls')
        .select('apparel_id, card_id, card:card_id(name)')
        .not('apparel_id', 'is', null)
        .limit(10000)

      if (allLinks) {
        for (const link of allLinks) {
          if (link.apparel_id) {
            linkedApparelIds.add(link.apparel_id)
            linkedMap[link.apparel_id] = {
              cardId: link.card_id,
              cardName: (link as any).card?.name || '',
            }
          }
        }
      }
    }

    // 2. snkrdunk_items_cache からクエリ構築
    let query = supabase
      .from('snkrdunk_items_cache')
      .select('*', { count: 'exact' })

    if (search) {
      query = query.ilike('name', `%${search}%`)
    }

    // 除外フィルタ: 言語
    if (excludeLangs.length > 0) {
      // language IS NULL（日本語扱い）は通す、指定言語のみ除外
      // Supabase: or条件で language IS NULL OR language NOT IN (...)
      query = query.or(`language.is.null,language.not.in.(${excludeLangs.join(',')})`)
    }

    // 除外フィルタ: 価格
    if (excludeNoPrice) {
      query = query.not('min_price', 'is', null).gt('min_price', 0)
    }
    if (minPrice != null && minPrice > 0) {
      query = query.gte('min_price', minPrice)
    }

    // 収録弾フィルタ
    if (setCode) {
      query = query.eq('parsed_set_code', setCode)
    }

    // DB側フィルタ: linked/unlinked
    if (filter === 'linked' && linkedApparelIds.size > 0) {
      query = query.in('apparel_id', Array.from(linkedApparelIds))
    } else if (filter === 'linked') {
      // linked が0件ならダミー条件で0件返す
      query = query.eq('apparel_id', -1)
    } else if (filter === 'unlinked' && linkedApparelIds.size > 0) {
      // NOT IN で未紐づけのみ取得
      // Supabase PostgREST: not.in を使用
      query = query.not('apparel_id', 'in', `(${Array.from(linkedApparelIds).join(',')})`)
    }
    // filter === 'unlinked' && linkedApparelIds.size === 0 → 全件が未紐づけなのでフィルタ不要

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

    // 3. フィルタなしの場合: 表示分のみ紐づけ情報を取得
    if (filter === 'all' && sort !== 'linked') {
      const apparelIds = (items || []).map(i => i.apparel_id)
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
    }

    // 4. レスポンス整形
    const result = (items || []).map(item => ({
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

    const total = count ?? 0

    return NextResponse.json({
      items: result,
      pagination: { page, perPage, total, totalPages: Math.ceil(total / perPage) },
    })
  } catch (error: any) {
    console.error('[linking/snkrdunk/items] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
