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

    // Gemini 3 Flash を使用してテキスト抽出
    console.log('Calling Gemini 3 Flash for OCR...')
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Data
        }
      },
      {
        text: `この画像に含まれるすべてのテキストを正確に抽出してください。
レイアウトを保持し、行ごとに分けて出力してください。
カード名、番号、価格などの情報を可能な限り正確に読み取ってください。`
      }
    ])

    const response = await result.response
    const fullText = response.text()

    // テキストを行ごとに分割して単語リストを作成
    const lines = fullText.split('\n').filter(line => line.trim())
    const words = lines.map((line, index) => ({
      text: line.trim(),
      boundingBox: null // Gemini APIはbounding boxを提供しないため
    }))

    return NextResponse.json({
      success: true,
      ocrText: fullText,
      words,
      wordCount: words.length,
      model: 'gemini-2.0-flash-exp'
    })

  } catch (error) {
    console.error('Recognition error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '認識に失敗しました' },
      { status: 500 }
    )
  }
}
