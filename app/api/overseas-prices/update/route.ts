import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, TABLES } from '@/lib/supabase'
import { getProduct, penniesToJpy } from '@/lib/pricecharting-api'

export const dynamic = 'force-dynamic'

/**
 * 海外価格を手動で即時取得
 * POST /api/overseas-prices/update
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

    const supabase = createServiceClient()

    // 最新の為替レートを取得
    const { data: rateData } = await supabase
      .from(TABLES.EXCHANGE_RATES)
      .select('rate')
      .eq('base_currency', 'USD')
      .eq('target_currency', 'JPY')
      .order('recorded_at', { ascending: false })
      .limit(1)
      .single()

    const exchangeRate = rateData?.rate
    if (!exchangeRate) {
      return NextResponse.json(
        { success: false, error: '為替レートが未取得です' },
        { status: 500 }
      )
    }

    // PriceCharting APIで価格取得
    const product = await getProduct(pricecharting_id)

    const looseUsd = product['loose-price'] ?? null
    const gradedUsd = product['graded-price'] ?? null

    const record = {
      card_id,
      pricecharting_id,
      loose_price_usd: looseUsd,
      cib_price_usd: product['cib-price'] ?? null,
      new_price_usd: product['new-price'] ?? null,
      graded_price_usd: gradedUsd,
      exchange_rate: exchangeRate,
      loose_price_jpy: looseUsd != null ? penniesToJpy(looseUsd, exchangeRate) : null,
      graded_price_jpy: gradedUsd != null ? penniesToJpy(gradedUsd, exchangeRate) : null,
    }

    const { error: insertError } = await supabase
      .from(TABLES.OVERSEAS_PRICES)
      .insert(record)

    if (insertError) {
      return NextResponse.json(
        { success: false, error: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        productName: product['product-name'] || '',
        looseUsd,
        gradedUsd,
        looseJpy: record.loose_price_jpy,
        gradedJpy: record.graded_price_jpy,
        exchangeRate,
      },
    })
  } catch (error: any) {
    console.error('Overseas price update error:', error)
    return NextResponse.json(
      { success: false, error: error.message || '価格取得に失敗しました' },
      { status: 500 }
    )
  }
}
