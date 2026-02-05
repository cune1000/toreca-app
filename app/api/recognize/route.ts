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
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

    const prompt = `この画像は買取価格表です。以下の情報を1行ずつ抽出してください：

要求事項:
1. カード名を正確に読み取る
2. 価格情報があれば抽出する
3. カード番号があれば抽出する
4. PSA10、PSA9などのグレード情報があれば抽出する
5. 各行を個別に認識する

出力形式:
各行を以下の形式で出力してください（1行1カード）：
[カード名] | [価格] | [番号] | [その他情報]

価格や番号がない場合は空欄で構いません。
カード名は可能な限り正確に読み取ってください。`

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
    const fullText = response.text()

    // Gemini の出力をパースしてカード候補を作成
    const lines = fullText.split('\n').filter(line => line.trim())
    const cards = lines.map((line, index) => {
      // 「|」区切りでパース
      const parts = line.split('|').map(p => p.trim())

      return {
        index: index + 1,
        name: parts[0] || line.trim(), // カード名
        card_number: parts[2] || null, // カード番号
        raw_text: line.trim(),
        price: parts[1] || null, // 価格
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
        model: 'gemini-2.0-flash-exp',
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
    version: '4.0 (Gemini 2.0 Flash)',
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
