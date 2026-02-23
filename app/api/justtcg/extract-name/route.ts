import { NextRequest, NextResponse } from 'next/server'
import { getGeminiModel, fetchImageAsBase64, extractJsonFromResponse } from '@/lib/ai/gemini'

export const dynamic = 'force-dynamic'

// IPレート制限（2秒間隔 — 一括フローからの連続呼び出しに対応）
const lastRequestMap = new Map<string, number>()
const RATE_LIMIT_MS = 2_000
const MAX_ENTRIES = 100

const EXTRACT_NAME_PROMPT = `このトレーディングカードの画像を見て、カードに書かれている日本語のカード名を抽出してください。

**ルール**:
- カードの表面に大きく書かれているキャラクター名やカード名を読み取ってください
- 「ex」は必ず小文字で統一してください（例: ピカチュウex）
- 「V」「VSTAR」「VMAX」「GX」はそのまま大文字で出力してください
- 日本語名が見つからない場合は、null を返してください
- サブタイトルや説明文ではなく、メインのカード名のみを返してください

**必須**: 以下のJSON形式のみで返してください。他のテキストは一切含めないでください：
{
  "name": "日本語カード名"
}

日本語名が読み取れない場合:
{
  "name": null
}`

export async function POST(request: NextRequest) {
  try {
    // レート制限
    const clientIp = (request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim()
    const now = Date.now()
    const last = lastRequestMap.get(clientIp) || 0
    if (now - last < RATE_LIMIT_MS) {
      return NextResponse.json(
        { success: false, error: 'リクエストが多すぎます' },
        { status: 429 }
      )
    }
    lastRequestMap.set(clientIp, now)

    // クリーンアップ
    if (lastRequestMap.size > 10) {
      for (const [ip, ts] of lastRequestMap) {
        if (now - ts > RATE_LIMIT_MS * 10) lastRequestMap.delete(ip)
      }
    }
    if (lastRequestMap.size > MAX_ENTRIES) {
      const sorted = [...lastRequestMap.entries()].sort((a, b) => a[1] - b[1])
      sorted.slice(0, Math.floor(sorted.length / 2)).forEach(([ip]) => lastRequestMap.delete(ip))
    }

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ success: false, error: '不正なリクエスト形式' }, { status: 400 })
    }

    const { imageUrl } = body
    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json({ success: false, error: 'imageUrl は必須です' }, { status: 400 })
    }

    // URL検証（PriceChartingの画像ドメインのみ許可）
    try {
      const parsed = new URL(imageUrl)
      if (parsed.hostname !== 'storage.googleapis.com') {
        return NextResponse.json({ success: false, error: '許可されていない画像URLです' }, { status: 400 })
      }
    } catch {
      return NextResponse.json({ success: false, error: '無効なURLです' }, { status: 400 })
    }

    const model = getGeminiModel()
    const base64 = await fetchImageAsBase64(imageUrl)

    const result = await model.generateContent([
      { inlineData: { mimeType: 'image/jpeg', data: base64 } },
      { text: EXTRACT_NAME_PROMPT },
    ])

    const text = extractJsonFromResponse(result.response.text())
    const parsed = JSON.parse(text)
    const name = parsed.name

    if (name && typeof name === 'string' && name.trim()) {
      return NextResponse.json({ success: true, name: name.trim() })
    } else {
      return NextResponse.json({ success: false, error: '日本語名を抽出できませんでした' })
    }
  } catch (error: unknown) {
    console.error('Extract name error:', error)
    return NextResponse.json(
      { success: false, error: '名前抽出に失敗しました' },
      { status: 500 }
    )
  }
}
