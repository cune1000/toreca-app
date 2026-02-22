import { NextRequest, NextResponse } from 'next/server'
import { getCards } from '@/lib/justtcg-api'

export const dynamic = 'force-dynamic'

// インメモリキャッシュ（1時間、セットIDごと）
const cache = new Map<string, { data: any; at: number }>()
const CACHE_TTL = 60 * 60 * 1000

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const setId = searchParams.get('set')

    if (!setId) {
      return NextResponse.json(
        { success: false, error: 'set パラメータが必要です' },
        { status: 400 }
      )
    }

    const now = Date.now()
    const cached = cache.get(setId)
    if (cached && now - cached.at < CACHE_TTL) {
      return NextResponse.json({ success: true, ...cached.data, cached: true })
    }

    // 全カード取得（ページング、Free Tierはlimit最大20）
    let allCards: any[] = []
    let offset = 0
    const limit = 20
    let usage: any = null

    while (true) {
      const result = await getCards(setId, { offset, limit })
      allCards = allCards.concat(result.data)
      usage = result.usage

      if (!result.meta.hasMore) break
      offset += limit
    }

    const responseData = { data: allCards, total: allCards.length, usage }
    cache.set(setId, { data: responseData, at: now })

    return NextResponse.json({ success: true, ...responseData, cached: false })
  } catch (error: any) {
    console.error('JustTCG cards error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch cards' },
      { status: 500 }
    )
  }
}
