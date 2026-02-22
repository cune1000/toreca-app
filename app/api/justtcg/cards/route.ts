import { NextRequest, NextResponse } from 'next/server'
import { getCards } from '@/lib/justtcg-api'

export const dynamic = 'force-dynamic'

// インメモリキャッシュ（1時間、game:setIdごと）
const cache = new Map<string, { data: any; at: number }>()
const CACHE_TTL = 60 * 60 * 1000
const MAX_CACHE_ENTRIES = 50
const MAX_PAGES = 20 // 安全ガード: 最大2000カード
const VALID_GAMES = new Set(['pokemon-japan', 'pokemon', 'one-piece-card-game', 'digimon-card-game', 'union-arena', 'hololive-official-card-game', 'dragon-ball-super-fusion-world'])

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const setId = searchParams.get('set')
    const gameParam = searchParams.get('game') || 'pokemon-japan'
    const game = VALID_GAMES.has(gameParam) ? gameParam : 'pokemon-japan'

    if (!setId) {
      return NextResponse.json(
        { success: false, error: 'set パラメータが必要です' },
        { status: 400 }
      )
    }

    const cacheKey = `${game}:${setId}`
    const now = Date.now()
    const cached = cache.get(cacheKey)
    if (cached && now - cached.at < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        data: cached.data.data,
        total: cached.data.total,
        usage: cached.data.usage || null,
        cached: true,
      })
    }

    // 全カード取得（Professional: limit=100, 100req/min）
    let allCards: any[] = []
    let offset = 0
    const limit = 100
    let usage: any = null
    let pages = 0

    while (pages < MAX_PAGES) {
      const result = await getCards(setId, { offset, limit, game })
      allCards = allCards.concat(result.data)
      usage = result.usage
      pages++

      if (!result.meta.hasMore) break
      offset += limit
    }

    const responseData = { data: allCards, total: allCards.length, usage }

    // 空データはキャッシュしない（API一時エラーの可能性）
    if (allCards.length > 0) {
      cache.set(cacheKey, { data: responseData, at: now })
    }

    // キャッシュサイズ制限（古いエントリを削除）
    if (cache.size > MAX_CACHE_ENTRIES) {
      const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0]
      if (oldest) cache.delete(oldest[0])
    }

    return NextResponse.json({ success: true, ...responseData, usage, cached: false })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch cards'
    console.error('JustTCG cards error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
