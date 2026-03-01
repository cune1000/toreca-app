import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

/**
 * GET /api/cron-schedules
 * 全スケジュール取得
 */
export async function GET() {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('cron_schedules')
    .select('*')
    .order('job_name')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

/**
 * PUT /api/cron-schedules
 * スケジュール更新（配列で一括更新）
 */
export async function PUT(request: NextRequest) {
  const supabase = createServiceClient()

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const schedules = Array.isArray(body) ? body : [body]
  const results: { job_name: string; success: boolean; error?: string }[] = []

  for (const schedule of schedules) {
    const { job_name, enabled, interval_minutes, run_at_hours, run_at_minute } = schedule

    if (!job_name) {
      results.push({ job_name: 'unknown', success: false, error: 'job_name is required' })
      continue
    }

    const updateData: Record<string, any> = { updated_at: new Date().toISOString() }
    if (typeof enabled === 'boolean') updateData.enabled = enabled
    if (typeof interval_minutes === 'number') updateData.interval_minutes = interval_minutes
    if (Array.isArray(run_at_hours)) updateData.run_at_hours = run_at_hours
    if (typeof run_at_minute === 'number') updateData.run_at_minute = run_at_minute

    const { error } = await supabase
      .from('cron_schedules')
      .update(updateData)
      .eq('job_name', job_name)

    results.push({
      job_name,
      success: !error,
      error: error?.message,
    })
  }

  const hasErrors = results.some(r => !r.success)
  return NextResponse.json(
    { results },
    { status: hasErrors ? 207 : 200 }
  )
}
