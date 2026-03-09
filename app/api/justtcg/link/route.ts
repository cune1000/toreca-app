import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/** JustTCG IDをカードに紐付け */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { card_id, justtcg_id } = body

    if (!card_id || !justtcg_id) {
      return NextResponse.json({ success: false, error: 'card_id と justtcg_id は必須です' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { error } = await supabase
      .from('cards')
      .update({ justtcg_id: justtcg_id.trim() })
      .eq('id', card_id)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
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

    const supabase = createServiceClient()
    const { error } = await supabase
      .from('cards')
      .update({ justtcg_id: null, justtcg_nm_price_usd: null })
      .eq('id', cardId)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
