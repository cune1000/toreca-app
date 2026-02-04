import { NextRequest, NextResponse } from 'next/server'
import { getVisionClient } from '@/lib/utils/googleAuth'

// POST: 画像から買取価格を認識
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      imageBase64,
      imageUrl,
      tweetText,
      shopId,
    } = body

    if (!imageBase64 && !imageUrl) {
      return NextResponse.json({ error: 'imageBase64 or imageUrl is required' }, { status: 400 })
    }

    let base64Data = imageBase64

    // URLから画像を取得
    if (imageUrl && !imageBase64) {
      console.log('Fetching image from URL:', imageUrl)
      const imageResponse = await fetch(imageUrl)
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.status}`)
      }
      const arrayBuffer = await imageResponse.arrayBuffer()
      base64Data = Buffer.from(arrayBuffer).toString('base64')
    }

    // ツイートテキストからPSA判定
    const PSA_KEYWORDS = ['PSA', 'psa', 'PSA10', 'PSA9', 'PSA8', '鑑定', 'グレーディング', 'BGS', 'CGC']
    const isPsaFromText = tweetText ? PSA_KEYWORDS.some(kw => tweetText.includes(kw)) : false

    // Google Vision OCRでテキストを抽出
    console.log('Calling Google Vision OCR...')
    const client = await getVisionClient()
    const [result] = await client.annotateImage({
      image: { content: Buffer.from(base64Data, 'base64') },
      features: [{ type: 'TEXT_DETECTION' }]
    })

    // エラーチェック
    if (result.error) {
      console.error('Vision API error:', result.error)
      return NextResponse.json(
        { error: result.error.message || 'OCR処理に失敗しました' },
        { status: 500 }
      )
    }

    // OCR結果を整形
    const textAnnotations = result.textAnnotations || []
    const fullText = textAnnotations[0]?.description || ''
    const words = textAnnotations.slice(1).map((a: any) => ({
      text: a.description,
      boundingBox: a.boundingPoly?.vertices
    }))

    // OCR結果を行ごとに分割してカード候補を作成
    const lines = fullText.split('\n').filter(line => line.trim())
    const cards = lines.map((line, index) => ({
      index: index + 1,
      name: line.trim(),
      card_number: null,
      raw_text: line.trim(),
      price: null,
      quantity: null,
      grounding: null
    }))

    return NextResponse.json({
      success: true,
      data: {
        cards,
        is_psa: isPsaFromText,
        layout: {
          type: 'text',
          total_detected: cards.length
        },
        grounding_stats: {
          total: 0,
          high_confidence: 0,
          success_rate: 0
        }
      },
      meta: {
        imageSource: imageUrl ? 'url' : 'base64',
        isPsaFromTweet: isPsaFromText,
        tweetText: tweetText || null,
        groundingEnabled: false,
        ocrWordCount: words.length
      }
    })

  } catch (error: any) {
    console.error('Recognition error:', error)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// GET: テスト用
export async function GET() {
  return NextResponse.json({
    message: 'Purchase Price Recognition API',
    version: '3.0 (Google Vision OCR Only)',
    usage: {
      method: 'POST',
      body: {
        imageBase64: 'base64 encoded image (optional if imageUrl provided)',
        imageUrl: 'URL of image (optional if imageBase64 provided)',
        tweetText: 'Tweet text for PSA detection (optional)',
        shopId: 'Shop ID (optional)'
      }
    }
  })
}
