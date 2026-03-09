import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getCards, extractSetIdFromJusttcgId } from '@/lib/justtcg-api'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const DELAY_MS = 1100

/**
 * JustTCG 欠損日バックフィル（チェーン対応）
 * APIのpriceHistoryから過去の価格を取得し、DBに存在しない日のデータを埋める
 * ?start=0 でセットのオフセット指定可能
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const startIdx = parseInt(searchParams.get('start') || '0', 10)

  const supabase = createServiceClient()
  const startTime = Date.now()

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

  const allSets = [...setGroups.entries()]

  // 既存の全履歴を取得
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
  let lastIdx = startIdx

  for (let i = startIdx; i < allSets.length; i++) {
    if (Date.now() - startTime > 240_000) break // 240秒で打ち切り（チェーン用に余裕を持つ）

    const [setId, group] = allSets[i]
    lastIdx = i + 1

    try {
      const game = setId.endsWith('one-piece-card-game') ? 'one-piece-card-game' : 'pokemon-japan'

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
          existingKeys.add(key)
        }
      }

      for (let j = 0; j < newRows.length; j += 50) {
        const { error } = await supabase
          .from('justtcg_price_history')
          .insert(newRows.slice(j, j + 50))
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

  const remaining = allSets.length - lastIdx
  // 自動チェーン
  if (remaining > 0) {
    const host = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : `http://localhost:3000`
    console.log(`[backfill] Chaining: start=${lastIdx}, ${remaining} sets remaining`)
    fetch(`${host}/api/debug/justtcg-backfill?start=${lastIdx}`, {
      headers: { 'Authorization': `Bearer ${process.env.CRON_SECRET}` },
    }).catch(e => console.error('[backfill] Chain failed:', e.message))
  }

  return NextResponse.json({
    success: true,
    totalCards: cards.length,
    totalSets: allSets.length,
    startIdx,
    setsProcessed,
    totalFilled,
    remaining,
    chained: remaining > 0,
    durationMs: Date.now() - startTime,
  })
}
