import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { calculateMatchScore } from '@/app/linking/lib/matching'

const supabase = createServiceClient()

/**
 * 自動マッチングAPI
 * POST /api/linking/auto-match
 * body: { name: string, modelno?: string, limit?: number }
 * → スコア付きカード候補を返す
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, modelno, limit = 10 } = body

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    // 1. 名前で候補カードを検索（広めに取得してスコアで絞る）
    const searchTerms: string[] = []

    // 商品名から主要なキーワードを抽出（最初の20文字程度）
    const shortName = name.slice(0, 20)
    searchTerms.push(shortName)

    // 型番がある場合は型番でも検索
    if (modelno) {
      searchTerms.push(modelno)
    }

    // 日本語名 + 英語名の両方で検索（スニダンは英語表記のため）
    const orConditions = searchTerms
      .flatMap(t => [`name.ilike.%${t}%`, `name_en.ilike.%${t}%`])
      .join(',')

    // 型番でも検索
    const cardNumberConditions = modelno
      ? `,card_number.ilike.%${modelno}%`
      : ''

    const { data: candidates, error } = await supabase
      .from('cards')
      .select('id, name, name_en, card_number, expansion, set_code, image_url, rarity')
      .or(orConditions + cardNumberConditions)
      .limit(50)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 2. スコア計算（英語名も照合）
    const scored = (candidates || [])
      .map(card => {
        const score = calculateMatchScore(name, modelno || null, card.name, card.card_number, card.name_en)
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
