import { NextRequest, NextResponse } from 'next/server'
import { searchProducts } from '@/lib/pricecharting-api'

export const dynamic = 'force-dynamic'

// レート制限（IPごとに3秒間隔）
const lastRequestMap = new Map<string, number>()
const RATE_LIMIT_MS = 3_000
const MAX_RATE_LIMIT_ENTRIES = 100

export async function POST(request: NextRequest) {
  try {
    // レート制限
    const clientIp = (request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim()
    const now = Date.now()
    const last = lastRequestMap.get(clientIp) || 0
    if (now - last < RATE_LIMIT_MS) {
      return NextResponse.json(
        { success: false, error: 'リクエストが多すぎます。少し待ってください。' },
        { status: 429 }
      )
    }
    lastRequestMap.set(clientIp, now)

    // レート制限Mapのクリーンアップ
    if (lastRequestMap.size > MAX_RATE_LIMIT_ENTRIES) {
      for (const [ip, ts] of lastRequestMap) {
        if (now - ts > RATE_LIMIT_MS * 10) lastRequestMap.delete(ip)
      }
    }

    const body = await request.json()
    const { name, number: cardNumber, game } = body

    if (!name) {
      return NextResponse.json(
        { success: false, error: 'name が必要です' },
        { status: 400 }
      )
    }

    // ゲームに応じて "japanese" を付加（日本版ゲームのみ）
    const JAPANESE_GAMES = ['pokemon-japan', 'one-piece-card-game', 'digimon-card-game', 'union-arena', 'hololive-official-card-game', 'dragon-ball-super-fusion-world']
    const isJapaneseGame = !game || JAPANESE_GAMES.includes(game)
    const query = isJapaneseGame ? `${name} japanese` : name
    const products = await searchProducts(query)

    if (!products || products.length === 0) {
      return NextResponse.json({ success: true, data: null, message: 'マッチなし' })
    }

    // カード番号でフィルタリング
    let matched = products
    if (cardNumber) {
      // "115/080" -> "115" (スラッシュ前)
      const num = cardNumber.split('/')[0]
      const filtered = products.filter(p => {
        const pName = p['product-name'] || ''
        return pName.includes(`#${num}`) || pName.includes(`# ${num}`)
      })
      if (filtered.length > 0) matched = filtered
    }

    // 最もマッチ度が高い結果を返却
    const best = matched[0]
    const loosePrice = best['loose-price'] ?? null

    // PriceChartingページから画像URL取得（5秒タイムアウト）
    let imageUrl: string | null = null
    const pricechartingUrl = `https://www.pricecharting.com/offers?product=${best.id}`
    try {
      const imgController = new AbortController()
      const imgTimeout = setTimeout(() => imgController.abort(), 5000)
      const pageRes = await fetch(pricechartingUrl, { signal: imgController.signal })
      clearTimeout(imgTimeout)
      if (pageRes.ok) {
        const html = await pageRes.text()
        const imgMatch = html.match(/src=["'](https:\/\/storage\.googleapis\.com\/images\.pricecharting\.com\/[^"']+)/)
        if (imgMatch) {
          imageUrl = imgMatch[1].replace(/\/\d+\.jpg/, '/1600.jpg')
        }
      }
    } catch (_e) {
      // 画像取得失敗は無視（価格データは返す）
    }

    return NextResponse.json({
      success: true,
      data: {
        id: best.id,
        name: best['product-name'],
        consoleName: best['console-name'],
        loosePrice,
        loosePriceDollars: loosePrice != null ? loosePrice / 100 : null,
        imageUrl,
        pricechartingUrl,
      },
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Match failed'
    console.error('JustTCG match error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
