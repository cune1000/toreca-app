import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { extractJSON } from '@/lib/utils'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

// Gemini API呼び出し（画像認識用）
async function callGemini(imageBase64: string, mimeType: string, additionalContext?: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`

  const prompt = `この画像はトレーディングカードの買取価格表です。

${additionalContext ? `追加情報: ${additionalContext}` : ''}

【指示】
以下の情報のみを抽出してください：
1. カード名
2. 型番（カードナンバー）

各カードについて以下を抽出:
- カード名: カード画像の近くに書かれた名前。読めない場合はイラストの特徴で記述
  （例：ポンチョピカチュウ、リザードンex、マオ＆スイレン、ナンジャモ等）
- 型番: カードナンバー（例：001/078、SV1V 001/078等）

以下のJSON形式で返してください。必ずJSONのみを返し、他のテキストは含めないでください:
{
  "cards": [
    {
      "index": 1,
      "name": "カード名またはイラスト特徴",
      "card_number": "型番",
      "raw_text": "読み取れた元のテキスト"
    }
  ],
  "layout": {
    "type": "grid",
    "total_detected": 48
  }
}

重要:
- カード名が読めなくても、イラストの特徴（キャラクター、衣装、ポーズ）で識別
- すべてのカードを漏れなく抽出してください
- 型番が見つからない場合は null を返してください`

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{
        parts: [
          { inline_data: { mime_type: mimeType, data: imageBase64 } },
          { text: prompt }
        ]
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 16384 }
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Gemini API error: ${response.status} - ${error}`)
  }

  return await response.json()
}

// Gemini Grounding（Google検索連携）でカード情報を補完
async function enrichWithGrounding(card: any, isPsa: boolean): Promise<any> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${GEMINI_API_KEY}`

  const priceStr = card.price ? `${card.price.toLocaleString()}円` : ''
  const psaStr = isPsa ? 'PSA鑑定' : ''

  const prompt = `ポケモンカード「${card.name}」${priceStr} ${psaStr}について、正式なカード情報を教えてください。

以下のJSON形式で返してください。必ずJSONのみを返し、他のテキストは含めないでください:
{
  "official_name": "正式なカード名（日本語）",
  "card_number": "型番（例: 025/025, 001/SV, SAR）",
  "expansion": "収録パック名",
  "rarity": "レアリティ（SAR, SR, UR, AR等）",
  "confidence": "high/medium/low",
  "notes": "補足情報があれば"
}

情報が見つからない場合は confidence を "low" にしてください。`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search_retrieval: {} }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 1024 }
      })
    })

    if (!response.ok) {
      console.error(`Grounding API error for "${card.name}": ${response.status}`)
      return null
    }

    const data = await response.json()
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!responseText) return null

    const groundingResult = extractJSON(responseText)
    const groundingMetadata = data.candidates?.[0]?.groundingMetadata

    return {
      ...groundingResult,
      search_queries: groundingMetadata?.webSearchQueries || [],
      sources: groundingMetadata?.groundingChunks?.map((c: any) => ({
        url: c.web?.uri,
        title: c.web?.title
      })) || []
    }
  } catch (error) {
    console.error(`Grounding error for "${card.name}":`, error)
    return null
  }
}

// POST: 画像から買取価格を認識
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      imageBase64,
      imageUrl,
      mimeType = 'image/jpeg',
      tweetText,
      shopId,
      enableGrounding = false,
      groundingConcurrency = 5
    } = body

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

    // ツイートテキストからPSA判定
    const PSA_KEYWORDS = ['PSA', 'psa', 'PSA10', 'PSA9', 'PSA8', '鑑定', 'グレーディング', 'BGS', 'CGC']
    const isPsaFromText = tweetText ? PSA_KEYWORDS.some(kw => tweetText.includes(kw)) : false

    let additionalContext = ''
    if (tweetText) additionalContext += `ツイート本文: "${tweetText}"\n`
    if (isPsaFromText) additionalContext += 'このツイートはPSA等の鑑定品に関するものと思われます。'

    // Step 1: Gemini API呼び出し（画像認識）
    console.log('Step 1: Calling Gemini API for image recognition...')
    const geminiResponse = await callGemini(base64Data, detectedMimeType, additionalContext)

    const responseText = geminiResponse.candidates?.[0]?.content?.parts?.[0]?.text
    if (!responseText) throw new Error('No response from Gemini')

    console.log('Gemini response:', responseText)
    const result = extractJSON(responseText)

    if (isPsaFromText && !result.is_psa) {
      result.is_psa = true
      result.psa_info = result.psa_info || { detected: true, grades_found: [] }
      result.psa_info.detected = true
    }

    // Step 2: Grounding で各カード情報を補完
    if (enableGrounding && result.cards && result.cards.length > 0) {
      console.log(`Step 2: Enriching ${result.cards.length} cards with Grounding...`)

      const enrichedCards = []
      for (let i = 0; i < result.cards.length; i += groundingConcurrency) {
        const batch = result.cards.slice(i, i + groundingConcurrency)
        const batchResults = await Promise.all(
          batch.map(async (card: any) => {
            const grounding = await enrichWithGrounding(card, result.is_psa)
            return { ...card, grounding: grounding || null }
          })
        )
        enrichedCards.push(...batchResults)

        if (i + groundingConcurrency < result.cards.length) {
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }

      result.cards = enrichedCards

      const groundingSuccess = enrichedCards.filter((c: any) => c.grounding?.confidence === 'high').length
      result.grounding_stats = {
        total: enrichedCards.length,
        high_confidence: groundingSuccess,
        success_rate: Math.round((groundingSuccess / enrichedCards.length) * 100)
      }

      console.log(`Grounding complete: ${groundingSuccess}/${enrichedCards.length} high confidence`)
    }

    // 店舗情報を追加
    if (shopId) {
      const { data: shop } = await supabase
        .from('purchase_shops')
        .select('name')
        .eq('id', shopId)
        .single()

      if (shop) result.shop = { id: shopId, name: shop.name }
    }

    return NextResponse.json({
      success: true,
      data: result,
      meta: {
        imageSource: imageUrl ? 'url' : 'base64',
        isPsaFromTweet: isPsaFromText,
        tweetText: tweetText || null,
        groundingEnabled: enableGrounding
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
    version: '2.1 (Gemini 1.5 Pro Latest with Grounding)',
    usage: {
      method: 'POST',
      body: {
        imageBase64: 'base64 encoded image (optional if imageUrl provided)',
        imageUrl: 'URL of image (optional if imageBase64 provided)',
        mimeType: 'image/jpeg or image/png (default: image/jpeg)',
        tweetText: 'Tweet text for PSA detection (optional)',
        shopId: 'Shop ID (optional)',
        enableGrounding: 'Enable Google Search grounding (default: false)',
        groundingConcurrency: 'Parallel grounding requests (default: 5)'
      }
    }
  })
}
