import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const { imageUrl } = await request.json()

  if (!imageUrl) {
    return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 })
  }

  try {
    // Twitter/X の画像URLの場合、Bearer Tokenを使う
    const headers: HeadersInit = {}
    
    if (imageUrl.includes('pbs.twimg.com') || imageUrl.includes('ton.twitter.com')) {
      const bearerToken = process.env.X_BEARER_TOKEN
      if (bearerToken) {
        headers['Authorization'] = `Bearer ${bearerToken}`
      }
    }

    // 画像を取得
    const response = await fetch(imageUrl, { headers })
    
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
