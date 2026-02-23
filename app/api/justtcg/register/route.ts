import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// JustTCG英語レアリティ名 → 日本語略称マッピング
const RARITY_EN_TO_JA: Record<string, string> = {
  'Common': 'C',
  'Uncommon': 'U',
  'Rare': 'R',
  'Holo Rare': 'R',
  'Double Rare': 'RR',
  'Triple Rare': 'RRR',
  'Secret Rare': 'SR',
  'Ultra Rare': 'UR',
  'Illustration Rare': 'AR',
  'Special Art Rare': 'SAR',
  'Hyper Rare': 'HR',
  'Promo': 'PR',
}

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

    // R13-API14: 古いエントリのクリーンアップ + 上限超過時の半分削除
    if (lastRegisterMap.size > 50) {
      for (const [ip, ts] of lastRegisterMap) {
        if (now - ts > REGISTER_RATE_MS * 10) lastRegisterMap.delete(ip)
      }
    }
    if (lastRegisterMap.size > 200) {
      const sorted = [...lastRegisterMap.entries()].sort((a, b) => a[1] - b[1])
      sorted.slice(0, Math.floor(sorted.length / 2)).forEach(([ip]) => lastRegisterMap.delete(ip))
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
      pricecharting_name,
      pricecharting_url,
      game,
    } = body

    if (!name || !justtcg_id || typeof name !== 'string' || typeof justtcg_id !== 'string') {
      return NextResponse.json(
        { success: false, error: 'name と justtcg_id は必須です' },
        { status: 400 }
      )
    }

    // R13-API10: 前後空白のトリム
    const trimmedName = name.trim()
    const trimmedJusttcgId = justtcg_id.trim()
    if (!trimmedName || !trimmedJusttcgId) {
      return NextResponse.json(
        { success: false, error: 'name と justtcg_id は空にできません' },
        { status: 400 }
      )
    }

    // 入力長制限
    if (trimmedName.length > 200 || trimmedJusttcgId.length > 200) {
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

    // justtcg_id 既存チェック（後でUPDATE or INSERT判定に使用）
    const { data: existing, error: dupCheckError } = await supabase
      .from('cards')
      .select('id, name')
      .eq('justtcg_id', trimmedJusttcgId)
      .maybeSingle()

    // R13-API12: Supabaseエラーハンドリング
    if (dupCheckError) {
      console.error('Duplicate check error:', dupCheckError)
      return NextResponse.json(
        { success: false, error: '重複チェックに失敗しました' },
        { status: 500 }
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

    // R13-API13: カテゴリクエリエラーハンドリング
    const { data: category, error: catError } = await supabase
      .from('category_large')
      .select('id')
      .eq('name', categoryName)
      .maybeSingle()

    if (catError) {
      console.error('Category query error:', catError)
    } else if (!category) {
      console.warn(`Category not found for game: ${validGame} (name: ${categoryName})`)
    }

    // R13-API06: release_year NaN/Infinity ガード
    const safeReleaseYear = typeof release_year === 'number' && Number.isFinite(release_year) ? release_year : null

    // rarity_id 自動ルックアップ（英語名→日本語略称→raritiesテーブル）
    let rarityId: string | null = null
    const rarityStr = str(rarity, 50)
    if (rarityStr && category?.id) {
      const jaRarity = RARITY_EN_TO_JA[rarityStr] || rarityStr
      const { data: rarityRow } = await supabase
        .from('rarities')
        .select('id')
        .eq('large_id', category.id)
        .eq('name', jaRarity)
        .maybeSingle()
      rarityId = rarityRow?.id || null
    }

    // justtcg_id が既に登録済み → 既存カードを最新データで上書きUPDATE
    if (existing) {
      const updateFields: Record<string, unknown> = {
        name: trimmedName,
        name_en: str(name_en, 200),
        card_number: str(card_number, 50),
        rarity: str(rarity, 50),
        set_code: str(set_code, 100),
        set_name_en: str(set_name_en, 200),
        release_year: safeReleaseYear,
        expansion: str(expansion, 200),
        pricecharting_id: str(pricecharting_id, 100),
        pricecharting_name: str(pricecharting_name, 200),
        pricecharting_url: url(pricecharting_url),
        category_large_id: category?.id || null,
      }
      if (rarityId) updateFields.rarity_id = rarityId
      if (url(image_url)) updateFields.image_url = url(image_url)

      const { data: updated, error: updateError } = await supabase
        .from('cards')
        .update(updateFields)
        .eq('id', existing.id)
        .select()
        .single()

      if (updateError) {
        console.error('Card update error:', updateError)
        return NextResponse.json(
          { success: false, error: updateError.message },
          { status: 500 }
        )
      }
      return NextResponse.json({ success: true, data: updated, updated: true })
    }

    // 名前+型番+カテゴリで既存カードを検索（別ソースから登録済みの場合マージ）
    const cardNumber = str(card_number, 50)
    if (cardNumber && category?.id) {
      let mergeQuery = supabase
        .from('cards')
        .select('id, name')
        .eq('name', trimmedName)
        .eq('card_number', cardNumber)
        .eq('category_large_id', category.id)
        .is('justtcg_id', null) // JustTCG未紐付けのカードのみ
      const { data: mergeTarget } = await mergeQuery.maybeSingle()

      if (mergeTarget) {
        // 既存カードにJustTCGデータを追記（UPDATE）
        const updateFields: Record<string, unknown> = {
          justtcg_id: trimmedJusttcgId,
          name_en: str(name_en, 200),
          rarity: str(rarity, 50),
          set_code: str(set_code, 100),
          set_name_en: str(set_name_en, 200),
          release_year: safeReleaseYear,
          pricecharting_id: str(pricecharting_id, 100),
          pricecharting_name: str(pricecharting_name, 200),
          pricecharting_url: url(pricecharting_url),
        }
        // 既存値がない場合のみ上書き
        if (rarityId) updateFields.rarity_id = rarityId
        if (url(image_url)) updateFields.image_url = url(image_url)

        const { data: merged, error: mergeError } = await supabase
          .from('cards')
          .update(updateFields)
          .eq('id', mergeTarget.id)
          .select()
          .single()

        if (mergeError) {
          console.error('Card merge error:', mergeError)
          return NextResponse.json(
            { success: false, error: mergeError.message },
            { status: 500 }
          )
        }
        return NextResponse.json({ success: true, data: merged, merged: true })
      }
    }

    // INSERT（既存カードが見つからない場合）
    const { data: card, error } = await supabase
      .from('cards')
      .insert({
        name: trimmedName, // R13-API10: trimmed
        name_en: str(name_en, 200),
        card_number: cardNumber,
        rarity: str(rarity, 50),
        rarity_id: rarityId,
        set_code: str(set_code, 100),
        set_name_en: str(set_name_en, 200),
        release_year: safeReleaseYear,
        expansion: str(expansion, 200),
        image_url: url(image_url),
        justtcg_id: trimmedJusttcgId, // R13-API10: trimmed
        tcgplayer_id: str(tcgplayer_id, 100),
        pricecharting_id: str(pricecharting_id, 100),
        pricecharting_name: str(pricecharting_name, 200),
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
    console.error('JustTCG register error:', error)
    // R13-API16: 内部エラー詳細をクライアントに漏らさない
    return NextResponse.json(
      { success: false, error: '登録処理に失敗しました' },
      { status: 500 }
    )
  }
}
