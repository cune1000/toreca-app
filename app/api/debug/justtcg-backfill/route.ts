import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getCards, extractSetIdFromJusttcgId } from '@/lib/justtcg-api'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const DELAY_MS = 1100

/**
 * JustTCG 欠損日バックフィル（一回限り）
 * APIのpriceHistoryから過去の価格を取得し、DBに存在しない日のデータを埋める
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const startTime = Date.now()

  // justtcg_id が設定済みのカードを全取得
  const { data: cards, error: cardsError } = await supabase
    .from('cards')
    .select('id, justtcg_id')
    .not('justtcg_id', 'is', null)
    .limit(10000)

  if (cardsError) throw cardsError
  if (!cards || cards.length === 0) {
    return NextResponse.json({ success: true, message: 'No cards', filled: 0 })
  }

  // セットIDでグルーピング
  const setGroups = new Map<string, { cardId: string; justtcgId: string }[]>()
  for (const card of cards) {
    const setId = extractSetIdFromJusttcgId(card.justtcg_id)
    if (!setId) continue
    if (!setGroups.has(setId)) setGroups.set(setId, [])
    setGroups.get(setId)!.push({ cardId: card.id, justtcgId: card.justtcg_id })
  }

  // 既存の全履歴を取得（card_id + 日付のセットを作る）
  const { data: existingHistory } = await supabase
    .from('justtcg_price_history')
    .select('card_id, recorded_at')
    .limit(10000)

  const existingKeys = new Set(
    (existingHistory || []).map((r: any) => {
      const day = r.recorded_at.substring(0, 10)
      return `${r.card_id}_${day}`
    })
  )

  let totalFilled = 0
  let setsProcessed = 0

  for (const [setId, group] of setGroups.entries()) {
    if (Date.now() - startTime > 270_000) break

    try {
      const game = setId.endsWith('one-piece-card-game') ? 'one-piece-card-game' : 'pokemon-japan'

      // priceHistory付きで取得
      let apiCards: any[] = []
      let offset = 0
      while (true) {
        const result = await getCards(setId, { game, offset, limit: 100, includePriceHistory: true })
        apiCards.push(...(result.data || []))
        if (!result.meta.hasMore || (result.data || []).length < 100) break
        offset += 100
        await new Promise(resolve => setTimeout(resolve, DELAY_MS))
      }

      const apiCardMap = new Map<string, any>()
      for (const ac of apiCards) apiCardMap.set(ac.id, ac)

      const newRows: any[] = []

      for (const { cardId, justtcgId } of group) {
        const apiCard = apiCardMap.get(justtcgId)
        if (!apiCard) continue

        const variants = apiCard.variants || []
        const bestVariant =
          variants.find((v: any) => v.condition === 'Near Mint' && v.language === 'Japanese') ||
          variants.find((v: any) => v.condition === 'Near Mint') ||
          variants.find((v: any) => v.condition === 'Sealed' && v.language === 'Japanese') ||
          variants.find((v: any) => v.condition === 'Sealed') ||
          variants.find((v: any) => typeof v.price === 'number' && v.price > 0)

        if (!bestVariant?.priceHistory) continue

        // priceHistoryの各エントリを日別に集約（1日1レコード、最後の値を採用）
        const dayPrices = new Map<string, { price: number; timestamp: number }>()
        for (const entry of bestVariant.priceHistory) {
          if (typeof entry.p !== 'number' || entry.p <= 0) continue
          const date = new Date(entry.t * 1000)
          const day = date.toISOString().substring(0, 10)
          const existing = dayPrices.get(day)
          if (!existing || entry.t > existing.timestamp) {
            dayPrices.set(day, { price: entry.p, timestamp: entry.t })
          }
        }

        for (const [day, { price, timestamp }] of dayPrices.entries()) {
          const key = `${cardId}_${day}`
          if (existingKeys.has(key)) continue
          newRows.push({
            card_id: cardId,
            price_usd: price,
            recorded_at: new Date(timestamp * 1000).toISOString(),
          })
          existingKeys.add(key) // 重複防止
        }
      }

      // バッチINSERT
      for (let i = 0; i < newRows.length; i += 50) {
        const { error } = await supabase
          .from('justtcg_price_history')
          .insert(newRows.slice(i, i + 50))
        if (error) console.error(`[backfill] Insert error:`, error.message)
      }

      totalFilled += newRows.length
      setsProcessed++
      if (newRows.length > 0) {
        console.log(`[backfill] ${setId}: ${newRows.length} rows filled`)
      }
    } catch (err: any) {
      console.error(`[backfill] ${setId} error:`, err.message)
      setsProcessed++
    }

    await new Promise(resolve => setTimeout(resolve, DELAY_MS))
  }

  return NextResponse.json({
    success: true,
    totalCards: cards.length,
    setsProcessed,
    totalFilled,
    durationMs: Date.now() - startTime,
  })
}
