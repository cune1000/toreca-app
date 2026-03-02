import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { isSnkrdunkSiteName } from '@/lib/snkrdunk-api'

const supabase = createServiceClient()

/**
 * スニダン紐づけAPI
 * POST /api/linking/snkrdunk/link
 * body: { cardId: string, apparelId: number }
 * → card_sale_urls にスニダンURL+apparel_idをINSERT
 *
 * DELETE /api/linking/snkrdunk/link
 * body: { apparelId: number }
 * → card_sale_urls から該当行を削除
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { cardId, apparelId } = body

    if (!cardId || !apparelId) {
      return NextResponse.json({ error: 'cardId and apparelId are required' }, { status: 400 })
    }

    // 1. スニダンの sale_sites.id を取得
    const { data: sites } = await supabase
      .from('sale_sites')
      .select('id, name')
      .limit(100)

    const snkrdunkSite = sites?.find(s => isSnkrdunkSiteName(s.name))
    if (!snkrdunkSite) {
      return NextResponse.json({ error: 'スニダンがsale_sitesに未登録です' }, { status: 500 })
    }

    // 2. 既存の紐づけチェック（同一apparel_id）
    const { data: existing } = await supabase
      .from('card_sale_urls')
      .select('id, card_id')
      .eq('apparel_id', apparelId)
      .limit(1)

    if (existing && existing.length > 0) {
      return NextResponse.json({
        error: `このスニダン商品は既に別のカード(${existing[0].card_id})に紐づけ済みです`,
        existingCardId: existing[0].card_id,
      }, { status: 409 })
    }

    // 3. card_sale_urls にINSERT
    const productUrl = `https://snkrdunk.com/apparels/${apparelId}`

    const { data: inserted, error } = await supabase
      .from('card_sale_urls')
      .upsert({
        card_id: cardId,
        site_id: snkrdunkSite.id,
        product_url: productUrl,
        apparel_id: apparelId,
        auto_scrape_mode: 'auto',
      }, { onConflict: 'card_id,site_id' })
      .select('id')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: inserted?.[0]?.id })
  } catch (error: any) {
    console.error('[linking/snkrdunk/link] POST Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    const { apparelId } = body

    if (!apparelId) {
      return NextResponse.json({ error: 'apparelId is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('card_sale_urls')
      .delete()
      .eq('apparel_id', apparelId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[linking/snkrdunk/link] DELETE Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
