import { NextRequest, NextResponse } from 'next/server'

// 許可するドメインのリスト
const ALLOWED_DOMAINS = [
  'pbs.twimg.com',
  'cdn.shopify.com',
  'www.pokemon-card.com',
  'assets.pokemon-card.com',
  'images.pokemontcg.io',
  'snkrdunk.com',
  'torecacamp-pokemon.com',
  'cardrush-pokemon.jp',
  'hareruya2.com',
]

// GET: 画像をプロキシ
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'url parameter is required' }, { status: 400 })
  }

  try {
    // URLを検証
    const parsedUrl = new URL(url)

    // プロトコルチェック（httpとhttpsのみ許可）
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: 'Invalid protocol' }, { status: 400 })
    }

    // ドメインチェック
    const isAllowed = ALLOWED_DOMAINS.some(domain => parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`))
    if (!isAllowed) {
      return NextResponse.json({ error: 'Domain not allowed' }, { status: 403 })
    }

    // 画像を取得
    const response = await fetch(url, {
      headers: {
        // Twitter画像用のヘッダー
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer': parsedUrl.origin,
      }
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch image: ${response.status}` },
        { status: response.status }
      )
    }

    // Content-Typeを取得
    const contentType = response.headers.get('content-type') || 'image/jpeg'

    // 画像データを取得
    const imageBuffer = await response.arrayBuffer()

    // レスポンスを返す
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // 1日キャッシュ
        'Access-Control-Allow-Origin': '*',
      }
    })

  } catch (error: any) {
    console.error('Image proxy error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to proxy image' },
      { status: 500 }
    )
  }
}

// POST: Base64画像をプロキシ（オプション）
export async function POST(request: NextRequest) {
  try {
    const { url, returnBase64 = false } = await request.json()

    if (!url) {
      return NextResponse.json({ error: 'url is required' }, { status: 400 })
    }

    const parsedUrl = new URL(url)

    // プロトコルチェック
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return NextResponse.json({ error: 'Invalid protocol' }, { status: 400 })
    }

    // ドメインチェック
    const isAllowed = ALLOWED_DOMAINS.some(domain => parsedUrl.hostname === domain || parsedUrl.hostname.endsWith(`.${domain}`))
    if (!isAllowed) {
      return NextResponse.json({ error: 'Domain not allowed' }, { status: 403 })
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer': parsedUrl.origin,
      }
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch image: ${response.status}` },
        { status: response.status }
      )
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const imageBuffer = await response.arrayBuffer()

    if (returnBase64) {
      // Base64で返す
      const base64 = Buffer.from(imageBuffer).toString('base64')
      return NextResponse.json({
        success: true,
        contentType,
        base64: `data:${contentType};base64,${base64}`,
        size: imageBuffer.byteLength
      })
    }

    // バイナリで返す
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      }
    })

  } catch (error: any) {
    console.error('Image proxy error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to proxy image' },
      { status: 500 }
    )
  }
}
