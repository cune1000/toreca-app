import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const supabase = createServiceClient()

/**
 * トレカラウンジ紐づけAPI
 * POST /api/linking/lounge/link
 * body: { cardId: string, cardKey: string, label?: string, condition?: string }
 * → card_purchase_links にUPSERT
 *
 * DELETE /api/linking/lounge/link
 * body: { cardKey: string }
 * → card_purchase_links から削除
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { cardId, cardKey, label, condition } = body

    if (!cardId || !cardKey) {
      return NextResponse.json({ error: 'cardId and cardKey are required' }, { status: 400 })
    }

    // 1. ラウンジの shop_id を取得
    const { data: shops } = await supabase
      .from('purchase_shops')
      .select('id')
      .eq('name', 'トレカラウンジ（郵送買取）')
      .limit(1)

    const shopId = shops?.[0]?.id
    if (!shopId) {
      return NextResponse.json({ error: 'トレカラウンジがpurchase_shopsに未登録です' }, { status: 500 })
    }

    // 2. UPSERT
    const { data, error } = await supabase
      .from('card_purchase_links')
      .upsert({
        card_id: cardId,
        shop_id: shopId,
        external_key: cardKey,
        label: label || '',
        condition: condition || 'normal',
      }, { onConflict: 'card_id,shop_id,external_key' })
      .select('id')

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, id: data?.[0]?.id })
  } catch (error: any) {
    console.error('[linking/lounge/link] POST Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json()
    const { cardKey } = body

    if (!cardKey) {
      return NextResponse.json({ error: 'cardKey is required' }, { status: 400 })
    }

    const { data: shops } = await supabase
      .from('purchase_shops')
      .select('id')
      .eq('name', 'トレカラウンジ（郵送買取）')
      .limit(1)

    const shopId = shops?.[0]?.id
    if (!shopId) {
      return NextResponse.json({ error: 'トレカラウンジがpurchase_shopsに未登録です' }, { status: 500 })
    }

    const { error } = await supabase
      .from('card_purchase_links')
      .delete()
      .eq('shop_id', shopId)
      .eq('external_key', cardKey)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[linking/lounge/link] DELETE Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
