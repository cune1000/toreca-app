import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { shouldRunCronJob, markCronJobRun } from '@/lib/cron-gate'
import { getCards, extractSetIdFromJusttcgId } from '@/lib/justtcg-api'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const DELAY_MS = 1100 // JustTCG API レート制限対策

/**
 * JustTCG価格日次同期 Cron
 * justtcg_id が設定済みの全カードの最新NM価格を取得し
 * justtcg_price_history に追記 + cards.justtcg_nm_price_usd を更新
 *
 * セット単位でAPI呼び出し（同セットのカードをグルーピング）
 */
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const force = searchParams.get('force') === '1'
    const gate = await shouldRunCronJob('justtcg-price-sync', { force })
    if (!gate.shouldRun) {
      return NextResponse.json({ skipped: true, reason: gate.reason })
    }

    const supabase = createServiceClient()
    const startTime = Date.now()

    // 1. justtcg_id が設定済みのカードを全取得
    const { data: cards, error: cardsError } = await supabase
      .from('cards')
      .select('id, justtcg_id')
      .not('justtcg_id', 'is', null)

    if (cardsError) throw cardsError
    if (!cards || cards.length === 0) {
      await markCronJobRun('justtcg-price-sync', 'success')
      return NextResponse.json({ success: true, message: 'No cards with justtcg_id', processed: 0 })
    }

    // 2. セットIDでグルーピング
    const setGroups = new Map<string, { cardId: string; justtcgId: string }[]>()
    let unmatchedCount = 0

    for (const card of cards) {
      const setId = extractSetIdFromJusttcgId(card.justtcg_id)
      if (!setId) {
        unmatchedCount++
        continue
      }
      if (!setGroups.has(setId)) setGroups.set(setId, [])
      setGroups.get(setId)!.push({ cardId: card.id, justtcgId: card.justtcg_id })
    }

    console.log(`[justtcg-price-sync] ${cards.length} cards → ${setGroups.size} sets (${unmatchedCount} unmatched)`)

    // 3. セットごとにAPI呼び出し
    let totalUpdated = 0
    let totalErrors = 0
    const now = new Date().toISOString()

    for (const [setId, group] of setGroups) {
      try {
        // セットIDからゲームを判定
        const game = setId.endsWith('one-piece-card-game') ? 'one-piece-card-game' : 'pokemon-japan'

        const result = await getCards(setId, { game })
        const apiCards = result.data || []

        // justtcg_id → APIカードのマッピング
        const apiCardMap = new Map<string, any>()
        for (const ac of apiCards) {
          apiCardMap.set(ac.id, ac)
        }

        // 各カードの最新価格を取得・保存
        const historyRows: any[] = []
        const cardUpdates: { id: string; price: number }[] = []

        for (const { cardId, justtcgId } of group) {
          const apiCard = apiCardMap.get(justtcgId)
          if (!apiCard) continue

          // NM (Near Mint) バリアントの価格を取得
          const nmVariant = apiCard.variants?.find(
            (v: any) => v.condition === 'Near Mint' && v.language === 'Japanese'
          ) || apiCard.variants?.find(
            (v: any) => v.condition === 'Near Mint'
          )

          const price = nmVariant?.price
          if (typeof price !== 'number' || price <= 0) continue

          historyRows.push({
            card_id: cardId,
            price_usd: price,
            recorded_at: now,
          })

          cardUpdates.push({ id: cardId, price })
        }

        // バッチINSERT（justtcg_price_history に追記）
        if (historyRows.length > 0) {
          for (let i = 0; i < historyRows.length; i += 50) {
            const { error } = await supabase
              .from('justtcg_price_history')
              .insert(historyRows.slice(i, i + 50))
            if (error) console.error(`[justtcg-price-sync] Insert error:`, error.message)
          }
        }

        // cards.justtcg_nm_price_usd を更新
        for (const { id, price } of cardUpdates) {
          await supabase
            .from('cards')
            .update({ justtcg_nm_price_usd: price })
            .eq('id', id)
        }

        totalUpdated += cardUpdates.length
        console.log(`[justtcg-price-sync] ${setId}: ${cardUpdates.length}/${group.length} updated`)
      } catch (err: any) {
        console.error(`[justtcg-price-sync] Set ${setId} error:`, err.message)
        totalErrors++
      }

      // レート制限対策
      await new Promise(resolve => setTimeout(resolve, DELAY_MS))

      // タイムアウト防止（270秒で打ち切り）
      if (Date.now() - startTime > 270_000) {
        console.warn(`[justtcg-price-sync] Timeout approaching, stopping early`)
        break
      }
    }

    const durationMs = Date.now() - startTime
    const summary = {
      success: true,
      totalCards: cards.length,
      totalSets: setGroups.size,
      totalUpdated,
      totalErrors,
      unmatchedCount,
      durationMs,
    }

    console.log(`[justtcg-price-sync] Complete:`, summary)
    await markCronJobRun('justtcg-price-sync', 'success')
    return NextResponse.json(summary)
  } catch (error: any) {
    console.error('[justtcg-price-sync] Cron error:', error)
    await markCronJobRun('justtcg-price-sync', 'error', error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
