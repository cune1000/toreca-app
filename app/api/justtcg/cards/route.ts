import { NextRequest, NextResponse } from 'next/server'
import { getCards } from '@/lib/justtcg-api'

export const dynamic = 'force-dynamic'

// インメモリキャッシュ（1時間、game:setIdごと）
const cache = new Map<string, { data: any; at: number }>()
const CACHE_TTL = 60 * 60 * 1000
const MAX_CACHE_ENTRIES = 50
const MAX_PAGES = 20 // 安全ガード: 最大2000カード
const PAGINATION_TIMEOUT = 25_000 // R11-02: 25秒（Vercel関数タイムアウトの余裕）
const VALID_GAMES = new Set(['pokemon-japan', 'pokemon', 'one-piece-card-game', 'digimon-card-game', 'union-arena', 'hololive-official-card-game', 'dragon-ball-super-fusion-world'])

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const setId = searchParams.get('set')
    const gameParam = searchParams.get('game') || 'pokemon-japan'
    const game = VALID_GAMES.has(gameParam) ? gameParam : 'pokemon-japan'

    // R13-API17: setId形式検証（英数字・ハイフン・アンダースコアのみ）
    if (!setId || typeof setId !== 'string' || setId.length > 200 || !/^[\w-]+$/.test(setId)) {
      return NextResponse.json(
        { success: false, error: 'set パラメータが不正です' },
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
        usage: cached.data.usage || null, // R12-17: キャッシュからもusageを返却
        cached: true,
      }, {
        headers: { 'Cache-Control': 'public, max-age=900, stale-while-revalidate=1800' },
      })
    }

    // 全カード取得（Professional: limit=100, 100req/min）
    let allCards: any[] = []
    let offset = 0
    const limit = 100
    let usage: any = null
    let pages = 0
    const paginationStart = Date.now()

    let partial = false // R13-API08: 部分取得フラグ
    while (pages < MAX_PAGES) {
      // R11-02: 全体タイムアウトチェック（大量セットでVercel関数タイムアウトを防止）
      if (Date.now() - paginationStart > PAGINATION_TIMEOUT) {
        console.warn(`JustTCG cards pagination timeout: ${pages} pages fetched for ${cacheKey}`)
        partial = true
        break
      }
      // R13-INT11: ページネーション内try-catch（1ページの失敗で全体が壊れない）
      try {
        const result = await getCards(setId, { offset, limit, game })
        if (!Array.isArray(result.data) || result.data.length === 0) break
        allCards = allCards.concat(result.data)
        usage = result.usage
        pages++

        if (!result.meta.hasMore) break
        offset += limit
      } catch (pageError) {
        console.warn(`JustTCG cards page ${pages} error for ${cacheKey}:`, pageError)
        partial = true
        break
      }
    }

    const responseData = { data: allCards, total: allCards.length, usage }

    // R13-API08: 空データ・部分取得はキャッシュしない（次回の完全取得を優先）
    if (allCards.length > 0 && !partial) {
      cache.set(cacheKey, { data: responseData, at: Date.now() }) // R12-07: ページネーション後の正確なタイムスタンプ
    }

    // R12-08: キャッシュサイズ制限（まず期限切れを一掃、それでも超過なら古い順に削除）
    if (cache.size > MAX_CACHE_ENTRIES) {
      const currentTime = Date.now()
      for (const [key, entry] of cache) {
        if (currentTime - entry.at > CACHE_TTL) cache.delete(key)
      }
      while (cache.size > MAX_CACHE_ENTRIES) {
        const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0]
        if (oldest) cache.delete(oldest[0])
        else break
      }
    }

    return NextResponse.json({ success: true, ...responseData, cached: false }, { // R12-16: 冗長なusageを削除（responseDataに含有）
      headers: { 'Cache-Control': 'public, max-age=900, stale-while-revalidate=1800' },
    })
  } catch (error: unknown) {
    console.error('JustTCG cards error:', error)
    // R13-API16: 内部エラー詳細をクライアントに漏らさない
    return NextResponse.json(
      { success: false, error: 'カード取得に失敗しました' },
      { status: 500 }
    )
  }
}
