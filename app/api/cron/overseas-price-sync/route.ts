import { NextResponse } from 'next/server'
import { createServiceClient, TABLES } from '@/lib/supabase'
import { getProduct, penniesToJpy } from '@/lib/pricecharting-api'
import { shouldRunCronJob, markCronJobRun } from '@/lib/cron-gate'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

/**
 * 海外価格同期 Cron
 * pricecharting_id が設定済みの全カードの価格を PriceCharting API から取得し
 * overseas_prices テーブルに保存する
 *
 * 1回で回りきらない場合、自動的に再実行して全カード完走する
 * レート制限: 1リクエスト/秒を遵守
 */
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    const { searchParams } = new URL(req.url)
    const isChain = searchParams.get('chain') === '1'

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // チェーン呼び出し時はcron-gateをスキップ（同日の2回目以降）
    if (!isChain) {
      const forceParam = searchParams.get('force') === '1'
      const gate = await shouldRunCronJob('overseas-price-sync', { force: forceParam })
      if (!gate.shouldRun) {
        return NextResponse.json({ skipped: true, reason: gate.reason })
      }
    }

    const startTime = Date.now()
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
        { success: false, error: '為替レートが見つかりません' },
        { status: 500 }
      )
    }

    // 全対象カードを取得（ページネーション）
    let allCards: { id: string; pricecharting_id: string }[] = []
    let cardOffset = 0
    const PAGE = 1000
    while (true) {
      const { data: page, error: pageError } = await supabase
        .from(TABLES.CARDS)
        .select('id, pricecharting_id')
        .not('pricecharting_id', 'is', null)
        .range(cardOffset, cardOffset + PAGE - 1)
      if (pageError) throw pageError
      if (!page || page.length === 0) break
      allCards = allCards.concat(page)
      if (page.length < PAGE) break
      cardOffset += PAGE
    }

    if (allCards.length === 0) {
      await markCronJobRun('overseas-price-sync', 'success')
      return NextResponse.json({ success: true, processed: 0, message: 'No cards' })
    }

    // 今日未更新のカードだけを処理（ページネーション）
    const today = new Date().toISOString().substring(0, 10)
    let alreadySynced: { card_id: string }[] = []
    let syncOffset = 0
    while (true) {
      const { data: syncPage } = await supabase
        .from(TABLES.OVERSEAS_PRICES)
        .select('card_id')
        .gte('recorded_at', `${today}T00:00:00`)
        .lte('recorded_at', `${today}T23:59:59`)
        .range(syncOffset, syncOffset + PAGE - 1)
      if (!syncPage || syncPage.length === 0) break
      alreadySynced = alreadySynced.concat(syncPage)
      if (syncPage.length < PAGE) break
      syncOffset += PAGE
    }

    const syncedSet = new Set((alreadySynced || []).map((r) => r.card_id))
    const unsyncedCards = allCards.filter(c => !syncedSet.has(c.id))

    if (unsyncedCards.length === 0) {
      await markCronJobRun('overseas-price-sync', 'success')
      return NextResponse.json({
        success: true,
        processed: 0,
        total: allCards.length,
        message: 'All cards already synced today',
      })
    }

    console.log(`[Overseas Price Sync] ${unsyncedCards.length}/${allCards.length} cards to sync (rate: ${exchangeRate})`)

    let success = 0
    let failed = 0
    let timedOut = false

    for (const card of unsyncedCards) {
      // 270秒で安全に打ち切り
      if (Date.now() - startTime > 270_000) {
        timedOut = true
        console.warn(`[Overseas Price Sync] Timeout at ${success + failed}/${unsyncedCards.length}`)
        break
      }

      try {
        const product = await getProduct(card.pricecharting_id!)
        const looseUsd = product['loose-price'] ?? null
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
          console.error(`[Overseas Price Sync] Insert error ${card.id}:`, insertError.message)
        } else {
          success++
        }
      } catch (err: unknown) {
        failed++
        const errMsg = err instanceof Error ? err.message : String(err)
        console.error(`[Overseas Price Sync] API error ${card.id}:`, errMsg)
      }

      await new Promise(resolve => setTimeout(resolve, 1100))
    }

    const remaining = unsyncedCards.length - success - failed
    console.log(`[Overseas Price Sync] Done: ${success} ok, ${failed} err, ${remaining} remaining`)

    // 未処理カードが残っていたら自分自身をチェーン呼び出し
    if (timedOut && remaining > 0) {
      const host = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : `http://localhost:3000`
      console.log(`[Overseas Price Sync] Chaining: ${remaining} cards remaining`)
      fetch(`${host}/api/cron/overseas-price-sync?chain=1`, {
        headers: { 'Authorization': `Bearer ${cronSecret}` },
      }).catch(e => console.error('[Overseas Price Sync] Chain failed:', e.message))
    }

    await markCronJobRun('overseas-price-sync', 'success')
    return NextResponse.json({
      success: true,
      processed: success + failed,
      successCount: success,
      failed,
      remaining,
      chained: timedOut && remaining > 0,
      total: allCards.length,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[Overseas Price Sync] Error:', error)
    await markCronJobRun('overseas-price-sync', 'error', message).catch(() => {})
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
