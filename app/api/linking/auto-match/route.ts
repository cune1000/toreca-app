import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { parseExternalName, normalizeName } from '@/app/linking/lib/matching'

const supabase = createServiceClient()

const SELECT_FIELDS = 'id, name, name_en, card_number, expansion, set_code, image_url, rarity'

/**
 * 自動マッチングAPI
 * POST /api/linking/auto-match
 * body: { name: string, modelno?: string, limit?: number }
 *
 * 段階検索（優先度順）:
 *   1. set_code + card_number 完全一致（最高精度）
 *   2. card_number 完全一致（セットコードなし or 不一致）
 *   3. modelno(product_number) 完全一致
 *   4. カード名検索（フォールバック）
 *
 * 各段階で候補が見つかればそこで打ち切り。ilike は名前検索のみ使用。
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, modelno, limit = 10 } = body

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const parsed = parseExternalName(name)
    type CardRow = Record<string, any>
    let candidates: CardRow[] = []
    let tier = 0

    // --- Tier 1: set_code + card_number 完全一致 ---
    if (parsed.setCode && parsed.cardNumber) {
      const { data } = await supabase
        .from('cards')
        .select(SELECT_FIELDS)
        .eq('set_code', parsed.setCode)
        .eq('card_number', parsed.cardNumber)
        .limit(10)
      if (data && data.length > 0) {
        candidates = data
        tier = 1
      }
    }

    // --- Tier 2: card_number 完全一致 ---
    if (candidates.length === 0 && parsed.cardNumber) {
      const { data } = await supabase
        .from('cards')
        .select(SELECT_FIELDS)
        .eq('card_number', parsed.cardNumber)
        .limit(20)
      if (data && data.length > 0) {
        candidates = data
        tier = 2
      }
    }

    // --- Tier 3: modelno (product_number) 完全一致 ---
    if (candidates.length === 0 && modelno && modelno !== parsed.cardNumber) {
      const { data } = await supabase
        .from('cards')
        .select(SELECT_FIELDS)
        .eq('card_number', modelno)
        .limit(20)
      if (data && data.length > 0) {
        candidates = data
        tier = 3
      }
    }

    // --- Tier 4: カード名検索（フォールバック） ---
    if (candidates.length === 0 && parsed.cardName) {
      const { data } = await supabase
        .from('cards')
        .select(SELECT_FIELDS)
        .or(`name_en.ilike.%${parsed.cardName}%,name.ilike.%${parsed.cardName}%`)
        .limit(30)
      if (data && data.length > 0) {
        candidates = data
        tier = 4
      }
    }

    if (candidates.length === 0) {
      return NextResponse.json({ matches: [] })
    }

    // --- スコアリング ---
    const scored = candidates
      .map(card => {
        const score = computeScore(parsed, modelno, card, tier)
        if (score === 0) return null
        return {
          card: {
            id: card.id,
            name: card.name,
            nameEn: card.name_en,
            cardNumber: card.card_number,
            expansion: card.expansion,
            setCode: card.set_code,
            imageUrl: card.image_url,
            rarity: card.rarity,
          },
          score,
          matchType: score >= 95 ? 'exact' as const
            : score >= 85 ? 'name' as const
            : score >= 70 ? 'modelno' as const
            : 'partial' as const,
        }
      })
      .filter(Boolean)
      .sort((a, b) => b!.score - a!.score)
      .slice(0, limit)

    return NextResponse.json({ matches: scored })
  } catch (error: any) {
    console.error('[linking/auto-match] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// ============================================================================
// スコア計算
// ============================================================================

function computeScore(
  parsed: ReturnType<typeof parseExternalName>,
  modelno: string | undefined,
  card: Record<string, any>,
  tier: number,
): number {
  const setMatch = !!(parsed.setCode && card.set_code &&
    parsed.setCode.toUpperCase() === card.set_code.toUpperCase())

  const numMatch = !!(
    (parsed.cardNumber && card.card_number && parsed.cardNumber === card.card_number) ||
    (modelno && card.card_number && modelno === card.card_number)
  )

  const nameResult = checkName(parsed.cardName, card.name, card.name_en)

  // Tier 1: set_code + card_number 完全一致で見つかった
  if (tier === 1) {
    if (nameResult === 'exact') return 100  // 全一致
    if (nameResult === 'partial') return 98 // セット+番号一致、名前部分一致
    return 95                                // セット+番号一致（名前不一致でもほぼ確定）
  }

  // Tier 2-3: card_number 完全一致で見つかった → 名前で絞り込む
  if (tier === 2 || tier === 3) {
    if (setMatch && nameResult === 'exact') return 100
    if (setMatch) return 95
    if (nameResult === 'exact') return 90
    if (nameResult === 'partial') return 80
    return 75  // 番号一致のみ
  }

  // Tier 4: 名前検索フォールバック
  if (nameResult === 'exact' && numMatch) return 100
  if (nameResult === 'exact') return 85
  if (nameResult === 'partial' && numMatch) return 80
  if (nameResult === 'partial') return calcPartialScore(parsed.cardName, card.name, card.name_en)
  return 0
}

type NameResult = 'exact' | 'partial' | 'none'

function checkName(parsedName: string, cardName: string, cardNameEn: string | null): NameResult {
  if (!parsedName) return 'none'
  const ext = normalizeName(parsedName).toLowerCase()
  if (!ext) return 'none'

  // 日本語名チェック
  const ja = normalizeName(cardName).toLowerCase()
  if (ja && ext === ja) return 'exact'

  // 英語名チェック
  const en = cardNameEn ? normalizeName(cardNameEn).toLowerCase() : ''
  if (en && ext === en) return 'exact'

  // 部分一致チェック
  if (ja && (ext.includes(ja) || ja.includes(ext))) return 'partial'
  if (en && (ext.includes(en) || en.includes(ext))) return 'partial'

  return 'none'
}

function calcPartialScore(parsedName: string, cardName: string, cardNameEn: string | null): number {
  const ext = normalizeName(parsedName).toLowerCase()
  const ja = normalizeName(cardName).toLowerCase()
  const en = cardNameEn ? normalizeName(cardNameEn).toLowerCase() : ''

  // 短い方 / 長い方の比率で60-80のスコア
  const best = [ja, en].filter(Boolean).reduce((max, n) => {
    const shorter = ext.length < n.length ? ext : n
    const longer = ext.length < n.length ? n : ext
    const ratio = shorter.length / longer.length
    return Math.max(max, ratio)
  }, 0)

  return Math.round(60 + 20 * best)
}
