import { NextRequest, NextResponse } from 'next/server'
import { getGeminiModel, extractJsonFromResponse } from '@/lib/ai/gemini'

export const dynamic = 'force-dynamic'

// レート制限（IPごとに5秒間隔）
const lastRequestMap = new Map<string, number>()
const RATE_LIMIT_MS = 5_000
const MAX_BATCH = 50

export async function POST(request: NextRequest) {
  try {
    const clientIp = (request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim()
    const now = Date.now()
    const last = lastRequestMap.get(clientIp) || 0
    if (now - last < RATE_LIMIT_MS) {
      return NextResponse.json(
        { success: false, error: 'リクエストが多すぎます。少し待ってください。' },
        { status: 429 }
      )
    }
    lastRequestMap.set(clientIp, now)

    // クリーンアップ
    if (lastRequestMap.size > 100) {
      for (const [ip, ts] of lastRequestMap) {
        if (now - ts > RATE_LIMIT_MS * 10) lastRequestMap.delete(ip)
      }
    }

    const { names, game, setNameEn, setNameJa } = await request.json()

    if (!Array.isArray(names) || names.length === 0 || names.length > MAX_BATCH) {
      return NextResponse.json(
        { success: false, error: `names配列は1〜${MAX_BATCH}件で指定してください` },
        { status: 400 }
      )
    }

    // names の各要素を検証
    for (const item of names) {
      if (!item || typeof item.id !== 'string' || typeof item.name !== 'string') {
        return NextResponse.json(
          { success: false, error: 'names配列の各要素に id と name(string) が必要です' },
          { status: 400 }
        )
      }
    }

    const gameLabel = game === 'one-piece-card-game' ? 'ワンピースカード' : 'ポケモンカード'

    // 商品名パターンをコード側で処理（Geminiに任せない）
    const PRODUCT_SUFFIXES: Record<string, string> = {
      'Booster Box': 'BOX',
      'Booster Pack': 'パック',
      'Booster Bundle': 'バンドル',
      'Elite Trainer Box': 'エリートトレーナーBOX',
      'Build & Battle Box': 'ビルド&バトル BOX',
      'Build & Battle Stadium': 'ビルド&バトル スタジアム',
      'Poster Collection': 'ポスターコレクション',
      'Binder Collection': 'バインダーコレクション',
      'Tech Sticker Collection': 'テックステッカーコレクション',
      'Surprise Box': 'サプライズBOX',
    }

    const preResolved: Record<string, string> = {}
    const toTranslate: Array<{ id: string; name: string }> = []

    for (const item of names as Array<{ id: string; name: string }>) {
      let matched = false
      for (const [suffix, jaSuffix] of Object.entries(PRODUCT_SUFFIXES)) {
        if (item.name.endsWith(suffix)) {
          // セット名部分を抽出して日本語セット名 + 商品種別に変換
          const prefix = item.name.slice(0, -suffix.length).trim()
          // セット名が英語セット名と一致する場合は日本語セット名を使用
          const jaPrefix = (setNameEn && prefix === setNameEn && setNameJa) ? setNameJa : prefix
          preResolved[item.id] = `${jaPrefix} ${jaSuffix}`
          matched = true
          break
        }
      }
      if (!matched) {
        toTranslate.push(item)
      }
    }

    // 全て商品名で解決済みならGemini不要
    if (toTranslate.length === 0) {
      return NextResponse.json({ success: true, data: preResolved })
    }

    const nameList = toTranslate.map((n, i: number) => `${i + 1}. [${n.id}] ${n.name}`).join('\n')

    const setContext = setNameEn && setNameJa
      ? `\n**このセットの情報**: 英語名「${setNameEn}」= 日本語名「${setNameJa}」\n商品名にセット名が含まれる場合は上記の日本語セット名を使ってください。\n`
      : ''

    const prompt = `あなたは日本の${gameLabel}の専門家です。以下の英語名を正式な日本語名に変換してください。
${setContext}
**ルール**:
1. これは意訳・翻訳ではありません。日本で実際に発売されている商品・カードの正式な日本語名を答えてください
2. ポケモン・キャラクター名: 正式な日本語名を使用
   - 「ex」は小文字（Pikachu ex → ピカチュウex）
   - V / VSTAR / VMAX / GX / EX(大文字) はそのまま
3. グッズ・サポート・スタジアム・エネルギー: 正式な日本語カード名
4. 商品名（Booster Box / Booster Pack / Elite Trainer Box等）:
   - Booster Box → 「${setNameJa || 'セット名'} BOX」
   - Booster Pack → 「${setNameJa || 'セット名'} パック」
   - Booster Bundle → 「${setNameJa || 'セット名'} バンドル」
5. (Master Ball Reverse) / (Art Rare) 等のパターン名は除去
6. 正式名が分からない場合 → カタカナに音訳（英語のまま返さないこと）

入力リスト:
${nameList}

JSON配列のみで返答（説明文不要）:
[{"id": "ID", "name_ja": "日本語名"}]`

    const model = getGeminiModel()
    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const jsonStr = extractJsonFromResponse(text)
    const parsed = JSON.parse(jsonStr) as Array<{ id: string; name_ja: string }>

    // id → name_ja マップに変換（コード側で解決済み + Gemini結果をマージ）
    const data: Record<string, string> = { ...preResolved }
    for (const item of parsed) {
      if (item.id && item.name_ja) {
        data[item.id] = item.name_ja
      }
    }

    return NextResponse.json({ success: true, data })
  } catch (error: unknown) {
    console.error('Translate names error:', error)
    return NextResponse.json(
      { success: false, error: '翻訳処理に失敗しました' },
      { status: 500 }
    )
  }
}
