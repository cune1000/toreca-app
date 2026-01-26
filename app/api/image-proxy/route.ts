import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { imageUrl } = await request.json()

  if (!imageUrl) {
    return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 })
  }

  try {
    // ブラウザっぽいヘッダーを設定（403対策）
    const headers: HeadersInit = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
      'Referer': 'https://twitter.com/',
    }

    // 画像を取得
    const response = await fetch(imageUrl, { 
      headers,
      cache: 'no-store',  // キャッシュ問題を回避
    })
    
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`)
    }

    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    
    // Content-Type を取得
    const contentType = response.headers.get('content-type') || 'image/jpeg'
    
    // Base64 に変換
    const base64 = buffer.toString('base64')
    const dataUrl = `data:${contentType};base64,${base64}`

    return NextResponse.json({
      success: true,
      base64: dataUrl,
      contentType,
      size: buffer.length,
    })

  } catch (error: any) {
    console.error('Image proxy error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch image' },
      { status: 500 }
    )
  }
}
