import { NextRequest, NextResponse } from 'next/server'
import { getCards } from '@/lib/justtcg-api'

export const dynamic = 'force-dynamic'

// インメモリキャッシュ（1時間、game:setIdごと）
const cache = new Map<string, { data: any; at: number }>()
const CACHE_TTL = 60 * 60 * 1000

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const setId = searchParams.get('set')
    const game = searchParams.get('game') || 'pokemon-japan'

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
      return NextResponse.json({ success: true, ...cached.data, cached: true })
    }

    // 全カード取得（Professional: limit=100, 100req/min）
    let allCards: any[] = []
    let offset = 0
    const limit = 100
    let usage: any = null

    while (true) {
      const result = await getCards(setId, { offset, limit, game })
      allCards = allCards.concat(result.data)
      usage = result.usage

      if (!result.meta.hasMore) break
      offset += limit
    }

    const responseData = { data: allCards, total: allCards.length, usage }
    cache.set(cacheKey, { data: responseData, at: now })

    return NextResponse.json({ success: true, ...responseData, cached: false })
  } catch (error: any) {
    console.error('JustTCG cards error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch cards' },
      { status: 500 }
    )
  }
}
