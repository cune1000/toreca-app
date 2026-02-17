import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, TABLES } from '@/lib/supabase'
import { getProduct } from '@/lib/pricecharting-api'

export const dynamic = 'force-dynamic'

/**
 * PriceCharting IDとカードを紐付け
 * POST /api/overseas-prices/link
 * Body: { card_id, pricecharting_id }
 */
export async function POST(request: NextRequest) {
  try {
    const { card_id, pricecharting_id } = await request.json()

    if (!card_id || !pricecharting_id) {
      return NextResponse.json(
        { success: false, error: 'card_id と pricecharting_id は必須です' },
        { status: 400 }
      )
    }

    // PriceCharting APIで商品情報を取得して名前を保存
    let pricechartingName = ''
    try {
      const product = await getProduct(pricecharting_id)
      pricechartingName = product['product-name'] || ''
    } catch (err) {
      console.warn('PriceCharting product fetch failed, linking without name:', err)
    }

    // cards テーブルを更新
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from(TABLES.CARDS)
      .update({
        pricecharting_id: pricecharting_id,
        pricecharting_name: pricechartingName,
        updated_at: new Date().toISOString(),
      })
      .eq('id', card_id)
      .select()
      .single()

    if (error) {
      console.error('Link update error:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error: any) {
    console.error('Overseas prices link error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Link failed' },
      { status: 500 }
    )
  }
}

/**
 * PriceCharting紐付けを解除
 * DELETE /api/overseas-prices/link?card_id=xxx
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const cardId = searchParams.get('card_id')

    if (!cardId) {
      return NextResponse.json(
        { success: false, error: 'card_id は必須です' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from(TABLES.CARDS)
      .update({
        pricecharting_id: null,
        pricecharting_name: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', cardId)
      .select()
      .single()

    if (error) {
      console.error('Unlink error:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data,
    })
  } catch (error: any) {
    console.error('Overseas prices unlink error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Unlink failed' },
      { status: 500 }
    )
  }
}
