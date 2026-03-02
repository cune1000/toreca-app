import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getSetCodeToJaMap } from '@/lib/justtcg-set-names'

const supabase = createServiceClient()

/**
 * スニダン収録弾一覧API
 * GET /api/linking/snkrdunk/set-codes
 * → { setCodes: [{ code: "M1S", jaName: "メガシンフォニア", count: 150 }, ...] }
 */
export async function GET() {
  try {
    // parsed_set_code の DISTINCT + COUNT を取得
    const { data, error } = await supabase
      .from('snkrdunk_items_cache')
      .select('parsed_set_code')
      .not('parsed_set_code', 'is', null)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 手動集計（Supabase PostgRESTにGROUP BYがないため）
    const countMap: Record<string, number> = {}
    for (const row of data || []) {
      const code = row.parsed_set_code as string
      countMap[code] = (countMap[code] || 0) + 1
    }

    const jaMap = getSetCodeToJaMap()

    const setCodes = Object.entries(countMap)
      .map(([code, count]) => ({
        code,
        jaName: jaMap[code] || code,
        count,
      }))
      .sort((a, b) => a.jaName.localeCompare(b.jaName, 'ja'))

    return NextResponse.json({ setCodes })
  } catch (error: any) {
    console.error('[linking/snkrdunk/set-codes] Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
