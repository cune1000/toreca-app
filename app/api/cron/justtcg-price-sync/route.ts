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

    // 1. justtcg_id が設定済みのカードを全取得（ページネーション）
    let cards: { id: string; justtcg_id: string }[] = []
    let cardOffset = 0
    const PAGE = 1000
    while (true) {
      const { data: page, error: pageError } = await supabase
        .from('cards')
        .select('id, justtcg_id')
        .not('justtcg_id', 'is', null)
        .range(cardOffset, cardOffset + PAGE - 1)
      if (pageError) throw pageError
      if (!page || page.length === 0) break
      cards = cards.concat(page)
      if (page.length < PAGE) break
      cardOffset += PAGE
    }

    if (cards.length === 0) {
      await markCronJobRun('justtcg-price-sync', 'success')
      return NextResponse.json({ success: true, message: 'No cards with justtcg_id', processed: 0 })
    }

    // 2. 今日既に更新済みのカードを特定（ページネーション）
    let alreadySynced: { card_id: string }[] = []
    let syncOffset = 0
    while (true) {
      const { data: syncPage } = await supabase
        .from('justtcg_price_history')
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

    // 3. 未更新カードをセットIDでグルーピング
    const unsyncedSetGroups = new Map<string, { cardId: string; justtcgId: string }[]>()
    let unmatchedCount = 0

    for (const card of cards) {
      if (syncedSet.has(card.id)) continue // 今日更新済みはスキップ
      const setId = extractSetIdFromJusttcgId(card.justtcg_id)
      if (!setId) {
        unmatchedCount++
        continue
      }
      if (!unsyncedSetGroups.has(setId)) unsyncedSetGroups.set(setId, [])
      unsyncedSetGroups.get(setId)!.push({ cardId: card.id, justtcgId: card.justtcg_id })
    }

    // 全カード更新済みなら完了
    if (unsyncedSetGroups.size === 0) {
      await markCronJobRun('justtcg-price-sync', 'success')
      return NextResponse.json({
        success: true,
        totalCards: cards.length,
        message: 'All cards already synced today',
      })
    }

    // 4. 未更新セットのみ処理（更新済みセットはスキップ）
    const unsyncedSets = [...unsyncedSetGroups.entries()]

    console.log(`[justtcg-price-sync] ${cards.length} cards → ${unsyncedSets.length} unsynced sets (${unmatchedCount} unmatched)`)
    let totalUpdated = 0
    let totalErrors = 0
    let setsProcessed = 0
    let timedOut = false

    for (const [setId, group] of unsyncedSets) {
      // 270秒で安全に打ち切り
      if (Date.now() - startTime > 270_000) {
        timedOut = true
        console.warn(`[justtcg-price-sync] Timeout at ${setsProcessed}/${unsyncedSets.length} sets`)
        break
      }

      try {
        const game = setId.endsWith('one-piece-card-game') ? 'one-piece-card-game' : 'pokemon-japan'

        // ページネーション対応: 全カード取得
        let apiCards: Array<{ id: string; variants?: Array<{ condition?: string; language?: string; price?: number }> }> = []
        let offset = 0
        const PAGE_SIZE = 100
        while (true) {
          const result = await getCards(setId, { game, offset, limit: PAGE_SIZE, includePriceHistory: false })
          apiCards.push(...(result.data || []))
          if (!result.meta.hasMore || (result.data || []).length < PAGE_SIZE) break
          offset += PAGE_SIZE
          await new Promise(resolve => setTimeout(resolve, DELAY_MS))
        }

        const apiCardMap = new Map<string, typeof apiCards[0]>()
        for (const ac of apiCards) {
          apiCardMap.set(ac.id, ac)
        }

        const historyRows: { card_id: string; price_usd: number; recorded_at: string }[] = []
        const cardUpdates: { id: string; price: number }[] = []

        for (const { cardId, justtcgId } of group) {
          const apiCard = apiCardMap.get(justtcgId)
          if (!apiCard) continue

          // 優先順: NM Japanese > NM Any > Sealed Japanese > Sealed Any > 最初のprice付きvariant
          const variants = apiCard.variants || []
          const bestVariant =
            variants.find((v) => v.condition === 'Near Mint' && v.language === 'Japanese') ||
            variants.find((v) => v.condition === 'Near Mint') ||
            variants.find((v) => v.condition === 'Sealed' && v.language === 'Japanese') ||
            variants.find((v) => v.condition === 'Sealed') ||
            variants.find((v) => typeof v.price === 'number' && v.price > 0)

          const price = bestVariant?.price
          if (typeof price !== 'number' || price <= 0) continue

          historyRows.push({ card_id: cardId, price_usd: price, recorded_at: now })
          cardUpdates.push({ id: cardId, price })
        }

        // バッチINSERT（同日の既存レコードがあればスキップ）
        if (historyRows.length > 0) {
          const cardIds = historyRows.map((r) => r.card_id)
          const { data: existing } = await supabase
            .from('justtcg_price_history')
            .select('card_id')
            .in('card_id', cardIds)
            .gte('recorded_at', `${today}T00:00:00`)
            .lte('recorded_at', `${today}T23:59:59`)
            .limit(10000)
          const existingSet = new Set((existing || []).map((e) => e.card_id))
          const newRows = historyRows.filter((r) => !existingSet.has(r.card_id))

          if (newRows.length > 0) {
            for (let i = 0; i < newRows.length; i += 50) {
              const { error } = await supabase
                .from('justtcg_price_history')
                .insert(newRows.slice(i, i + 50))
              if (error) console.error(`[justtcg-price-sync] Insert error:`, error.message)
            }
          }
        }

        // cards.justtcg_nm_price_usd をバッチ並列更新（10件ずつ）
        for (let i = 0; i < cardUpdates.length; i += 10) {
          const batch = cardUpdates.slice(i, i + 10)
          const results = await Promise.all(
            batch.map(({ id, price }) =>
              supabase.from('cards').update({ justtcg_nm_price_usd: price }).eq('id', id)
            )
          )
          for (const { error: updateError } of results) {
            if (updateError) {
              console.error(`[justtcg-price-sync] Update card error:`, updateError.message)
            }
          }
        }

        totalUpdated += cardUpdates.length
        setsProcessed++
        console.log(`[justtcg-price-sync] ${setId}: ${cardUpdates.length}/${group.length} updated`)
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err)
        console.error(`[justtcg-price-sync] Set ${setId} error:`, errMsg)
        totalErrors++
        setsProcessed++
      }

      await new Promise(resolve => setTimeout(resolve, DELAY_MS))
    }

    // 未処理の未更新セットが残っていたらチェーン再実行
    const remaining = unsyncedSets.length - setsProcessed
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
      totalSets: unsyncedSets.length,
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[justtcg-price-sync] Cron error:', error)
    await markCronJobRun('justtcg-price-sync', 'error', message).catch(() => {})
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}
