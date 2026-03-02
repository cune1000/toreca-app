import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const supabase = createServiceClient()

/**
 * シンソク紐づけAPI
 * POST /api/linking/shinsoku/link
 * body: { cardId: string, itemId: string, label?: string, condition?: string }
 * → card_purchase_links にUPSERT
 *
 * DELETE /api/linking/shinsoku/link
 * body: { itemId: string }
 * → card_purchase_links から削除
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { cardId, itemId, label, condition } = body

    if (!cardId || !itemId) {
      return NextResponse.json({ error: 'cardId and itemId are required' }, { status: 400 })
    }

    // 1. シンソクの shop_id を取得
    const { data: shops } = await supabase
      .from('purchase_shops')
      .select('id')
      .eq('name', 'シンソク（郵送買取）')
      .limit(1)

    const shopId = shops?.[0]?.id
    if (!shopId) {
      return NextResponse.json({ error: 'シンソクがpurchase_shopsに未登録です' }, { status: 500 })
    }

    // 2. UPSERT
    const { data, error } = await supabase
      .from('card_purchase_links')
      .upsert({
        card_id: cardId,
        shop_id: shopId,
        external_key: itemId,
        label: label || '',
        condition: condition || 'normal',
      }, { onConflict: 'card_id,shop_id,external_key' })
      .select('id')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data?.[0]?.id })
  } catch (error: any) {
    console.error('[linking/shinsoku/link] POST Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    const { itemId } = body

    if (!itemId) {
      return NextResponse.json({ error: 'itemId is required' }, { status: 400 })
    }

    const { data: shops } = await supabase
      .from('purchase_shops')
      .select('id')
      .eq('name', 'シンソク（郵送買取）')
      .limit(1)

    const shopId = shops?.[0]?.id
    if (!shopId) {
      return NextResponse.json({ error: 'シンソクがpurchase_shopsに未登録です' }, { status: 500 })
    }

    const { error } = await supabase
      .from('card_purchase_links')
      .delete()
      .eq('shop_id', shopId)
      .eq('external_key', itemId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[linking/shinsoku/link] DELETE Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
