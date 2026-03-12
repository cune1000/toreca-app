import { NextResponse } from 'next/server'
import { getUsdJpyRate } from '@/lib/exchange-rate'
import { withCronAuth } from '@/lib/cron-gate'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * 為替レート同期 Cron
 * USD/JPY レートを取得して exchange_rates テーブルに保存
 * 毎日 AM2:55 JST に実行（海外価格同期の前に実行）
 */
export const GET = withCronAuth('exchange-rate-sync', async (req, supabase) => {
    console.log('[Exchange Rate Sync] Starting...')

    const rate = await getUsdJpyRate()
    console.log(`[Exchange Rate Sync] USD/JPY = ${rate}`)

    // 同日の既存レコードがあればスキップ（JST日付で判定）
    const today = new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().substring(0, 10)
    const { data: existing } = await supabase
      .from('exchange_rates')
      .select('id')
      .eq('base_currency', 'USD')
      .eq('target_currency', 'JPY')
      .gte('recorded_at', `${today}T00:00:00+09:00`)
      .lte('recorded_at', `${today}T23:59:59+09:00`)
      .limit(1)

    if (existing && existing.length > 0) {
      // 既存レコードを更新
      const { data, error } = await supabase
        .from('exchange_rates')
        .update({ rate })
        .eq('id', existing[0].id)
        .select()
        .single()

      if (error) {
        console.error('[Exchange Rate Sync] Update error:', error)
        throw new Error(error.message)
      }

      console.log(`[Exchange Rate Sync] Updated existing: ${rate}`)
      return NextResponse.json({ success: true, rate, data, updated: true })
    }

    const { data, error } = await supabase
      .from('exchange_rates')
      .insert({
        base_currency: 'USD',
        target_currency: 'JPY',
        rate,
      })
      .select()
      .single()

    if (error) {
      console.error('[Exchange Rate Sync] Insert error:', error)
      throw new Error(error.message)
    }

    console.log(`[Exchange Rate Sync] Saved: ${rate}`)

    return NextResponse.json({
      success: true,
      rate,
      data,
    })
})
