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

    // R12-03: レート制限Mapのクリーンアップ（10件超で毎回期限切れ削除、上限超過時は半分削除）
    if (lastRequestMap.size > 10) {
      for (const [ip, ts] of lastRequestMap) {
        if (now - ts > RATE_LIMIT_MS * 10) lastRequestMap.delete(ip)
      }
    }
    if (lastRequestMap.size > MAX_RATE_LIMIT_ENTRIES) {
      const sorted = [...lastRequestMap.entries()].sort((a, b) => a[1] - b[1])
      sorted.slice(0, Math.floor(sorted.length / 2)).forEach(([ip]) => lastRequestMap.delete(ip))
    }

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ success: false, error: '不正なリクエスト形式' }, { status: 400 })
    }
    const { name, number: cardNumber, game } = body

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { success: false, error: 'name が必要です' },
        { status: 400 }
      )
    }

    // 入力長制限
    if (name.length > 200) {
      return NextResponse.json(
        { success: false, error: '入力が長すぎます' },
        { status: 400 }
      )
    }

    // R13-API05: cardNumber検証（文字列のみ許可）
    if (cardNumber != null && typeof cardNumber !== 'string') {
      return NextResponse.json(
        { success: false, error: 'number は文字列で指定してください' },
        { status: 400 }
      )
    }

    // ゲームに応じて "japanese" を付加（日本版ゲームのみ）
    const JAPANESE_GAMES = ['pokemon-japan', 'one-piece-card-game', 'digimon-card-game', 'union-arena', 'hololive-official-card-game', 'dragon-ball-super-fusion-world']
    const validGame = typeof game === 'string' && JAPANESE_GAMES.concat(['pokemon']).includes(game) ? game : 'pokemon-japan'
    const isJapaneseGame = JAPANESE_GAMES.includes(validGame)
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
      // R13-INT04: 単語境界で正確にマッチ（#1が#10,#100等に誤マッチしない）
      const numRegex = new RegExp(`#\\s?${num.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\D|$)`)
      const filtered = products.filter(p => {
        const pName = p['product-name'] || ''
        return numRegex.test(pName)
      })
      if (filtered.length > 0) matched = filtered
    }

    // 最もマッチ度が高い結果を返却
    const best = matched[0]
    // R13-INT05: price=0はデータなしとして扱う（PriceChartingが0を返す場合がある）
    const rawPrice = best['loose-price']
    const loosePrice = (typeof rawPrice === 'number' && rawPrice > 0) ? rawPrice : null

    // PriceChartingページから画像URL取得（5秒タイムアウト）
    let imageUrl: string | null = null
    const pricechartingUrl = `https://www.pricecharting.com/offers?product=${best.id}`
    try {
      const imgController = new AbortController()
      const imgTimeout = setTimeout(() => imgController.abort(), 5000)
      // R12-28: redirect:'follow' + ドメイン検証（リダイレクト先の画像も取得可能に）
      const pageRes = await fetch(pricechartingUrl, { signal: imgController.signal })
      clearTimeout(imgTimeout)
      const resHost = new URL(pageRes.url).hostname
      if (pageRes.ok && resHost === 'www.pricecharting.com') {
        // R12-12: Content-Type確認 + サイズ制限（メモリ防御）
        const contentType = pageRes.headers.get('content-type') || ''
        if (contentType.includes('text/html')) {
          const html = await pageRes.text()
          if (html.length <= 500_000) {
            const imgMatch = html.match(/src=["'](https:\/\/storage\.googleapis\.com\/images\.pricecharting\.com\/[^"']+)/)
            if (imgMatch) {
              imageUrl = imgMatch[1].replace(/\/\d+\.jpg/, '/1600.jpg')
            }
          }
        }
      }
    } catch (_e) {
      // 画像取得失敗は無視（価格データは返す）
    }

    return NextResponse.json({
      success: true,
      data: {
        id: String(best.id),
        name: best['product-name'],
        consoleName: best['console-name'],
        loosePrice,
        loosePriceDollars: loosePrice != null ? loosePrice / 100 : null,
        imageUrl,
        pricechartingUrl,
      },
    })
  } catch (error: unknown) {
    console.error('JustTCG match error:', error)
    // R13-API16: 内部エラー詳細をクライアントに漏らさない
    return NextResponse.json(
      { success: false, error: 'マッチング処理に失敗しました' },
      { status: 500 }
    )
  }
}
