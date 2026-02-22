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

    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ success: false, error: '不正なリクエスト形式' }, { status: 400 })
    }
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

    // 文字列フィールドのサニタイズ（型チェック + 長さ制限）
    const str = (v: unknown, max = 500): string | null => {
      if (typeof v !== 'string') return null
      const t = v.trim()
      return t.length > 0 && t.length <= max ? t : null
    }
    const url = (v: unknown): string | null => {
      const s = str(v, 2000)
      if (!s) return null
      try { const u = new URL(s); return u.protocol === 'https:' || u.protocol === 'http:' ? s : null } catch { return null }
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
    const validGame = typeof game === 'string' && game in GAME_CATEGORY_MAP ? game : 'pokemon-japan'
    const categoryName = GAME_CATEGORY_MAP[validGame]

    const { data: category } = await supabase
      .from('category_large')
      .select('id')
      .eq('name', categoryName)
      .maybeSingle()

    if (!category) {
      console.warn(`Category not found for game: ${validGame} (name: ${categoryName})`)
    }

    // INSERT
    const { data: card, error } = await supabase
      .from('cards')
      .insert({
        name,
        name_en: str(name_en, 200),
        card_number: str(card_number, 50),
        rarity: str(rarity, 50),
        set_code: str(set_code, 100),
        set_name_en: str(set_name_en, 200),
        release_year: typeof release_year === 'number' ? release_year : null,
        expansion: str(expansion, 200),
        image_url: url(image_url),
        justtcg_id,
        tcgplayer_id: str(tcgplayer_id, 100),
        pricecharting_id: str(pricecharting_id, 100),
        pricecharting_url: url(pricecharting_url),
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
