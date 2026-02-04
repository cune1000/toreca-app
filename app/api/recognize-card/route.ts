import { NextRequest, NextResponse } from 'next/server'
import { getVisionClient } from '@/lib/utils/googleAuth'

export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json()

    if (!image) {
      return NextResponse.json({ error: '画像が必要です' }, { status: 400 })
    }

    // Base64データの抽出
    const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '')

    // Google Vision OCRでテキストを抽出
    const client = await getVisionClient()
    const [result] = await client.annotateImage({
      image: { content: Buffer.from(base64Data, 'base64') },
      features: [{ type: 'TEXT_DETECTION' }]
    })

    // OCR結果を整形
    const textAnnotations = result.textAnnotations || []
    const fullText = textAnnotations[0]?.description || ''
    const words = textAnnotations.slice(1).map((a: any) => ({
      text: a.description,
      boundingBox: a.boundingPoly?.vertices
    }))

    // エラーチェック
    if (result.error) {
      console.error('Vision API error:', result.error)
      return NextResponse.json(
        { error: result.error.message || 'OCR処理に失敗しました' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      ocrText: fullText,
      words,
      wordCount: words.length
    })

  } catch (error) {
    console.error('Recognition error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '認識に失敗しました' },
      { status: 500 }
    )
  }
}
