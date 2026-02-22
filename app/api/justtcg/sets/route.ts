import { NextRequest, NextResponse } from 'next/server'
import { getSets } from '@/lib/justtcg-api'

export const dynamic = 'force-dynamic'

// インメモリキャッシュ（24時間、ゲームごと）
const cacheMap = new Map<string, { data: any; at: number }>()
const CACHE_TTL = 24 * 60 * 60 * 1000
const MAX_CACHE_ENTRIES = 10

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const game = searchParams.get('game') || 'pokemon-japan'

    const now = Date.now()
    const cached = cacheMap.get(game)
    if (cached && now - cached.at < CACHE_TTL) {
      return NextResponse.json({ success: true, data: cached.data, cached: true })
    }

    const result = await getSets(game)

    // 空データはキャッシュしない（API一時エラーの可能性）
    if (result.data && result.data.length > 0) {
      cacheMap.set(game, { data: result.data, at: now })

      // キャッシュサイズ制限
      if (cacheMap.size > MAX_CACHE_ENTRIES) {
        const oldest = [...cacheMap.entries()].sort((a, b) => a[1].at - b[1].at)[0]
        if (oldest) cacheMap.delete(oldest[0])
      }
    }

    return NextResponse.json({
      success: true,
      data: result.data,
      usage: result.usage,
      cached: false,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to fetch sets'
    console.error('JustTCG sets error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
