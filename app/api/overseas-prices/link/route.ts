import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, TABLES } from '@/lib/supabase'
import { getProduct } from '@/lib/pricecharting-api'

export const dynamic = 'force-dynamic'

/**
 * PriceCharting URLからproduct IDを解決
 * /game/xxx/yyy 形式のURLページを取得してIDを抽出
 */
async function resolveProductIdFromUrl(url: string): Promise<string | null> {
  // まず product= パラメータを試す
  const paramMatch = url.match(/[?&]product=(\d+)/)
  if (paramMatch) return paramMatch[1]

  // /game/ 形式のURLならページを取得してIDを探す
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) return null
    const html = await res.text()

    // ページ内からproduct IDを抽出（複数パターン）
    const idMatch = html.match(/VGPC\.product\s*=\s*\{\s*id:\s*(\d+)/)
      || html.match(/[?&]product=(\d+)/)
      || html.match(/product[_-]?id["'\s:=]+(\d+)/i)
    return idMatch ? idMatch[1] : null
  } catch (err) {
    console.error('PriceCharting URL resolve failed:', err)
    return null
  }
}

/**
 * PriceCharting IDとカードを紐付け
 * POST /api/overseas-prices/link
 * Body: { card_id, pricecharting_id } or { card_id, pricecharting_url }
 */
export async function POST(request: NextRequest) {
  try {
    const { card_id, pricecharting_id, pricecharting_url } = await request.json()

    if (!card_id) {
      return NextResponse.json(
        { success: false, error: 'card_id は必須です' },
        { status: 400 }
      )
    }

    // IDを解決: 直接指定 or URLから抽出
    let resolvedId = pricecharting_id
    if (!resolvedId && pricecharting_url) {
      resolvedId = await resolveProductIdFromUrl(pricecharting_url)
    }

    if (!resolvedId) {
      return NextResponse.json(
        { success: false, error: 'PriceCharting IDを特定できませんでした。product=数字 形式のURLを試してください。' },
        { status: 400 }
      )
    }

    // PriceCharting APIで商品情報を取得して名前を保存
    let pricechartingName = ''
    try {
      const product = await getProduct(resolvedId)
      pricechartingName = product['product-name'] || ''
    } catch (err) {
      console.warn('PriceCharting product fetch failed, linking without name:', err)
    }

    // cards テーブルを更新
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from(TABLES.CARDS)
      .update({
        pricecharting_id: resolvedId,
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
      pricecharting_id: resolvedId,
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
