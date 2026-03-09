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
      .limit(10000)

    if (cardsError) throw cardsError
    if (!cards || cards.length === 0) {
      await markCronJobRun('justtcg-price-sync', 'success')
      return NextResponse.json({ success: true, message: 'No cards with justtcg_id', processed: 0 })
    }

    // 2. 今日既に更新済みのカードを特定
    const today = new Date().toISOString().substring(0, 10) // YYYY-MM-DD
    const { data: alreadySynced } = await supabase
      .from('justtcg_price_history')
      .select('card_id')
      .gte('recorded_at', `${today}T00:00:00`)
      .lte('recorded_at', `${today}T23:59:59`)
    const syncedSet = new Set((alreadySynced || []).map((r: any) => r.card_id))

    // 3. セットIDでグルーピング（未更新カードがあるセットを優先）
    const setGroups = new Map<string, { cardId: string; justtcgId: string }[]>()
    const syncedSetGroups = new Map<string, { cardId: string; justtcgId: string }[]>()
    let unmatchedCount = 0

    for (const card of cards) {
      const setId = extractSetIdFromJusttcgId(card.justtcg_id)
      if (!setId) {
        unmatchedCount++
        continue
      }
      const hasUnsyncedCard = !syncedSet.has(card.id)
      const targetMap = hasUnsyncedCard ? setGroups : syncedSetGroups
      if (!targetMap.has(setId)) targetMap.set(setId, [])
      targetMap.get(setId)!.push({ cardId: card.id, justtcgId: card.justtcg_id })
    }

    // 未更新セットを先に処理し、その後に更新済みセットを処理
    const orderedSets = [...setGroups.entries(), ...syncedSetGroups.entries()]

    console.log(`[justtcg-price-sync] ${cards.length} cards → ${setGroups.size + syncedSetGroups.size} sets (${setGroups.size} unsynced, ${unmatchedCount} unmatched)`)

    // 3. セットごとにAPI呼び出し
    let totalUpdated = 0
    let totalErrors = 0
    const now = new Date().toISOString()

    for (const [setId, group] of orderedSets) {
      try {
        // セットIDからゲームを判定
        const game = setId.endsWith('one-piece-card-game') ? 'one-piece-card-game' : 'pokemon-japan'

        // ページネーション対応: 全カード取得
        let apiCards: any[] = []
        let offset = 0
        const PAGE_SIZE = 100
        while (true) {
          const result = await getCards(setId, { game, offset, limit: PAGE_SIZE, includePriceHistory: false })
          apiCards.push(...(result.data || []))
          if (!result.meta.hasMore || (result.data || []).length < PAGE_SIZE) break
          offset += PAGE_SIZE
          await new Promise(resolve => setTimeout(resolve, DELAY_MS))
        }

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

        // バッチINSERT（同日の既存レコードがあればスキップ）
        if (historyRows.length > 0) {
          const today = now.substring(0, 10) // YYYY-MM-DD
          const cardIds = historyRows.map((r: any) => r.card_id)
          const { data: existing } = await supabase
            .from('justtcg_price_history')
            .select('card_id')
            .in('card_id', cardIds)
            .gte('recorded_at', `${today}T00:00:00`)
            .lte('recorded_at', `${today}T23:59:59`)
          const existingSet = new Set((existing || []).map((e: any) => e.card_id))
          const newRows = historyRows.filter((r: any) => !existingSet.has(r.card_id))

          if (newRows.length > 0) {
            for (let i = 0; i < newRows.length; i += 50) {
              const { error } = await supabase
                .from('justtcg_price_history')
                .insert(newRows.slice(i, i + 50))
              if (error) console.error(`[justtcg-price-sync] Insert error:`, error.message)
            }
          }
        }

        // cards.justtcg_nm_price_usd を更新
        let updateErrors = 0
        for (const { id, price } of cardUpdates) {
          const { error: updateError } = await supabase
            .from('cards')
            .update({ justtcg_nm_price_usd: price })
            .eq('id', id)
          if (updateError) {
            console.error(`[justtcg-price-sync] Update card ${id} error:`, updateError.message)
            updateErrors++
          }
        }
        if (updateErrors > 0) {
          console.warn(`[justtcg-price-sync] ${setId}: ${updateErrors} card update errors`)
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
      totalSets: orderedSets.length,
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
