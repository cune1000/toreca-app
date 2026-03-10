import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { extractSetCode, getSetNameJa } from '@/lib/justtcg-set-names'
import { extractSetIdFromJusttcgId } from '@/lib/justtcg-api'

export const dynamic = 'force-dynamic'

export async function POST() {
  try {
    const supabase = createServiceClient()

    // justtcg_id があるが set_code/expansion が欠けているカードを取得
    const { data: cards, error } = await supabase
      .from('cards')
      .select('id, justtcg_id, rarity, category_large_id, set_code, expansion')
      .not('justtcg_id', 'is', null)
      .or('set_code.is.null,expansion.is.null')
      .limit(1000)

    if (error) {
      console.error('Backfill query error:', error)
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    if (!cards || cards.length === 0) {
      return NextResponse.json({ success: true, message: '更新対象なし', updated: 0 })
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
