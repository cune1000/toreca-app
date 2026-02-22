import { NextRequest, NextResponse } from 'next/server'
import { getSets } from '@/lib/justtcg-api'

export const dynamic = 'force-dynamic'

// インメモリキャッシュ（24時間、ゲームごと）
const cacheMap = new Map<string, { data: any; at: number }>()
const CACHE_TTL = 24 * 60 * 60 * 1000

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
    cacheMap.set(game, { data: result.data, at: now })

    return NextResponse.json({
      success: true,
      data: result.data,
      usage: result.usage,
      cached: false,
    })
  } catch (error: any) {
    console.error('JustTCG sets error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch sets' },
      { status: 500 }
    )
  }
}
