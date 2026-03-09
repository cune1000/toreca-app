import { NextResponse } from 'next/server'
import { createServiceClient, TABLES } from '@/lib/supabase'
import { getUsdJpyRate } from '@/lib/exchange-rate'
import { shouldRunCronJob, markCronJobRun } from '@/lib/cron-gate'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * 為替レート同期 Cron
 * USD/JPY レートを取得して exchange_rates テーブルに保存
 * 毎日 AM2:55 JST に実行（海外価格同期の前に実行）
 */
export async function GET(req: Request) {
  try {
    // CRON_SECRET認証
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const force = new URL(req.url).searchParams.get('force') === '1'
    const gate = await shouldRunCronJob('exchange-rate-sync', { force })
    if (!gate.shouldRun) {
      return NextResponse.json({ skipped: true, reason: gate.reason })
    }

    console.log('[Exchange Rate Sync] Starting...')

    const rate = await getUsdJpyRate()
    console.log(`[Exchange Rate Sync] USD/JPY = ${rate}`)

    const supabase = createServiceClient()

    // 同日の既存レコードがあればスキップ（force実行時の重複防止）
    const today = new Date().toISOString().substring(0, 10)
    const { data: existing } = await supabase
      .from(TABLES.EXCHANGE_RATES)
      .select('id')
      .eq('base_currency', 'USD')
      .eq('target_currency', 'JPY')
      .gte('recorded_at', `${today}T00:00:00`)
      .lte('recorded_at', `${today}T23:59:59`)
      .limit(1)

    if (existing && existing.length > 0) {
      // 既存レコードを更新
      const { data, error } = await supabase
        .from(TABLES.EXCHANGE_RATES)
        .update({ rate })
        .eq('id', existing[0].id)
        .select()
        .single()

      if (error) {
        console.error('[Exchange Rate Sync] Update error:', error)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
      }

      console.log(`[Exchange Rate Sync] Updated existing: ${rate}`)
      await markCronJobRun('exchange-rate-sync', 'success')
      return NextResponse.json({ success: true, rate, data, updated: true })
    }

    const { data, error } = await supabase
      .from(TABLES.EXCHANGE_RATES)
      .insert({
        base_currency: 'USD',
        target_currency: 'JPY',
        rate,
      })
      .select()
      .single()

    if (error) {
      console.error('[Exchange Rate Sync] Insert error:', error)
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      )
    }

    console.log(`[Exchange Rate Sync] Saved: ${rate}`)

    await markCronJobRun('exchange-rate-sync', 'success')
    return NextResponse.json({
      success: true,
      rate,
      data,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[Exchange Rate Sync] Error:', error)
    await markCronJobRun('exchange-rate-sync', 'error', message).catch(() => {})
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
