import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json()

    if (!image) {
      return NextResponse.json({ error: '画像が必要です' }, { status: 400 })
    }

    // Base64データの抽出
    const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '')

    // 画像データのバリデーション
    if (!base64Data || base64Data.length === 0) {
      return NextResponse.json({ error: '不正な画像データです' }, { status: 400 })
    }

    // Gemini API キーの確認
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.error('GEMINI_API_KEY is not configured')
      return NextResponse.json({ error: 'API設定エラー' }, { status: 500 })
    }

    // Gemini 3 Flash を使用してカード情報を抽出
    console.log('Calling Gemini 3 Flash for card recognition...')
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' })

    const prompt = `このポケモンカードの画像から以下の情報を正確に抽出してください：

1. **カード名**: カードに大きく書かれているポケモンの名前
2. **カード番号**: カード下部に記載されている番号（例: 025/187, SV4a 025/190 など）
3. **レアリティ**: カードのレアリティマーク
   - ◆（コモン）
   - ◆◆（アンコモン）
   - ★（レア）
   - RR, RRR, SR, UR, SAR などのレアリティ記号
4. **HP**: ポケモンのHP（右上の数字）
5. **タイプ**: カードのタイプ（炎、水、雷、草など）

**必須**: 以下のJSON形式で返してください。他のテキストは一切含めないでください：
{
  "name": "カード名",
  "number": "カード番号",
  "rarity": "レアリティ",
  "hp": "HP値",
  "type": "タイプ",
  "confidence": 0.95
}

カード番号が見つからない場合は "number": null としてください。
レアリティが不明な場合は "rarity": null としてください。`

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Data
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

    // JSONをパース
    let cardData
    try {
      cardData = JSON.parse(fullText)
    } catch (parseError) {
      console.error('Failed to parse JSON:', fullText)
      // フォールバック: テキストから情報を抽出
      return NextResponse.json({
        success: true,
        ocrText: fullText,
        words: [],
        wordCount: 0,
        model: 'gemini-3-flash-preview',
        cardData: null
      })
    }

    return NextResponse.json({
      success: true,
      ocrText: fullText,
      words: [],
      wordCount: 0,
      model: 'gemini-3-flash-preview',
      cardData: {
        name: cardData.name || null,
        number: cardData.number || null,
        rarity: cardData.rarity || null,
        hp: cardData.hp || null,
        type: cardData.type || null,
        confidence: cardData.confidence || 0.8
      }
    })

  } catch (error) {
    console.error('Recognition error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '認識に失敗しました' },
      { status: 500 }
    )
  }
}
