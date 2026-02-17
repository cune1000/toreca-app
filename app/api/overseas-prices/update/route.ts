import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient, TABLES } from '@/lib/supabase'
import { getProduct, penniesToJpy } from '@/lib/pricecharting-api'
import { getUsdJpyRate } from '@/lib/exchange-rate'

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

    // 最新の為替レートを取得（DBになければAPIから直接取得）
    let exchangeRate: number

    const { data: rateData } = await supabase
      .from(TABLES.EXCHANGE_RATES)
      .select('rate')
      .eq('base_currency', 'USD')
      .eq('target_currency', 'JPY')
      .order('recorded_at', { ascending: false })
      .limit(1)
      .single()

    if (rateData?.rate) {
      exchangeRate = rateData.rate
    } else {
      // DBにレートがない場合、Frankfurter APIから直接取得して保存
      exchangeRate = await getUsdJpyRate()
      await supabase.from(TABLES.EXCHANGE_RATES).insert({
        base_currency: 'USD',
        target_currency: 'JPY',
        rate: exchangeRate,
      })
    }

    // PriceCharting APIで価格取得
    const product = await getProduct(pricecharting_id)

    const looseUsd = product['loose-price'] ?? null
    // トレカではmanual-only-price = PSA 10（graded-priceはGrade 9）
    const psa10Usd = product['manual-only-price'] ?? null

    const record = {
      card_id,
      pricecharting_id,
      loose_price_usd: looseUsd,
      cib_price_usd: product['cib-price'] ?? null,
      new_price_usd: product['new-price'] ?? null,
      graded_price_usd: psa10Usd,
      exchange_rate: exchangeRate,
      loose_price_jpy: looseUsd != null ? penniesToJpy(looseUsd, exchangeRate) : null,
      graded_price_jpy: psa10Usd != null ? penniesToJpy(psa10Usd, exchangeRate) : null,
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
        psa10Usd,
        looseJpy: record.loose_price_jpy,
        psa10Jpy: record.graded_price_jpy,
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
