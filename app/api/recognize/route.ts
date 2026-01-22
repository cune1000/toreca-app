import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// Base64データから実際の画像フォーマットを判定
function detectImageType(base64Data: string): string {
  // Base64の先頭数バイトでフォーマット判定
  if (base64Data.startsWith('/9j/')) return 'image/jpeg'
  if (base64Data.startsWith('iVBORw')) return 'image/png'
  if (base64Data.startsWith('R0lGOD')) return 'image/gif'
  if (base64Data.startsWith('UklGR')) return 'image/webp'
  return 'image/jpeg' // デフォルト
}

export async function POST(request: NextRequest) {
  try {
    const { image } = await request.json()
    
    if (!image) {
      return NextResponse.json({ error: '画像がありません' }, { status: 400 })
    }

    // Base64データを取り出す
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '')
    
    // 実際のフォーマットを判定
    const mediaType = detectImageType(base64Data)

    console.log('Detected media type:', mediaType)
    console.log('Base64 length:', base64Data.length)
    
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Data,
              },
            },
            {
              type: 'text',
              text: 'この画像はトレーディングカードです。以下の情報をJSON形式で抽出してください：\n\n1. カード名（日本語）\n2. カード番号（例: 246/193）\n3. レアリティ（SAR, SR, AR, UR, HR, RR, R, U, C など）\n4. カードの種類（ポケモンカード、ワンピースカード、遊戯王 など）\n\n以下のJSON形式で回答してください：\n{"name": "カード名", "cardNumber": "カード番号", "rarity": "レアリティ", "cardType": "カードの種類", "confidence": 信頼度}\n\nconfidenceは0-100の数値です。カードが認識できない場合は confidence を 0 にしてください。JSONのみを返してください。'
            }
          ],
        }
      ],
    })

    const textContent = response.content.find(c => c.type === 'text')
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json({ error: '認識に失敗しました' }, { status: 500 })
    }

    const resultText = textContent.text.trim()
    const jsonMatch = resultText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'JSONの解析に失敗しました' }, { status: 500 })
    }

    const result = JSON.parse(jsonMatch[0])
    
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Recognition error:', error)
    console.error('Error message:', error.message)
    return NextResponse.json(
      { error: error.message || '認識中にエラーが発生しました' },
      { status: 500 }
    )
  }
}
