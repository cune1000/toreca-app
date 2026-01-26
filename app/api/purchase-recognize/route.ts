import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

// Gemini API呼び出し
async function callGemini(imageBase64: string, mimeType: string, additionalContext?: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`
  
  const prompt = `この画像はトレーディングカードの買取価格表です。

${additionalContext ? `追加情報: ${additionalContext}` : ''}

【指示】
1. まず画像のレイアウト構造を分析してください（グリッド形式、リスト形式など）
2. 左上から右へ、上から下へ順番にすべてのカードを読み取ってください

各カードについて以下を抽出:
- カード名: カード画像の近くに書かれた名前。読めない場合はイラストの特徴で記述
  （例：ポンチョピカチュウ、リザードンex、マオ＆スイレン、ナンジャモ等）
- 買取枚数: 「○枚」と書かれた数字（あれば）
- 買取価格: 金額（数値のみ、カンマなし）

以下のJSON形式で返してください。必ずJSONのみを返し、他のテキストは含めないでください:
{
  "cards": [
    {
      "index": 1,
      "name": "カード名またはイラスト特徴",
      "quantity": 20,
      "price": 300000,
      "raw_text": "読み取れた元のテキスト"
    }
  ],
  "layout": {
    "type": "grid",
    "rows": 6,
    "cols": 8,
    "total_detected": 48
  },
  "shop_info": {
    "name": "店舗名",
    "date": "日付"
  },
  "is_psa": false,
  "psa_info": {
    "detected": false,
    "grades_found": []
  }
}

重要:
- PSA、BGS、CGC等の鑑定品の場合は is_psa を true に
- 価格は数値のみ（例: 300000）
- カード名が読めなくても、イラストの特徴（キャラクター、衣装、ポーズ）で識別
- すべてのカードを漏れなく抽出してください`

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [
          {
            inline_data: {
              mime_type: mimeType,
              data: imageBase64
            }
          },
          {
            text: prompt
          }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 8192,
      }
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Gemini API error: ${response.status} - ${error}`)
  }

  const data = await response.json()
  return data
}

// レスポンスからJSONを抽出
function extractJSON(text: string): any {
  // ```json ... ``` を除去
  let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '')
  
  // JSONの開始と終了を見つける
  const jsonStart = cleaned.indexOf('{')
  const jsonEnd = cleaned.lastIndexOf('}')
  
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error('No JSON found in response')
  }
  
  cleaned = cleaned.substring(jsonStart, jsonEnd + 1)
  
  return JSON.parse(cleaned)
}

// POST: 画像から買取価格を認識
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { imageBase64, imageUrl, mimeType = 'image/jpeg', tweetText, shopId } = body

    if (!imageBase64 && !imageUrl) {
      return NextResponse.json({ error: 'imageBase64 or imageUrl is required' }, { status: 400 })
    }

    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not configured' }, { status: 500 })
    }

    let base64Data = imageBase64
    let detectedMimeType = mimeType

    // URLから画像を取得
    if (imageUrl && !imageBase64) {
      console.log('Fetching image from URL:', imageUrl)
      const imageResponse = await fetch(imageUrl)
      if (!imageResponse.ok) {
        throw new Error(`Failed to fetch image: ${imageResponse.status}`)
      }
      const contentType = imageResponse.headers.get('content-type')
      if (contentType) {
        detectedMimeType = contentType.split(';')[0]
      }
      const arrayBuffer = await imageResponse.arrayBuffer()
      base64Data = Buffer.from(arrayBuffer).toString('base64')
    }

    // ツイートテキストからPSA判定（事前チェック）
    const PSA_KEYWORDS = ['PSA', 'psa', 'PSA10', 'PSA9', 'PSA8', '鑑定', 'グレーディング', 'BGS', 'CGC']
    const isPsaFromText = tweetText ? PSA_KEYWORDS.some(kw => tweetText.includes(kw)) : false

    // 追加コンテキスト
    let additionalContext = ''
    if (tweetText) {
      additionalContext += `ツイート本文: "${tweetText}"\n`
    }
    if (isPsaFromText) {
      additionalContext += 'このツイートはPSA等の鑑定品に関するものと思われます。'
    }

    // Gemini API呼び出し
    console.log('Calling Gemini API...')
    const geminiResponse = await callGemini(base64Data, detectedMimeType, additionalContext)

    // レスポンス解析
    const responseText = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text
    if (!responseText) {
      throw new Error('No response from Gemini')
    }

    console.log('Gemini response:', responseText)

    // JSONを抽出
    const result = extractJSON(responseText)

    // テキストからのPSA判定を反映
    if (isPsaFromText && !result.is_psa) {
      result.is_psa = true
      result.psa_info = result.psa_info || { detected: true, grades_found: [] }
      result.psa_info.detected = true
    }

    // 店舗情報を追加
    if (shopId) {
      const { data: shop } = await supabase
        .from('purchase_shops')
        .select('name')
        .eq('id', shopId)
        .single()
      
      if (shop) {
        result.shop = { id: shopId, name: shop.name }
      }
    }

    return NextResponse.json({
      success: true,
      data: result,
      meta: {
        imageSource: imageUrl ? 'url' : 'base64',
        isPsaFromTweet: isPsaFromText,
        tweetText: tweetText || null
      }
    })

  } catch (error: any) {
    console.error('Recognition error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// GET: テスト用
export async function GET(request: NextRequest) {
  return NextResponse.json({
    message: 'Purchase Price Recognition API',
    usage: {
      method: 'POST',
      body: {
        imageBase64: 'base64 encoded image (optional if imageUrl provided)',
        imageUrl: 'URL of image (optional if imageBase64 provided)',
        mimeType: 'image/jpeg or image/png (default: image/jpeg)',
        tweetText: 'Tweet text for PSA detection (optional)',
        shopId: 'Shop ID (optional)'
      }
    },
    example: {
      imageUrl: 'https://example.com/price-list.jpg',
      tweetText: '【PSA10】買取価格更新！',
      shopId: 'uuid-here'
    }
  })
}
