import { NextRequest, NextResponse } from 'next/server'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

/**
 * 画像が買取表かどうかをGeminiで判別
 * POST /api/gemini/classify
 * Body: { imageUrl: string, tweetText?: string }
 * Response: { is_purchase_list: boolean, confidence: number, reason: string }
 */
export async function POST(request: NextRequest) {
    try {
        const { imageUrl, tweetText } = await request.json()

        if (!imageUrl) {
            return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 })
        }

        if (!GEMINI_API_KEY) {
            return NextResponse.json({ error: 'GEMINI_API_KEY not configured' }, { status: 500 })
        }

        // 画像をBase64に変換
        const imageResponse = await fetch(imageUrl)

        if (!imageResponse.ok) {
            return NextResponse.json({
                error: `Failed to fetch image: ${imageResponse.status}`
            }, { status: 400 })
        }

        const imageBuffer = await imageResponse.arrayBuffer()
        const base64Image = Buffer.from(imageBuffer).toString('base64')
        const mimeType = imageResponse.headers.get('content-type') || 'image/jpeg'

        // Gemini APIで判別
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`

        const prompt = `この画像を分析して、トレーディングカードの「買取表」または「買取価格表」かどうかを判定してください。

判定基準：
✅ 買取表の特徴:
- 複数のカード名と価格が一覧で表示されている
- 「買取」「買い取り」「高価買取」などの文字がある
- 店舗の買取価格リストである
- カードの画像と価格が並んでいる

❌ 買取表でないもの:
- 単一のカード紹介
- 販売価格表
- イベント告知
- 一般的な告知画像

${tweetText ? `\nツイートの文章: "${tweetText}"` : ''}

以下のJSON形式で回答してください：
{
  "is_purchase_list": true または false,
  "confidence": 0-100の数値（確信度）,
  "reason": "判定理由を簡潔に"
}

**JSONのみを出力してください。他のテキストは含めないでください。**`

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    parts: [
                        { inline_data: { mime_type: mimeType, data: base64Image } },
                        { text: prompt }
                    ]
                }],
                generationConfig: {
                    temperature: 0.1,
                    maxOutputTokens: 256
                }
            })
        })

        const data = await response.json()

        if (!response.ok) {
            console.error('Gemini API error:', data)
            return NextResponse.json({
                error: 'Gemini API error',
                details: data
            }, { status: 500 })
        }

        // レスポンスからJSONを抽出
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || ''

        // JSON部分を抽出（```json ``` で囲まれている場合も対応）
        let jsonText = text
        const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/)
        if (codeBlockMatch) {
            jsonText = codeBlockMatch[1]
        }

        const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
        if (!jsonMatch) {
            console.error('Failed to parse Gemini response:', text)
            return NextResponse.json({
                is_purchase_list: false,
                confidence: 0,
                reason: 'Failed to parse response'
            })
        }

        const result = JSON.parse(jsonMatch[0])

        return NextResponse.json({
            is_purchase_list: result.is_purchase_list || false,
            confidence: result.confidence || 0,
            reason: result.reason || ''
        })

    } catch (error: any) {
        console.error('Classify error:', error)
        return NextResponse.json({
            error: error.message,
            is_purchase_list: false,
            confidence: 0,
            reason: 'Error occurred'
        }, { status: 500 })
    }
}

// GET: テスト用
export async function GET() {
    return NextResponse.json({
        message: 'Purchase List Classification API',
        version: '1.0',
        usage: {
            method: 'POST',
            body: {
                imageUrl: 'URL of the image to classify',
                tweetText: 'Tweet text (optional)'
            },
            response: {
                is_purchase_list: 'boolean',
                confidence: 'number (0-100)',
                reason: 'string'
            }
        }
    })
}
