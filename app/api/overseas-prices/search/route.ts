import { NextRequest, NextResponse } from 'next/server'
import { searchProducts } from '@/lib/pricecharting-api'

export const dynamic = 'force-dynamic'

// 簡易レート制限（IPごとに10秒間隔）
const lastRequestMap = new Map<string, number>()
const RATE_LIMIT_MS = 10_000

/**
 * PriceCharting テキスト検索
 * GET /api/overseas-prices/search?q=charizard+pokemon
 */
export async function GET(request: NextRequest) {
  try {
    // 簡易レート制限
    const clientIp = (request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim()
    const now = Date.now()
    const lastRequest = lastRequestMap.get(clientIp) || 0
    if (now - lastRequest < RATE_LIMIT_MS) {
      return NextResponse.json(
        { success: false, error: 'リクエストが多すぎます。少し待ってから再試行してください。' },
        { status: 429 }
      )
    }
    lastRequestMap.set(clientIp, now)

    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')

    if (!q || q.trim().length < 2) {
      return NextResponse.json(
        { success: false, error: '2文字以上の検索ワードを入力してください' },
        { status: 400 }
      )
    }

    const products = await searchProducts(q.trim())

    return NextResponse.json({
      success: true,
      data: products,
    })
  } catch (error: any) {
    console.error('PriceCharting search error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Search failed' },
      { status: 500 }
    )
  }
}
