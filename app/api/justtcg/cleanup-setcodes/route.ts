import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * set_code にHTMLゴミが入っているレコードを検出・修正
 * GET: ドライラン（対象一覧）
 * POST: 実行（修正）
 */

function verifyAuth(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

// set_codeは英数字+ハイフンのみ
const VALID_SET_CODE = /^[A-Za-z0-9\-]+$/

function cleanSetCode(raw: string): string | null {
  if (VALID_SET_CODE.test(raw)) return raw
  const match = raw.match(/^([A-Za-z0-9\-]+)/)
  return match ? match[1] : null
}

export async function GET(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const { data: cards, error } = await supabase
    .from('cards')
    .select('id, name, set_code')
    .not('set_code', 'is', null)

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  const dirty = (cards || []).filter(c => c.set_code && !VALID_SET_CODE.test(c.set_code))

  return NextResponse.json({
    success: true,
    total: cards?.length || 0,
    dirty: dirty.length,
    records: dirty.map(c => ({
      id: c.id.slice(0, 8),
      name: c.name,
      set_code: c.set_code,
      cleaned: cleanSetCode(c.set_code!),
    })),
  })
}

export async function POST(request: NextRequest) {
  if (!verifyAuth(request)) {
    return NextResponse.json({ success: false, error: '認証が必要です' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const { data: cards, error } = await supabase
    .from('cards')
    .select('id, set_code')
    .not('set_code', 'is', null)

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }

  const dirty = (cards || []).filter(c => c.set_code && !VALID_SET_CODE.test(c.set_code))
  let fixed = 0
  let nulled = 0

  for (const c of dirty) {
    const cleaned = cleanSetCode(c.set_code!)
    const { error: updateError } = await supabase
      .from('cards')
      .update({ set_code: cleaned })
      .eq('id', c.id)

    if (!updateError) {
      if (cleaned) fixed++
      else nulled++
    }
  }

  return NextResponse.json({ success: true, dirty: dirty.length, fixed, nulled })
}
