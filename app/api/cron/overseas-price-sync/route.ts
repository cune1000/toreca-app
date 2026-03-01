import { NextResponse } from 'next/server'
import { createServiceClient, TABLES } from '@/lib/supabase'
import { getProduct, penniesToJpy } from '@/lib/pricecharting-api'
import { shouldRunCronJob, markCronJobRun } from '@/lib/cron-gate'

export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5分（大量カード対応）

/**
 * 海外価格同期 Cron
 * pricecharting_id が設定済みの全カードの価格を PriceCharting API から取得し
 * overseas_prices テーブルに保存する
 *
 * レート制限: 1リクエスト/秒を遵守
 * 毎日 AM3:00 JST に実行
 */
export async function GET(req: Request) {
  try {
    // CRON_SECRET認証
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    const { searchParams } = new URL(req.url)
    const limitParam = searchParams.get('limit')

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const gate = await shouldRunCronJob('overseas-price-sync')
    if (!gate.shouldRun) {
      return NextResponse.json({ skipped: true, reason: gate.reason })
    }

    console.log('[Overseas Price Sync] Starting...')

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
      console.error('[Overseas Price Sync] No exchange rate found. Run exchange-rate-sync first.')
      return NextResponse.json(
        { success: false, error: '為替レートが見つかりません。exchange-rate-sync を先に実行してください。' },
        { status: 500 }
      )
    }

    console.log(`[Overseas Price Sync] Exchange rate: USD/JPY = ${exchangeRate}`)

    // pricecharting_id が設定済みのカードを取得
    let query = supabase
      .from(TABLES.CARDS)
      .select('id, pricecharting_id')
      .not('pricecharting_id', 'is', null)

    if (limitParam) {
      const limit = parseInt(limitParam)
      if (!isNaN(limit) && limit > 0) {
        query = query.limit(limit)
      }
    }

    const { data: cards, error: cardsError } = await query

    if (cardsError) {
      console.error('[Overseas Price Sync] Cards fetch error:', cardsError)
      return NextResponse.json(
        { success: false, error: cardsError.message },
        { status: 500 }
      )
    }

    if (!cards || cards.length === 0) {
      console.log('[Overseas Price Sync] No cards with pricecharting_id found')
      return NextResponse.json({
        success: true,
        message: 'PriceCharting IDが設定されたカードがありません',
        processed: 0,
      })
    }

    console.log(`[Overseas Price Sync] Processing ${cards.length} cards...`)

    let success = 0
    let failed = 0
    const errors: string[] = []

    for (const card of cards) {
      try {
        const product = await getProduct(card.pricecharting_id!)

        const looseUsd = product['loose-price'] ?? null
        // トレカではmanual-only-price = PSA 10（graded-priceはGrade 9）
        const psa10Usd = product['manual-only-price'] ?? null

        const { error: insertError } = await supabase
          .from(TABLES.OVERSEAS_PRICES)
          .insert({
            card_id: card.id,
            pricecharting_id: card.pricecharting_id,
            loose_price_usd: looseUsd,
            cib_price_usd: product['cib-price'] ?? null,
            new_price_usd: product['new-price'] ?? null,
            graded_price_usd: psa10Usd,
            exchange_rate: exchangeRate,
            loose_price_jpy: looseUsd != null ? penniesToJpy(looseUsd, exchangeRate) : null,
            graded_price_jpy: psa10Usd != null ? penniesToJpy(psa10Usd, exchangeRate) : null,
          })

        if (insertError) {
          failed++
          errors.push(`${card.id}: ${insertError.message}`)
          console.error(`[Overseas Price Sync] Insert error for ${card.id}:`, insertError)
        } else {
          success++
        }
      } catch (err: any) {
        failed++
        errors.push(`${card.id}: ${err.message}`)
        console.error(`[Overseas Price Sync] API error for ${card.id}:`, err.message)
      }

      // レート制限: 1リクエスト/秒を遵守
      await new Promise(resolve => setTimeout(resolve, 1100))
    }

    console.log(`[Overseas Price Sync] Done: ${success} success, ${failed} failed`)

    await markCronJobRun('overseas-price-sync', 'success')
    return NextResponse.json({
      success: true,
      processed: cards.length,
      successCount: success,
      failed,
      errors: errors.slice(0, 10),
    })
  } catch (error: any) {
    console.error('[Overseas Price Sync] Error:', error)
    await markCronJobRun('overseas-price-sync', 'error', error.message)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
