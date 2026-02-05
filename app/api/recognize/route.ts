import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

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

    // Base64データのバリデーション
    const cleanBase64 = base64Data.replace(/^data:image\/[a-z]+;base64,/, '')
    if (!cleanBase64 || cleanBase64.length === 0) {
      return NextResponse.json({ error: '不正な画像データです' }, { status: 400 })
    }

    // ツイートテキストからPSA判定
    const PSA_KEYWORDS = ['PSA', 'psa', 'PSA10', 'PSA9', 'PSA8', '鑑定', 'グレーディング', 'BGS', 'CGC']
    const isPsaFromText = tweetText ? PSA_KEYWORDS.some(kw => tweetText.includes(kw)) : false

    // Gemini API キーの確認
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.error('GEMINI_API_KEY is not configured')
      return NextResponse.json({ error: 'API設定エラー' }, { status: 500 })
    }

    // Gemini 3 Flash を使用して買取価格表を解析
    console.log('Calling Gemini 3 Flash for price list recognition...')
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' })

    const prompt = `この買取価格表の画像から、各カードの情報をJSON配列で返してください。

各カードについて以下を抽出：
- name: カード名
- price: 価格（数値のみ、カンマなし）
- grade: グレード（PSA10, PSA9など）
- cardNumber: カード番号（あれば）

**重要**: JSON配列のみを返してください。説明文は一切含めないでください。

出力例:
[
  {"name": "ピカチュウ", "price": 12000, "grade": "PSA10", "cardNumber": null},
  {"name": "リザードン", "price": 180000, "grade": "PSA10", "cardNumber": "006/165"}
]`

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: cleanBase64
        }
      },
      {
        text: prompt
      }
    ])

    const response = await result.response
    let fullText = response.text()

    // JSONの抽出（マークダウンのコードブロックを除去）
    fullText = fullText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    // 余計なテキストを除去（「以下の通りです」などの説明文）
    const jsonMatch = fullText.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      fullText = jsonMatch[0]
    }

    // JSONをパース
    let cardsArray
    try {
      cardsArray = JSON.parse(fullText)
    } catch (parseError) {
      console.error('Failed to parse JSON:', fullText)
      // フォールバック: テキストから行ごとに抽出
      const lines = fullText.split('\n').filter(line => line.trim())
      cardsArray = lines.map((line, index) => ({
        name: line.trim(),
        price: null,
        grade: null,
        cardNumber: null
      }))
    }

    // Gemini の出力を既存のフォーマットに変換
    const cards = cardsArray.map((card: any, index: number) => {
      return {
        index: index + 1,
        name: card.name || '',
        card_number: card.cardNumber || null,
        raw_text: card.name || '',
        price: card.price || null,
        quantity: null,
        grounding: null
      }
    })

    return NextResponse.json({
      success: true,
      data: {
        cards,
        is_psa: isPsaFromText,
        layout: {
          type: 'gemini-parsed',
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
        model: 'gemini-3-flash-preview',
        cardCount: cards.length
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
    version: '4.0 (Gemini 3 Flash)',
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
