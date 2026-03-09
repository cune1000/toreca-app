import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/** UUID v4 形式の簡易チェック */
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)

/** JustTCG ID の上限長 (slug形式: pokemon-japan-xxx-xxx) */
const MAX_JUSTTCG_ID_LENGTH = 200

/** JustTCG IDをカードに紐付け */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { card_id, justtcg_id } = body

    if (!card_id || !justtcg_id) {
      return NextResponse.json({ success: false, error: 'card_id と justtcg_id は必須です' }, { status: 400 })
    }

    if (typeof card_id !== 'string' || !isUuid(card_id)) {
      return NextResponse.json({ success: false, error: 'card_id の形式が不正です' }, { status: 400 })
    }

    const trimmedId = String(justtcg_id).trim()
    if (!trimmedId || trimmedId.length > MAX_JUSTTCG_ID_LENGTH) {
      return NextResponse.json({ success: false, error: 'justtcg_id の形式が不正です' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('cards')
      .update({ justtcg_id: trimmedId })
      .eq('id', card_id)
      .select('id')

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ success: false, error: '対象のカードが見つかりません' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '予期しないエラー'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

/** JustTCG IDの紐付け解除 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const cardId = searchParams.get('card_id')

    if (!cardId) {
      return NextResponse.json({ success: false, error: 'card_id は必須です' }, { status: 400 })
    }

    if (!isUuid(cardId)) {
      return NextResponse.json({ success: false, error: 'card_id の形式が不正です' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('cards')
      .update({ justtcg_id: null, justtcg_nm_price_usd: null })
      .eq('id', cardId)
      .select('id')

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ success: false, error: '対象のカードが見つかりません' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '予期しないエラー'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
