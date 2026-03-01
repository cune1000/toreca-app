import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { SET_NAME_JA, extractSetCode, getSetNameJa } from '@/lib/justtcg-set-names'
import { getRarityShortName } from '@/lib/rarity-mapping'

export const dynamic = 'force-dynamic'

// justtcg_id からセットIDを逆引き
// 例: "pokemon-japan-m2-inferno-x-oricorio-ex-111-080-special-art-rare"
//   → set_id: "m2-inferno-x-pokemon-japan"
function extractSetIdFromJusttcgId(justtcgId: string): string | null {
  // 既知のゲームプレフィックス
  const GAME_PREFIXES = ['pokemon-japan-', 'one-piece-card-game-']
  let slug = ''
  for (const prefix of GAME_PREFIXES) {
    if (justtcgId.startsWith(prefix)) {
      slug = justtcgId.slice(prefix.length)
      const gameSuffix = prefix.slice(0, -1) // 末尾の '-' を除去
      // SET_NAME_JA の全キーに対してマッチ試行（長い順 = より具体的なマッチ優先）
      const sortedSetIds = Object.keys(SET_NAME_JA)
        .filter(k => k.endsWith(gameSuffix))
        .sort((a, b) => b.length - a.length)
      for (const setId of sortedSetIds) {
        // setId から gameSuffix を除去してスラグ部分を取得
        // "m2-inferno-x-pokemon-japan" → "m2-inferno-x-"
        const setSlug = setId.replace(`-${gameSuffix}`, '') + '-'
        if (slug.startsWith(setSlug)) {
          return setId
        }
      }
      break
    }
  }
  return null
}

export async function POST() {
  try {
    const supabase = createServiceClient()

    // justtcg_id があるが set_code/expansion/rarity_id が欠けているカードを取得
    const { data: cards, error } = await supabase
      .from('cards')
      .select('id, justtcg_id, rarity, category_large_id, set_code, expansion, rarity_id')
      .not('justtcg_id', 'is', null)
      .or('set_code.is.null,expansion.is.null,rarity_id.is.null')
      .limit(1000)

    if (error) {
      console.error('Backfill query error:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    if (!cards || cards.length === 0) {
      return NextResponse.json({ success: true, message: '更新対象なし', updated: 0 })
    }

    // レアリティテーブルを事前取得（ルックアップ用）
    const { data: allRarities } = await supabase
      .from('rarities')
      .select('id, name, large_id')

    const rarityMap = new Map<string, string>()
    if (allRarities) {
      for (const r of allRarities) {
        // "large_id:name" → id のマップ
        rarityMap.set(`${r.large_id}:${r.name}`, r.id)
      }
    }

    let updated = 0
    let skipped = 0
    const errors: string[] = []

    for (const card of cards) {
      const updates: Record<string, unknown> = {}

      // set_code / expansion の復元
      if (!card.set_code || !card.expansion) {
        const setId = extractSetIdFromJusttcgId(card.justtcg_id)
        if (setId) {
          if (!card.set_code) {
            const setCode = extractSetCode(setId)
            if (setCode) updates.set_code = setCode
          }
          if (!card.expansion) {
            const expansion = getSetNameJa(setId, '')
            if (expansion) updates.expansion = expansion
          }
        }
      }

      // rarity_id の復元
      if (!card.rarity_id && card.rarity && card.category_large_id) {
        const jaRarity = getRarityShortName(card.rarity) || card.rarity
        const key = `${card.category_large_id}:${jaRarity}`
        const rarityId = rarityMap.get(key)
        if (rarityId) updates.rarity_id = rarityId
      }

      if (Object.keys(updates).length === 0) {
        skipped++
        continue
      }

      const { error: updateError } = await supabase
        .from('cards')
        .update(updates)
        .eq('id', card.id)

      if (updateError) {
        errors.push(`${card.id}: ${updateError.message}`)
      } else {
        updated++
      }
    }

    return NextResponse.json({
      success: true,
      total: cards.length,
      updated,
      skipped,
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error: unknown) {
    console.error('Backfill error:', error)
    return NextResponse.json(
      { success: false, error: 'メタデータ復元に失敗しました' },
      { status: 500 }
    )
  }
}
