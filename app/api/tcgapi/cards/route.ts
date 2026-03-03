import { NextRequest, NextResponse } from 'next/server'
import { getCards } from '@/lib/tcgapi'

export const dynamic = 'force-dynamic'

// インメモリキャッシュ（1時間、setIdごと）
const cache = new Map<string, { data: any; at: number }>()
const CACHE_TTL = 60 * 60 * 1000
const MAX_CACHE_ENTRIES = 50
const MAX_PAGES = 20 // 安全ガード
const PAGINATION_TIMEOUT = 25_000

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const setIdStr = searchParams.get('setId')

    // setId形式検証（数値のみ）
    if (!setIdStr || !/^\d{1,10}$/.test(setIdStr)) {
      return NextResponse.json(
        { success: false, error: 'setId パラメータが不正です' },
        { status: 400 }
      )
    }

    const setId = parseInt(setIdStr, 10)
    const cacheKey = String(setId)
    const now = Date.now()
    const cached = cache.get(cacheKey)
    if (cached && now - cached.at < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        data: cached.data.data,
        total: cached.data.total,
        cached: true,
      }, {
        headers: { 'Cache-Control': 'public, max-age=900, stale-while-revalidate=1800' },
      })
    }

    // 全カード取得（ページネーション: per_page=100）
    let allCards: any[] = []
    let page = 1
    let pages = 0
    const paginationStart = Date.now()
    let partial = false

    while (pages < MAX_PAGES) {
      if (Date.now() - paginationStart > PAGINATION_TIMEOUT) {
        console.warn(`TCG API cards pagination timeout: ${pages} pages for set ${setId}`)
        partial = true
        break
      }
      try {
        const result = await getCards(setId, { page, perPage: 100 })
        if (!Array.isArray(result.cards) || result.cards.length === 0) break
        allCards = allCards.concat(result.cards)
        pages++
        if (!result.hasMore) break
        page++
      } catch (pageError) {
        console.warn(`TCG API cards page ${page} error for set ${setId}:`, pageError)
        partial = true
        break
      }
    }

    const responseData = { data: allCards, total: allCards.length }

    if (allCards.length > 0 && !partial) {
      cache.set(cacheKey, { data: responseData, at: Date.now() })
    }

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

    return NextResponse.json({ success: true, ...responseData, cached: false }, {
      headers: { 'Cache-Control': 'public, max-age=900, stale-while-revalidate=1800' },
    })
  } catch (error: unknown) {
    console.error('TCG API cards error:', error)
    return NextResponse.json(
      { success: false, error: 'カード取得に失敗しました' },
      { status: 500 }
    )
  }
}
