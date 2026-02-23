import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const CHUNK_SIZE = 100
const MAX_IDS = 2000

export async function POST(request: NextRequest) {
  try {
    let body: any
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ success: false, error: '不正なリクエスト形式' }, { status: 400 })
    }

    const { justtcg_ids } = body
    if (!Array.isArray(justtcg_ids)) {
      return NextResponse.json({ success: false, error: 'justtcg_ids は配列で指定してください' }, { status: 400 })
    }

    // 型チェック + 重複除去 + 上限ガード
    const ids = [...new Set(
      justtcg_ids.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 200)
    )].slice(0, MAX_IDS)

    if (ids.length === 0) {
      return NextResponse.json({ success: true, registeredIds: [] })
    }

    const supabase = createServiceClient()
    const registeredIds: string[] = []
    const registeredNames: Record<string, string> = {}

    // Supabase .in() は100件制限があるため、チャンク処理
    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE)
      const { data, error } = await supabase
        .from('cards')
        .select('justtcg_id, name')
        .in('justtcg_id', chunk)

      if (error) {
        console.error('check-registered query error:', error)
        continue
      }

      if (data) {
        for (const row of data) {
          if (row.justtcg_id) {
            registeredIds.push(row.justtcg_id)
            if (row.name) registeredNames[row.justtcg_id] = row.name
          }
        }
      }
    }

    return NextResponse.json({ success: true, registeredIds, registeredNames })
  } catch (error: unknown) {
    console.error('check-registered error:', error)
    return NextResponse.json({ success: false, error: '登録チェックに失敗しました' }, { status: 500 })
  }
}
