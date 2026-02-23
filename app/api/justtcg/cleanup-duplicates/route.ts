import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * JustTCG重複カードクリーンアップ
 *
 * PCインポートレコード(A: justtcg_idなし) と JTレコード(B: justtcg_idあり) が
 * 同一カードなのに別レコードとして存在するケースを修正する。
 *
 * BのJTデータをAにマージし、関連テーブルのFK参照をAに移行してBを削除。
 *
 * GET: ドライラン（対象一覧を表示）
 * POST: 実行（マージ+削除）
 */

interface DuplicatePair {
  keep: { id: string; name: string; card_number: string | null; pricecharting_id: string | null }
  remove: { id: string; name: string; justtcg_id: string }
  matchReason: string
}

async function findDuplicates(supabase: ReturnType<typeof createServiceClient>): Promise<DuplicatePair[]> {
  // JTレコード（justtcg_idあり）を全件取得
  const { data: jtCards, error } = await supabase
    .from('cards')
    .select('id, name, card_number, category_large_id, pricecharting_id, justtcg_id')
    .not('justtcg_id', 'is', null)

  if (error || !jtCards) {
    console.error('Failed to fetch JT cards:', error)
    return []
  }

  const pairs: DuplicatePair[] = []

  for (const jt of jtCards) {
    if (!jt.justtcg_id) continue

    // Stage 1: pricecharting_id マッチ
    if (jt.pricecharting_id) {
      const { data: pcMatch } = await supabase
        .from('cards')
        .select('id, name, card_number, pricecharting_id')
        .eq('pricecharting_id', jt.pricecharting_id)
        .is('justtcg_id', null)
        .neq('id', jt.id)
        .maybeSingle()

      if (pcMatch) {
        pairs.push({
          keep: pcMatch,
          remove: { id: jt.id, name: jt.name, justtcg_id: jt.justtcg_id },
          matchReason: `pricecharting_id=${jt.pricecharting_id}`,
        })
        continue
      }
    }

    // Stage 2: card_number + category マッチ
    if (jt.card_number && jt.category_large_id) {
      const { data: numMatch } = await supabase
        .from('cards')
        .select('id, name, card_number, pricecharting_id')
        .eq('card_number', jt.card_number)
        .eq('category_large_id', jt.category_large_id)
        .is('justtcg_id', null)
        .neq('id', jt.id)
        .limit(2)

      if (numMatch && numMatch.length === 1) {
        pairs.push({
          keep: numMatch[0],
          remove: { id: jt.id, name: jt.name, justtcg_id: jt.justtcg_id },
          matchReason: `card_number=${jt.card_number} + category`,
        })
      }
    }
  }

  return pairs
}

// FK参照テーブルを全てAに移行
const FK_TABLES = [
  { table: 'purchase_prices', column: 'card_id' },
  { table: 'sale_prices', column: 'card_id' },
  { table: 'card_sale_urls', column: 'card_id' },
  { table: 'overseas_prices', column: 'card_id' },
  { table: 'snkrdunk_sales_history', column: 'card_id' },
  { table: 'pending_cards', column: 'matched_card_id' },
  { table: 'card_purchase_links', column: 'card_id' },
] as const

export async function GET() {
  try {
    const supabase = createServiceClient()
    const pairs = await findDuplicates(supabase)

    return NextResponse.json({
      success: true,
      count: pairs.length,
      pairs: pairs.map(p => ({
        keep: `${p.keep.name} [${p.keep.id.slice(0, 8)}] pc=${p.keep.pricecharting_id}`,
        remove: `${p.remove.name} [${p.remove.id.slice(0, 8)}] jt=${p.remove.justtcg_id}`,
        matchReason: p.matchReason,
      })),
    })
  } catch (error) {
    console.error('Cleanup dry-run error:', error)
    return NextResponse.json({ success: false, error: '確認に失敗しました' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient()
    const pairs = await findDuplicates(supabase)

    if (pairs.length === 0) {
      return NextResponse.json({ success: true, message: '重複なし', merged: 0 })
    }

    const results: Array<{ keep: string; remove: string; status: string }> = []

    for (const pair of pairs) {
      const keepId = pair.keep.id
      const removeId = pair.remove.id

      try {
        // 1. JTデータをkeepレコードにマージ
        // removeレコードからJT固有フィールドを取得
        const { data: removeCard } = await supabase
          .from('cards')
          .select('*')
          .eq('id', removeId)
          .single()

        if (!removeCard) {
          results.push({ keep: keepId, remove: removeId, status: 'skip: remove card not found' })
          continue
        }

        // keepレコードにJTデータをマージ（既存値がある場合は上書きしない、JT固有フィールドは必ずセット）
        const mergeFields: Record<string, unknown> = {
          justtcg_id: removeCard.justtcg_id,
        }
        // JTからの情報で既存が空のフィールドを埋める
        const { data: keepCard } = await supabase
          .from('cards')
          .select('*')
          .eq('id', keepId)
          .single()

        if (!keepCard) {
          results.push({ keep: keepId, remove: removeId, status: 'skip: keep card not found' })
          continue
        }

        // name: JT側の日本語名が最新なので常に更新
        if (removeCard.name) mergeFields.name = removeCard.name
        // 以下は既存値がなければJT側から補完
        if (!keepCard.name_en && removeCard.name_en) mergeFields.name_en = removeCard.name_en
        if (!keepCard.rarity && removeCard.rarity) mergeFields.rarity = removeCard.rarity
        if (!keepCard.rarity_id && removeCard.rarity_id) mergeFields.rarity_id = removeCard.rarity_id
        if (!keepCard.set_code && removeCard.set_code) mergeFields.set_code = removeCard.set_code
        if (!keepCard.set_name_en && removeCard.set_name_en) mergeFields.set_name_en = removeCard.set_name_en
        if (!keepCard.release_year && removeCard.release_year) mergeFields.release_year = removeCard.release_year
        if (!keepCard.expansion && removeCard.expansion) mergeFields.expansion = removeCard.expansion
        if (!keepCard.tcgplayer_id && removeCard.tcgplayer_id) mergeFields.tcgplayer_id = removeCard.tcgplayer_id
        if (!keepCard.category_large_id && removeCard.category_large_id) mergeFields.category_large_id = removeCard.category_large_id
        // image_url: JT側の方が良い場合は更新（PCのimage_urlはbase64の場合がある）
        if (removeCard.image_url && removeCard.image_url.startsWith('http')) {
          mergeFields.image_url = removeCard.image_url
        }

        const { error: mergeError } = await supabase
          .from('cards')
          .update(mergeFields)
          .eq('id', keepId)

        if (mergeError) {
          results.push({ keep: keepId, remove: removeId, status: `merge error: ${mergeError.message}` })
          continue
        }

        // 2. FK参照テーブルを全てkeepIdに移行
        let fkErrors = 0
        for (const { table, column } of FK_TABLES) {
          const { error: fkError } = await supabase
            .from(table)
            .update({ [column]: keepId })
            .eq(column, removeId)

          if (fkError) {
            console.error(`FK migration error (${table}):`, fkError)
            fkErrors++
          }
        }

        // 3. removeレコードを削除
        const { error: deleteError } = await supabase
          .from('cards')
          .delete()
          .eq('id', removeId)

        if (deleteError) {
          results.push({ keep: keepId, remove: removeId, status: `delete error: ${deleteError.message} (fkErrors: ${fkErrors})` })
          continue
        }

        results.push({ keep: keepId, remove: removeId, status: `ok (fkErrors: ${fkErrors})` })
      } catch (err: any) {
        results.push({ keep: keepId, remove: removeId, status: `error: ${err.message}` })
      }
    }

    const succeeded = results.filter(r => r.status.startsWith('ok')).length
    return NextResponse.json({
      success: true,
      merged: succeeded,
      total: pairs.length,
      results,
    })
  } catch (error) {
    console.error('Cleanup error:', error)
    return NextResponse.json({ success: false, error: 'クリーンアップに失敗しました' }, { status: 500 })
  }
}
