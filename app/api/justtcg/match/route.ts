import { NextRequest, NextResponse } from 'next/server'
import { searchProducts } from '@/lib/pricecharting-api'

export const dynamic = 'force-dynamic'

// レート制限（IPごとに0.5秒間隔）
const lastRequestMap = new Map<string, number>()
const RATE_LIMIT_MS = 500
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
    const { name, number: cardNumber, game, setName } = body

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
    const JAPANESE_GAMES = ['pokemon-japan', 'one-piece-card-game']
    const validGame = typeof game === 'string' && JAPANESE_GAMES.includes(game) ? game : 'pokemon-japan'
    const isJapaneseGame = JAPANESE_GAMES.includes(validGame)
    // カード名からバリアント表記を除去して検索精度を上げる
    // "Pikachu (Mirror Holofoil)" → "Pikachu"
    // "Mew - 030/028" → "Mew"
    const cleanName = name.replace(/\s*\(.*?\)/g, '').replace(/\s+-\s+.*$/, '').trim() || name
    const cleanSetName = typeof setName === 'string' ? setName.trim() : ''
    // 検索クエリにセット名を含めて精度向上（APIは最大20件なのでクエリ段階で絞る）
    const queryParts = [cleanName]
    if (cleanSetName) queryParts.push(cleanSetName)
    if (isJapaneseGame) queryParts.push('japanese')
    const query = queryParts.join(' ')
    const products = await searchProducts(query)

    if (!products || products.length === 0) {
      return NextResponse.json({ success: true, data: null, message: 'マッチなし' })
    }

    // 収録弾名（console-name）でフィルタリング
    let matched = products
    if (typeof setName === 'string' && setName.trim()) {
      const sn = setName.trim().toLowerCase()
      const setFiltered = matched.filter(p => {
        const cn = (p['console-name'] || '').toLowerCase()
        return cn.includes(sn) || sn.includes(cn)
      })
      if (setFiltered.length > 0) {
        matched = setFiltered
      }
      // セット名で絞れなくても番号フィルタに進む（フォールバック）
    }

    // カード番号でフィルタリング
    if (cardNumber) {
      // "008/028" -> "008" -> "8" (先頭ゼロ除去)
      const rawNum = cardNumber.split('/')[0]
      const num = rawNum.replace(/^0+/, '') || '0'
      // #8, #08, #008 のいずれにもマッチする正規表現
      const numRegex = new RegExp(`#\\s?0*${num.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\D|$)`)
      const filtered = matched.filter(p => {
        const pName = p['product-name'] || ''
        return numRegex.test(pName)
      })
      if (filtered.length > 0) {
        matched = filtered
      } else {
        // 番号が一致しない場合はマッチなしとして返す
        return NextResponse.json({ success: true, data: null, message: `番号 #${rawNum} に一致するPriceCharting商品なし` })
      }
    }

    // 候補リストを構築（最大10件）
    const candidates = matched.slice(0, 10).map(p => {
      const rawPrice = p['loose-price']
      const loosePrice = (typeof rawPrice === 'number' && rawPrice > 0) ? rawPrice : null
      return {
        id: String(p.id),
        name: p['product-name'],
        consoleName: p['console-name'],
        loosePrice,
        loosePriceDollars: loosePrice != null ? loosePrice / 100 : null,
        pricechartingUrl: `https://www.pricecharting.com/offers?product=${p.id}`,
      }
    })

    const best = candidates[0]

    // 最上位候補のPriceChartingページから画像URL取得（5秒タイムアウト）
    let imageUrl: string | null = null
    try {
      const imgController = new AbortController()
      const imgTimeout = setTimeout(() => imgController.abort(), 5000)
      const pageRes = await fetch(best.pricechartingUrl, { signal: imgController.signal })
      clearTimeout(imgTimeout)
      const resHost = new URL(pageRes.url).hostname
      if (pageRes.ok && resHost === 'www.pricecharting.com') {
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
      // 画像取得失敗は無視
    }

    return NextResponse.json({
      success: true,
      data: {
        ...best,
        imageUrl,
      },
      // 候補が2件以上あれば candidates を返す
      candidates: candidates.length > 1 ? candidates : undefined,
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
