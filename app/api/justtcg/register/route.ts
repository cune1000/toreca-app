import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// レート制限（IPごとに5秒間隔）
const lastRegisterMap = new Map<string, number>()
const REGISTER_RATE_MS = 5_000

export async function POST(request: NextRequest) {
  try {
    // レート制限
    const clientIp = (request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim()
    const now = Date.now()
    const last = lastRegisterMap.get(clientIp) || 0
    if (now - last < REGISTER_RATE_MS) {
      return NextResponse.json(
        { success: false, error: '登録リクエストが多すぎます。少し待ってください。' },
        { status: 429 }
      )
    }
    lastRegisterMap.set(clientIp, now)

    // 古いエントリのクリーンアップ
    if (lastRegisterMap.size > 50) {
      for (const [ip, ts] of lastRegisterMap) {
        if (now - ts > REGISTER_RATE_MS * 10) lastRegisterMap.delete(ip)
      }
    }

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

    if (!name || !justtcg_id || typeof name !== 'string' || typeof justtcg_id !== 'string') {
      return NextResponse.json(
        { success: false, error: 'name と justtcg_id は必須です' },
        { status: 400 }
      )
    }

    // 入力長制限
    if (name.length > 200 || justtcg_id.length > 200) {
      return NextResponse.json(
        { success: false, error: '入力が長すぎます' },
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
      // 重複キーエラーの場合は409を返す（レースコンディション対策）
      const isDuplicate = error.code === '23505' || error.message?.includes('duplicate')
      return NextResponse.json(
        { success: false, error: isDuplicate ? '既に登録済みです（重複）' : error.message },
        { status: isDuplicate ? 409 : 500 }
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
