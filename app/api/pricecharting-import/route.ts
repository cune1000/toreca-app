import { NextRequest, NextResponse } from 'next/server'
import { getGeminiModel, fetchImageAsBase64, extractJsonFromResponse } from '@/lib/ai/gemini'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

const CONCURRENCY = 3

interface ScrapeResult {
  url: string
  pricechartingId: string | null
  pricechartingName: string
  imageUrl: string | null
  imageBase64: string | null
  setCode: string | null
  cardData: {
    name: string | null
    number: string | null
    rarity: string | null
    confidence: number
  } | null
  error?: string
}

// セットslug → set_code のキャッシュ
const setCodeCache = new Map<string, string | null>()

function extractSetSlug(url: string): string | null {
  const match = url.match(/\/game\/([^/]+)\//)
  return match ? match[1] : null
}

async function fetchSetCode(slug: string): Promise<string | null> {
  if (setCodeCache.has(slug)) return setCodeCache.get(slug)!
  try {
    const res = await fetch(`https://www.pricecharting.com/console/${slug}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) { setCodeCache.set(slug, null); return null }
    const html = await res.text()
    const match = html.match(/Set Code:\s*([^<]+)/)
    const code = match ? match[1].trim() : null
    setCodeCache.set(slug, code)
    return code
  } catch {
    setCodeCache.set(slug, null)
    return null
  }
}

const CARD_RECOGNITION_PROMPT = `このポケモンカードの画像から以下の情報を正確に抽出してください：

1. **カード名**: カードに大きく書かれているポケモンの名前（日本語名）
2. **カード番号**: カード下部に記載されている番号（例: 025/187, SV4a 025/190 など）
3. **レアリティ**: カードのレアリティマーク（◆, ◆◆, ★, RR, RRR, SR, UR, SAR など）

**必須**: 以下のJSON形式で返してください。他のテキストは一切含めないでください：
{
  "name": "カード名",
  "number": "カード番号",
  "rarity": "レアリティ",
  "confidence": 0.95
}

カード番号が見つからない場合は "number": null としてください。
レアリティが不明な場合は "rarity": null としてください。
英語名のカードの場合も日本語名がわかればそちらを優先してください。`

async function scrapeOne(url: string, model: ReturnType<typeof getGeminiModel>): Promise<ScrapeResult> {
  try {
    // 0. セットコード取得（キャッシュ済みなら即返却）
    const setSlug = extractSetSlug(url)
    const setCode = setSlug ? await fetchSetCode(setSlug) : null

    // 1. HTML取得
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      signal: AbortSignal.timeout(10000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const html = await res.text()

    // 2. product ID抽出
    const idMatch = html.match(/VGPC\.product\s*=\s*\{\s*id:\s*(\d+)/)
      || html.match(/[?&]product=(\d+)/)
    const pricechartingId = idMatch ? idMatch[1] : null

    // 3. 画像URL抽出
    const imgMatch = html.match(/src=["'](https:\/\/storage\.googleapis\.com\/images\.pricecharting\.com\/[^"']+)/)
    let imageUrl = imgMatch ? imgMatch[1] : null
    if (imageUrl) {
      imageUrl = imageUrl.replace(/\/\d+\.jpg/, '/1600.jpg')
    }

    // 4. product name抽出
    const titleMatch = html.match(/<title>([^<]+)<\/title>/)
    const pricechartingName = titleMatch
      ? titleMatch[1].replace(/\s*\|.*$/, '').replace(/\s*Price.*$/i, '').trim()
      : ''

    // 5. 画像Base64取得 + AI認識
    let cardData = null
    let imageBase64: string | null = null
    if (imageUrl) {
      try {
        imageBase64 = await fetchImageAsBase64(imageUrl)
        const result = await model.generateContent([
          { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
          { text: CARD_RECOGNITION_PROMPT },
        ])
        const text = extractJsonFromResponse(result.response.text())
        const parsed = JSON.parse(text)
        cardData = {
          name: parsed.name || null,
          number: parsed.number || null,
          rarity: parsed.rarity || null,
          confidence: parsed.confidence || 0.8,
        }
      } catch (aiErr) {
        console.error(`AI recognition failed for ${url}:`, aiErr)
      }
    }

    return { url, pricechartingId, pricechartingName, imageUrl, imageBase64, setCode, cardData }
  } catch (err: any) {
    return {
      url,
      pricechartingId: null,
      pricechartingName: '',
      imageUrl: null,
      imageBase64: null,
      setCode: null,
      cardData: null,
      error: err.message || 'Unknown error',
    }
  }
}

export async function POST(request: NextRequest) {
  try {
    const { urls } = await request.json()

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return NextResponse.json({ success: false, error: 'URLが必要です' }, { status: 400 })
    }

    if (urls.length > 40) {
      return NextResponse.json({ success: false, error: '一度に40件までです' }, { status: 400 })
    }

    const model = getGeminiModel()
    const results: ScrapeResult[] = []

    // 同時3件ずつ処理
    for (let i = 0; i < urls.length; i += CONCURRENCY) {
      const batch = urls.slice(i, i + CONCURRENCY)
      const batchResults = await Promise.all(
        batch.map((url: string) => scrapeOne(url, model))
      )
      results.push(...batchResults)
    }

    return NextResponse.json({ success: true, results })
  } catch (error: any) {
    console.error('PriceCharting import error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'インポートに失敗しました' },
      { status: 500 }
    )
  }
}
