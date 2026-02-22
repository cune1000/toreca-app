import { NextResponse } from 'next/server'
import { getSets } from '@/lib/justtcg-api'

export const dynamic = 'force-dynamic'

// インメモリキャッシュ（24時間）
let cachedSets: any = null
let cachedAt = 0
const CACHE_TTL = 24 * 60 * 60 * 1000

export async function GET() {
  try {
    const now = Date.now()
    if (cachedSets && now - cachedAt < CACHE_TTL) {
      return NextResponse.json({ success: true, data: cachedSets, cached: true })
    }

    const result = await getSets()
    cachedSets = result.data
    cachedAt = now

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
