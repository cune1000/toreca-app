import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { calculateMatchScore, parseExternalName } from '@/app/linking/lib/matching'

const supabase = createServiceClient()

/**
 * 自動マッチングAPI
 * POST /api/linking/auto-match
 * body: { name: string, modelno?: string, limit?: number }
 * → スコア付きカード候補を返す
 *
 * 商品名の構造化情報（[setCode cardNumber](expansion)）を自動パースし、
 * カード名・型番・セットコードで複合検索してマッチング精度を向上
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, modelno, limit = 10 } = body

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    // 1. 構造化商品名をパース
    // e.g. "Shedinja AR [M1S 072/063](Expansion Pack "Mega Symphonia")"
    // → cardName="Shedinja", cardNumber="072/063", setCode="M1S"
    const parsed = parseExternalName(name)

    // 2. 検索条件を構築
    const orParts: string[] = []

    // カード名で検索（日本語名・英語名の両方）
    if (parsed.cardName) {
      orParts.push(`name.ilike.%${parsed.cardName}%`)
      orParts.push(`name_en.ilike.%${parsed.cardName}%`)
    }

    // パースしたカード番号で検索
    if (parsed.cardNumber) {
      orParts.push(`card_number.ilike.%${parsed.cardNumber}%`)
    }

    // ExternalItemのmodelno（product_number）でも検索
    if (modelno && modelno !== parsed.cardNumber) {
      orParts.push(`card_number.ilike.%${modelno}%`)
    }

    if (orParts.length === 0) {
      return NextResponse.json({ matches: [] })
    }

    const { data: candidates, error } = await supabase
      .from('cards')
      .select('id, name, name_en, card_number, expansion, set_code, image_url, rarity')
      .or(orParts.join(','))
      .limit(50)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 3. スコア計算（パースしたクリーンな名前・型番を使用）
    const effectiveName = parsed.cardName || name
    const effectiveModelno = parsed.cardNumber || modelno || null

    const scored = (candidates || [])
      .map(card => {
        let score = calculateMatchScore(
          effectiveName,
          effectiveModelno,
          card.name,
          card.card_number,
          card.name_en,
        )

        // セットコード一致ボーナス（+5、上限100）
        if (score > 0 && parsed.setCode && card.set_code &&
            parsed.setCode.toUpperCase() === card.set_code.toUpperCase()) {
          score = Math.min(100, score + 5)
        }

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
          matchType: score >= 100 ? 'exact' as const
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
