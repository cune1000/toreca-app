import { NextResponse } from 'next/server'
import { createServiceClient, TABLES } from '@/lib/supabase'
import { getUsdJpyRate } from '@/lib/exchange-rate'

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

    console.log('[Exchange Rate Sync] Starting...')

    const rate = await getUsdJpyRate()
    console.log(`[Exchange Rate Sync] USD/JPY = ${rate}`)

    const supabase = createServiceClient()

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

    return NextResponse.json({
      success: true,
      rate,
      data,
    })
  } catch (error: any) {
    console.error('[Exchange Rate Sync] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
