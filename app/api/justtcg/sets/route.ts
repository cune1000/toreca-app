import { NextRequest, NextResponse } from 'next/server'
import { getSets } from '@/lib/justtcg-api'

export const dynamic = 'force-dynamic'

// インメモリキャッシュ（24時間、ゲームごと）
const cacheMap = new Map<string, { data: any; usage?: any; at: number }>()
const CACHE_TTL = 24 * 60 * 60 * 1000
const MAX_CACHE_ENTRIES = 10
const VALID_GAMES = new Set(['pokemon-japan', 'pokemon', 'one-piece-card-game', 'digimon-card-game', 'union-arena', 'hololive-official-card-game', 'dragon-ball-super-fusion-world'])

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const gameParam = searchParams.get('game') || 'pokemon-japan'
    const game = VALID_GAMES.has(gameParam) ? gameParam : 'pokemon-japan'

    const now = Date.now()
    const cached = cacheMap.get(game)
    if (cached && now - cached.at < CACHE_TTL) {
      return NextResponse.json({ success: true, data: cached.data, usage: cached.usage || null, cached: true }, { // R12-17
        headers: { 'Cache-Control': 'public, max-age=1800, stale-while-revalidate=3600' },
      })
    }

    const result = await getSets(game)

    // 空データはキャッシュしない（API一時エラーの可能性）
    if (result.data && result.data.length > 0) {
      cacheMap.set(game, { data: result.data, usage: result.usage, at: now }) // R12-17: usageもキャッシュ

      // R12-08: キャッシュサイズ制限（期限切れ一掃 + 古い順削除）
      if (cacheMap.size > MAX_CACHE_ENTRIES) {
        for (const [key, entry] of cacheMap) {
          if (now - entry.at > CACHE_TTL) cacheMap.delete(key)
        }
        while (cacheMap.size > MAX_CACHE_ENTRIES) {
          const oldest = [...cacheMap.entries()].sort((a, b) => a[1].at - b[1].at)[0]
          if (oldest) cacheMap.delete(oldest[0])
          else break
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      usage: result.usage,
      cached: false,
    }, {
      headers: { 'Cache-Control': 'public, max-age=1800, stale-while-revalidate=3600' },
    })
  } catch (error: unknown) {
    console.error('JustTCG sets error:', error)
    // R13-API16: 内部エラー詳細をクライアントに漏らさない
    return NextResponse.json(
      { success: false, error: 'セット取得に失敗しました' },
      { status: 500 }
    )
  }
}
