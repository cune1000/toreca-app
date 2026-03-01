import { createServiceClient } from '@/lib/supabase'

interface GateResult {
  shouldRun: boolean
  reason?: string
}

interface CronSchedule {
  job_name: string
  display_name: string
  enabled: boolean
  schedule_type: 'interval' | 'daily' | 'multi_daily'
  interval_minutes: number | null
  run_at_hours: number[] | null
  run_at_minute: number | null
  last_run_at: string | null
  last_status: string | null
  last_error: string | null
}

/**
 * Cronジョブの実行可否を判定
 * - enabled === false → skip
 * - interval型: now - last_run_at >= interval_minutes なら実行
 * - daily/multi_daily型: 現在UTC時が run_at_hours に含まれ、分が run_at_minute ± 4分以内、かつ同時間帯に未実行なら実行
 */
export async function shouldRunCronJob(jobName: string): Promise<GateResult> {
  const supabase = createServiceClient()

  const { data, error } = await supabase
    .from('cron_schedules')
    .select('*')
    .eq('job_name', jobName)
    .single()

  if (error || !data) {
    // テーブル未作成 or レコード未登録 → 安全のため実行許可
    console.warn(`[cron-gate] Schedule not found for "${jobName}", allowing execution`)
    return { shouldRun: true, reason: 'no-schedule-found' }
  }

  const schedule = data as CronSchedule

  if (!schedule.enabled) {
    return { shouldRun: false, reason: 'disabled' }
  }

  const now = new Date()

  if (schedule.schedule_type === 'interval') {
    return checkInterval(schedule, now)
  } else {
    return checkTimeSchedule(schedule, now)
  }
}

function checkInterval(schedule: CronSchedule, now: Date): GateResult {
  const intervalMs = (schedule.interval_minutes || 20) * 60 * 1000

  if (!schedule.last_run_at) {
    return { shouldRun: true, reason: 'first-run' }
  }

  const elapsed = now.getTime() - new Date(schedule.last_run_at).getTime()
  if (elapsed >= intervalMs) {
    return { shouldRun: true, reason: 'interval-elapsed' }
  }

  const remainingMin = Math.ceil((intervalMs - elapsed) / 60000)
  return { shouldRun: false, reason: `interval-not-reached (${remainingMin}min remaining)` }
}

function checkTimeSchedule(schedule: CronSchedule, now: Date): GateResult {
  const currentHour = now.getUTCHours()
  const currentMinute = now.getUTCMinutes()
  const runAtHours = schedule.run_at_hours || []
  const runAtMinute = schedule.run_at_minute ?? 0

  // 現在のUTC時が run_at_hours に含まれているか
  if (!runAtHours.includes(currentHour)) {
    return { shouldRun: false, reason: `not-scheduled-hour (current=${currentHour}, scheduled=${runAtHours.join(',')})` }
  }

  // 分が run_at_minute ± 4分以内か
  const minuteDiff = Math.abs(currentMinute - runAtMinute)
  if (minuteDiff > 4 && minuteDiff < 56) {
    // 56未満のチェックは時間をまたぐケース（例: run_at_minute=0, currentMinute=58 → diff=58, 60-58=2）
    return { shouldRun: false, reason: `not-scheduled-minute (current=:${currentMinute}, scheduled=:${runAtMinute})` }
  }

  // 同時間帯に未実行か
  if (schedule.last_run_at) {
    const lastRun = new Date(schedule.last_run_at)
    if (lastRun.getUTCHours() === currentHour &&
        lastRun.getUTCDate() === now.getUTCDate() &&
        lastRun.getUTCMonth() === now.getUTCMonth() &&
        lastRun.getUTCFullYear() === now.getUTCFullYear()) {
      return { shouldRun: false, reason: 'already-run-this-hour' }
    }
  }

  return { shouldRun: true, reason: 'scheduled-time-match' }
}

/**
 * Cronジョブの実行結果を記録
 */
export async function markCronJobRun(
  jobName: string,
  status: 'success' | 'error',
  error?: string
): Promise<void> {
  const supabase = createServiceClient()

  await supabase
    .from('cron_schedules')
    .update({
      last_run_at: new Date().toISOString(),
      last_status: status,
      last_error: status === 'error' ? (error || 'Unknown error') : null,
      updated_at: new Date().toISOString(),
    })
    .eq('job_name', jobName)
}
