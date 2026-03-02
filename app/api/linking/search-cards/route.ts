import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const supabase = createServiceClient()

/**
 * DBカード検索API（紐づけ候補用）
 * GET /api/linking/search-cards?q=ピカチュウ&limit=20
 * ポケカのみ対象
 */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim() || ''
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get('limit') || '20')))

    if (!q || q.length < 2) {
      return NextResponse.json({ cards: [] })
    }

    // cards テーブルからポケカを検索（name, card_number, expansion）
    // category_large_id でポケカフィルタするのが理想だが、
    // JustTCG Explorer登録分は category_large_id が null のケースがあるため名前検索で対応
    let query = supabase
      .from('cards')
      .select('id, name, name_en, card_number, expansion, set_code, image_url, rarity')
      .or(`name.ilike.%${q}%,name_en.ilike.%${q}%,card_number.ilike.%${q}%,expansion.ilike.%${q}%`)
      .order('name', { ascending: true })
      .limit(limit)

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const cards = (data || []).map(card => ({
      id: card.id,
      name: card.name,
      nameEn: card.name_en,
      cardNumber: card.card_number,
      expansion: card.expansion,
      setCode: card.set_code,
      imageUrl: card.image_url,
      rarity: card.rarity,
    }))

    return NextResponse.json({ cards })
  } catch (error: any) {
    console.error('[linking/search-cards] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
