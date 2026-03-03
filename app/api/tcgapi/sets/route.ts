import { NextRequest, NextResponse } from 'next/server'
import { getSets } from '@/lib/tcgapi'
import { getSets as getJustTcgSets } from '@/lib/justtcg-api'

export const dynamic = 'force-dynamic'

// インメモリキャッシュ（24時間、ゲームごと）
const cacheMap = new Map<string, { data: any; rateLimit: any; at: number }>()
const CACHE_TTL = 24 * 60 * 60 * 1000
const MAX_CACHE_ENTRIES = 10
const VALID_GAMES = new Set(['pokemon-japan', 'one-piece-card-game'])

/**
 * JustTCG APIからセット発売日マップを取得（TCG APIが発売日を返さないため補完用）
 * キー: JustTCG set ID = "{slug}-{game}" と一致
 */
async function getReleaseDateMap(game: string): Promise<Record<string, string>> {
  try {
    const res = await getJustTcgSets(game)
    const map: Record<string, string> = {}
    for (const s of res.data) {
      if (s.release_date) map[s.id] = s.release_date
    }
    return map
  } catch (e) {
    console.warn('JustTCG release date fetch failed (non-fatal):', e)
    return {}
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const gameParam = searchParams.get('game') || 'pokemon-japan'
    const game = VALID_GAMES.has(gameParam) ? gameParam : 'pokemon-japan'

    const now = Date.now()
    const cached = cacheMap.get(game)
    if (cached && now - cached.at < CACHE_TTL) {
      return NextResponse.json({ success: true, data: cached.data, rateLimit: cached.rateLimit, cached: true }, {
        headers: { 'Cache-Control': 'public, max-age=1800, stale-while-revalidate=3600' },
      })
    }

    // TCG API + JustTCG（発売日補完）を並列取得
    const [result, dateMap] = await Promise.all([
      getSets(game),
      getReleaseDateMap(game),
    ])

    // JustTCGの発売日でTCG APIセットを補完
    const enrichedSets = result.sets.map(s => {
      const justTcgKey = `${s.slug}-${game}`
      return {
        ...s,
        release_date: s.release_date || dateMap[justTcgKey] || null,
      }
    })

    // 空データはキャッシュしない
    if (enrichedSets.length > 0) {
      cacheMap.set(game, { data: enrichedSets, rateLimit: result.rateLimit, at: now })

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

    return NextResponse.json({ success: true, data: enrichedSets, rateLimit: result.rateLimit, cached: false }, {
      headers: { 'Cache-Control': 'public, max-age=1800, stale-while-revalidate=3600' },
    })
  } catch (error: unknown) {
    console.error('TCG API sets error:', error)
    return NextResponse.json(
      { success: false, error: 'セット取得に失敗しました' },
      { status: 500 }
    )
  }
}
