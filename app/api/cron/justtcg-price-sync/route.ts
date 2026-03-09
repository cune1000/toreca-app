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
 * 1回で回りきらない場合、自動的にチェーン再実行して全カード完走する
 */
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const isChain = searchParams.get('chain') === '1'

    // チェーン呼び出し時はcron-gateをスキップ
    if (!isChain) {
      const force = searchParams.get('force') === '1'
      const gate = await shouldRunCronJob('justtcg-price-sync', { force })
      if (!gate.shouldRun) {
        return NextResponse.json({ skipped: true, reason: gate.reason })
      }
    }

    const supabase = createServiceClient()
    const startTime = Date.now()
    const now = new Date().toISOString()
    const today = now.substring(0, 10)

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
    const { data: alreadySynced } = await supabase
      .from('justtcg_price_history')
      .select('card_id')
      .gte('recorded_at', `${today}T00:00:00`)
      .lte('recorded_at', `${today}T23:59:59`)
    const syncedSet = new Set((alreadySynced || []).map((r: any) => r.card_id))

    // 3. セットIDでグルーピング（未更新カードがあるセットを優先）
    const unsyncedSetGroups = new Map<string, { cardId: string; justtcgId: string }[]>()
    const syncedSetGroups = new Map<string, { cardId: string; justtcgId: string }[]>()
    let unmatchedCount = 0

    for (const card of cards) {
      const setId = extractSetIdFromJusttcgId(card.justtcg_id)
      if (!setId) {
        unmatchedCount++
        continue
      }
      const targetMap = syncedSet.has(card.id) ? syncedSetGroups : unsyncedSetGroups
      if (!targetMap.has(setId)) targetMap.set(setId, [])
      targetMap.get(setId)!.push({ cardId: card.id, justtcgId: card.justtcg_id })
    }

    // 未更新セットを先に、更新済みセットは後
    const orderedSets = [...unsyncedSetGroups.entries(), ...syncedSetGroups.entries()]

    // 全カード更新済みなら完了
    if (unsyncedSetGroups.size === 0) {
      await markCronJobRun('justtcg-price-sync', 'success')
      return NextResponse.json({
        success: true,
        totalCards: cards.length,
        message: 'All cards already synced today',
      })
    }

    console.log(`[justtcg-price-sync] ${cards.length} cards → ${orderedSets.length} sets (${unsyncedSetGroups.size} unsynced, ${unmatchedCount} unmatched)`)

    // 4. セットごとにAPI呼び出し
    let totalUpdated = 0
    let totalErrors = 0
    let setsProcessed = 0
    let timedOut = false

    for (const [setId, group] of orderedSets) {
      // 270秒で安全に打ち切り
      if (Date.now() - startTime > 270_000) {
        timedOut = true
        console.warn(`[justtcg-price-sync] Timeout at ${setsProcessed}/${orderedSets.length} sets`)
        break
      }

      try {
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

        const apiCardMap = new Map<string, any>()
        for (const ac of apiCards) {
          apiCardMap.set(ac.id, ac)
        }

        const historyRows: any[] = []
        const cardUpdates: { id: string; price: number }[] = []

        for (const { cardId, justtcgId } of group) {
          const apiCard = apiCardMap.get(justtcgId)
          if (!apiCard) continue

          const nmVariant = apiCard.variants?.find(
            (v: any) => v.condition === 'Near Mint' && v.language === 'Japanese'
          ) || apiCard.variants?.find(
            (v: any) => v.condition === 'Near Mint'
          )

          const price = nmVariant?.price
          if (typeof price !== 'number' || price <= 0) continue

          historyRows.push({ card_id: cardId, price_usd: price, recorded_at: now })
          cardUpdates.push({ id: cardId, price })
        }

        // バッチINSERT（同日の既存レコードがあればスキップ）
        if (historyRows.length > 0) {
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
        for (const { id, price } of cardUpdates) {
          const { error: updateError } = await supabase
            .from('cards')
            .update({ justtcg_nm_price_usd: price })
            .eq('id', id)
          if (updateError) {
            console.error(`[justtcg-price-sync] Update card ${id}:`, updateError.message)
          }
        }

        totalUpdated += cardUpdates.length
        setsProcessed++
        console.log(`[justtcg-price-sync] ${setId}: ${cardUpdates.length}/${group.length} updated`)
      } catch (err: any) {
        console.error(`[justtcg-price-sync] Set ${setId} error:`, err.message)
        totalErrors++
        setsProcessed++
      }

      await new Promise(resolve => setTimeout(resolve, DELAY_MS))
    }

    // 未処理セットが残っていたらチェーン再実行
    const remaining = orderedSets.length - setsProcessed
    if (timedOut && remaining > 0) {
      const host = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : `http://localhost:3000`
      console.log(`[justtcg-price-sync] Chaining: ${remaining} sets remaining`)
      fetch(`${host}/api/cron/justtcg-price-sync?chain=1`, {
        headers: { 'Authorization': `Bearer ${process.env.CRON_SECRET}` },
      }).catch(e => console.error('[justtcg-price-sync] Chain failed:', e.message))
    }

    const summary = {
      success: true,
      totalCards: cards.length,
      totalSets: orderedSets.length,
      setsProcessed,
      totalUpdated,
      totalErrors,
      unmatchedCount,
      remaining,
      chained: timedOut && remaining > 0,
      durationMs: Date.now() - startTime,
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
