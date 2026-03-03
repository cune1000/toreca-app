import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getRarityShortName } from '@/lib/rarity-mapping'

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
      set_name_en,
      release_date,
      expansion,
      image_url,
      tcgplayer_id,
      game,
    } = body

    if (!name || !tcgplayer_id || typeof name !== 'string' || typeof tcgplayer_id !== 'string') {
      return NextResponse.json(
        { success: false, error: 'name と tcgplayer_id は必須です' },
        { status: 400 }
      )
    }

    const trimmedName = name.trim()
    const trimmedTcgplayerId = tcgplayer_id.trim()
    if (!trimmedName || !trimmedTcgplayerId) {
      return NextResponse.json(
        { success: false, error: 'name と tcgplayer_id は空にできません' },
        { status: 400 }
      )
    }

    if (trimmedName.length > 200 || trimmedTcgplayerId.length > 200) {
      return NextResponse.json(
        { success: false, error: '入力が長すぎます' },
        { status: 400 }
      )
    }

    // 文字列フィールドのサニタイズ
    const str = (v: unknown, max = 500): string | null => {
      if (typeof v !== 'string') return null
      const t = v.trim()
      return t.length > 0 && t.length <= max ? t : null
    }
    const urlVal = (v: unknown): string | null => {
      const s = str(v, 2000)
      if (!s) return null
      try { const u = new URL(s); return u.protocol === 'https:' || u.protocol === 'http:' ? s : null } catch { return null }
    }
    // card_number正規化
    const normalizeCardNumber = (num: string | null): string | null => {
      if (!num) return null
      const m = num.match(/^(\d+)\/(\d+)$/)
      if (!m) return num
      const maxLen = Math.max(m[1].length, m[2].length)
      return `${m[1].padStart(maxLen, '0')}/${m[2].padStart(maxLen, '0')}`
    }

    const supabase = createServiceClient()

    // tcgplayer_id 既存チェック
    const { data: existing, error: dupCheckError } = await supabase
      .from('cards')
      .select('id, name')
      .eq('tcgplayer_id', trimmedTcgplayerId)
      .maybeSingle()

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
      'one-piece-card-game': 'ワンピースカード',
    }
    const validGame = typeof game === 'string' && game in GAME_CATEGORY_MAP ? game : 'pokemon-japan'
    const categoryName = GAME_CATEGORY_MAP[validGame]

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

    // release_date: ISO日付形式のみ許可
    const safeReleaseDate = typeof release_date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(release_date)
      ? release_date.slice(0, 10) : null
    const safeReleaseYear = safeReleaseDate ? parseInt(safeReleaseDate.slice(0, 4), 10) : null

    // rarity_id 自動ルックアップ（英語名→日本語略称→raritiesテーブル）
    let rarityId: string | null = null
    const rarityStr = str(rarity, 50)
    if (rarityStr && category?.id) {
      const jaRarity = getRarityShortName(rarityStr) || rarityStr
      const { data: rarityRow } = await supabase
        .from('rarities')
        .select('id')
        .eq('large_id', category.id)
        .eq('name', jaRarity)
        .maybeSingle()
      rarityId = rarityRow?.id || null
    }

    // tcgplayer_id が既に登録済み → 既存カードを最新データで上書きUPDATE
    if (existing) {
      const updateFields: Record<string, unknown> = { name: trimmedName }
      if (str(name_en, 200)) updateFields.name_en = str(name_en, 200)
      if (str(card_number, 50)) updateFields.card_number = str(card_number, 50)
      if (str(rarity, 50)) updateFields.rarity = str(rarity, 50)
      if (str(set_name_en, 200)) updateFields.set_name_en = str(set_name_en, 200)
      if (safeReleaseYear) updateFields.release_year = safeReleaseYear
      if (safeReleaseDate) updateFields.release_date = safeReleaseDate
      if (str(expansion, 200)) updateFields.expansion = str(expansion, 200)
      if (category?.id) updateFields.category_large_id = category.id
      if (rarityId) updateFields.rarity_id = rarityId
      if (urlVal(image_url)) updateFields.image_url = urlVal(image_url)

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

    // 名前+型番+カテゴリで既存カードを検索（JustTCGから登録済みの場合マージ）
    const cardNumber = normalizeCardNumber(str(card_number, 50))
    let mergeTarget: { id: string; name: string } | null = null

    if (cardNumber && category?.id) {
      const { data: nameMerge } = await supabase
        .from('cards')
        .select('id, name')
        .eq('name', trimmedName)
        .eq('card_number', cardNumber)
        .eq('category_large_id', category.id)
        .is('tcgplayer_id', null)
        .maybeSingle()
      if (nameMerge) mergeTarget = nameMerge
    }

    // 型番+カテゴリのみで検索（名前が微妙に異なる場合の緩和マージ）
    if (!mergeTarget && cardNumber && category?.id) {
      const { data: looseMerge } = await supabase
        .from('cards')
        .select('id, name')
        .eq('card_number', cardNumber)
        .eq('category_large_id', category.id)
        .is('tcgplayer_id', null)
        .limit(2)
      if (looseMerge && looseMerge.length === 1) mergeTarget = looseMerge[0]
    }

    if (mergeTarget) {
      const updateFields: Record<string, unknown> = {
        name: trimmedName,
        tcgplayer_id: trimmedTcgplayerId,
      }
      if (str(name_en, 200)) updateFields.name_en = str(name_en, 200)
      if (str(rarity, 50)) updateFields.rarity = str(rarity, 50)
      if (str(set_name_en, 200)) updateFields.set_name_en = str(set_name_en, 200)
      if (safeReleaseYear) updateFields.release_year = safeReleaseYear
      if (safeReleaseDate) updateFields.release_date = safeReleaseDate
      if (str(expansion, 200)) updateFields.expansion = str(expansion, 200)
      if (category?.id) updateFields.category_large_id = category.id
      if (rarityId) updateFields.rarity_id = rarityId
      if (urlVal(image_url)) updateFields.image_url = urlVal(image_url)

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

    // INSERT
    const { data: card, error } = await supabase
      .from('cards')
      .insert({
        name: trimmedName,
        name_en: str(name_en, 200),
        card_number: cardNumber,
        rarity: str(rarity, 50),
        rarity_id: rarityId,
        set_name_en: str(set_name_en, 200),
        release_year: safeReleaseYear,
        release_date: safeReleaseDate,
        expansion: str(expansion, 200),
        image_url: urlVal(image_url),
        tcgplayer_id: trimmedTcgplayerId,
        category_large_id: category?.id || null,
      })
      .select()
      .single()

    if (error) {
      // TOCTOU対策: tcgplayer_id重複 → 既存レコードをUPDATEにフォールバック
      const isDuplicate = error.code === '23505' || error.message?.includes('duplicate')
      if (isDuplicate) {
        const { data: raceExisting } = await supabase
          .from('cards')
          .select('id')
          .eq('tcgplayer_id', trimmedTcgplayerId)
          .maybeSingle()
        if (raceExisting) {
          const fallbackFields: Record<string, unknown> = { name: trimmedName }
          if (str(name_en, 200)) fallbackFields.name_en = str(name_en, 200)
          if (cardNumber) fallbackFields.card_number = cardNumber
          if (str(rarity, 50)) fallbackFields.rarity = str(rarity, 50)
          if (rarityId) fallbackFields.rarity_id = rarityId
          if (safeReleaseDate) fallbackFields.release_date = safeReleaseDate
          if (str(expansion, 200)) fallbackFields.expansion = str(expansion, 200)
          if (category?.id) fallbackFields.category_large_id = category.id
          if (urlVal(image_url)) fallbackFields.image_url = urlVal(image_url)
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('cards')
            .update(fallbackFields)
            .eq('id', raceExisting.id)
            .select()
            .single()
          if (!fallbackError) {
            return NextResponse.json({ success: true, data: fallbackData, updated: true })
          }
        }
        return NextResponse.json(
          { success: false, error: '既に登録済みです（重複）' },
          { status: 409 }
        )
      }
      console.error('Card register error:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: card })
  } catch (error: unknown) {
    console.error('TCG API register error:', error)
    return NextResponse.json(
      { success: false, error: '登録処理に失敗しました' },
      { status: 500 }
    )
  }
}
