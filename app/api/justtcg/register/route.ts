import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      name_en,
      card_number,
      rarity,
      set_code,
      set_name_en,
      release_year,
      expansion,
      image_url,
      justtcg_id,
      tcgplayer_id,
      pricecharting_id,
      pricecharting_url,
      game,
    } = body

    if (!name || !justtcg_id) {
      return NextResponse.json(
        { success: false, error: 'name と justtcg_id は必須です' },
        { status: 400 }
      )
    }

    const supabase = createServiceClient()

    // 重複チェック: justtcg_id
    const { data: existing } = await supabase
      .from('cards')
      .select('id, name')
      .eq('justtcg_id', justtcg_id)
      .maybeSingle()

    if (existing) {
      return NextResponse.json(
        { success: false, error: `既に登録済みです: ${existing.name}`, existingId: existing.id },
        { status: 409 }
      )
    }

    // ゲームに応じた category_large_id を取得
    const GAME_CATEGORY_MAP: Record<string, string> = {
      'pokemon-japan': 'ポケモンカード',
      'pokemon': 'ポケモンカード',
      'one-piece-card-game': 'ワンピースカード',
      'digimon-card-game': 'デジモンカード',
      'union-arena': 'ユニオンアリーナ',
      'hololive-official-card-game': 'ホロライブカード',
      'dragon-ball-super-fusion-world': 'ドラゴンボール',
    }
    const categoryName = GAME_CATEGORY_MAP[game || 'pokemon-japan'] || 'ポケモンカード'

    const { data: category } = await supabase
      .from('category_large')
      .select('id')
      .eq('name', categoryName)
      .maybeSingle()

    // INSERT
    const { data: card, error } = await supabase
      .from('cards')
      .insert({
        name,
        name_en: name_en || null,
        card_number: card_number || null,
        rarity: rarity || null,
        set_code: set_code || null,
        set_name_en: set_name_en || null,
        release_year: release_year || null,
        expansion: expansion || null,
        image_url: image_url || null,
        justtcg_id,
        tcgplayer_id: tcgplayer_id || null,
        pricecharting_id: pricecharting_id || null,
        pricecharting_url: pricecharting_url || null,
        category_large_id: category?.id || null,
      })
      .select()
      .single()

    if (error) {
      console.error('Card register error:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: card })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Registration failed'
    console.error('JustTCG register error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
