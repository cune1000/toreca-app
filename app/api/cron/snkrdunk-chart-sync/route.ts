import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { shouldRunCronJob, markCronJobRun } from '@/lib/cron-gate'
import {
  extractApparelId,
  getProductInfo,
  getSalesChartUsed,
  getSalesChart,
  getBoxChartOptions,
  SINGLE_CHART_OPTIONS,
} from '@/lib/snkrdunk-api'
import { ALLOWED_GRADES } from '@/components/card-detail/constants'
import { cleanChartData } from '@/lib/snkrdunk-chart'
import type { SupabaseClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// 1バッチあたりの処理数（タイムアウト前にチェーンする）
const BATCH_SIZE = 30
// タイムアウト安全マージン（残り30秒でチェーン）
const TIMEOUT_MARGIN_MS = 30_000

/**
 * スニダンチャートデータ定期更新Cron
 * 全紐づけ済みカードを完走するまでチェーン呼び出しで繰り返す
 */
export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const params = req.nextUrl.searchParams
    const isChain = params.get('chain') === '1'
    const limitParam = params.get('limit')

    // チェーン呼び出し時はcron-gateをスキップ
    if (!isChain) {
      const force = params.get('force') === '1'
      const gate = await shouldRunCronJob('snkrdunk-chart-sync', { force })
      if (!gate.shouldRun) {
        return NextResponse.json({ skipped: true, reason: gate.reason })
      }
    }

    const startTime = Date.now()
    const supabase = createServiceClient()
    const batchLimit = limitParam ? Math.min(parseInt(limitParam) || BATCH_SIZE, 500) : BATCH_SIZE

    // 紐づけ済みのスニダンURLを取得（最終チャート更新が古い順）
    const { data: saleUrls, error: fetchError } = await supabase
      .from('card_sale_urls')
      .select('card_id, apparel_id, product_url')
      .like('product_url', '%snkrdunk.com%')
      .not('apparel_id', 'is', null)
      .order('last_scraped_at', { ascending: true, nullsFirst: true })
      .limit(batchLimit)

    if (fetchError) {
      throw new Error(fetchError.message)
    }

    if (!saleUrls || saleUrls.length === 0) {
      await markCronJobRun('snkrdunk-chart-sync', 'success')
      return NextResponse.json({ success: true, processed: 0, message: 'No cards to update' })
    }

    const results: { cardId: string; status: string; conditions?: number; inserted?: number; error?: string }[] = []
    let timedOut = false

    for (const url of saleUrls) {
      // タイムアウト前にループを抜ける
      const elapsed = Date.now() - startTime
      if (elapsed > (maxDuration * 1000) - TIMEOUT_MARGIN_MS) {
        timedOut = true
        break
      }

      const cardId = url.card_id
      const apparelId = url.apparel_id ?? extractApparelId(url.product_url)
      if (!apparelId) {
        results.push({ cardId, status: 'error', error: 'No apparel_id' })
        continue
      }

      try {
        // product_type判定
        let productType: string
        try {
          const info = await getProductInfo(apparelId)
          productType = info.isBox ? 'box' : 'single'
        } catch {
          productType = 'single'
        }

        const fetchedAt = new Date().toISOString()
        let totalInserted = 0
        let condCount = 0

        if (productType === 'single') {
          const singleGrades = [...ALLOWED_GRADES].filter(g => !/^\d+個$/.test(g))
          for (const condLabel of singleGrades) {
            const optionId = SINGLE_CHART_OPTIONS[condLabel]
            if (optionId === undefined) continue
            try {
              const chartData = await getSalesChartUsed(apparelId, optionId, 'all')
              if (!chartData.points || chartData.points.length === 0) continue
              const cleaned = cleanChartData(chartData.points)
              const inserted = await upsertChartData(supabase, cardId, apparelId, productType, condLabel, cleaned, fetchedAt)
              totalInserted += inserted
              condCount++
              await sleep(300)
            } catch (e: unknown) {
              const eMsg = e instanceof Error ? e.message : String(e)
              console.error(`[snkrdunk-chart-sync] ${cardId} ${condLabel}:`, eMsg)
            }
          }
        } else {
          try {
            const options = await getBoxChartOptions(apparelId)
            const oneBox = options.find(o => o.localizedName === '1個')
            if (oneBox) {
              const chartData = await getSalesChart(apparelId, oneBox.id, 'all')
              if (chartData.points && chartData.points.length > 0) {
                const cleaned = cleanChartData(chartData.points)
                totalInserted = await upsertChartData(supabase, cardId, apparelId, productType, '1個', cleaned, fetchedAt)
                condCount = 1
              }
            }
          } catch (e: unknown) {
            const eMsg = e instanceof Error ? e.message : String(e)
            console.error(`[snkrdunk-chart-sync] BOX ${cardId}:`, eMsg)
          }
        }

        // last_scraped_at を更新（次回は後回しになる）
        await supabase
          .from('card_sale_urls')
          .update({ last_scraped_at: fetchedAt })
          .eq('card_id', cardId)
          .like('product_url', '%snkrdunk.com%')

        results.push({ cardId, status: 'success', conditions: condCount, inserted: totalInserted })
        await sleep(500)
      } catch (e: unknown) {
        const eMsg = e instanceof Error ? e.message : String(e)
        console.error(`[snkrdunk-chart-sync] ${cardId}:`, eMsg)
        results.push({ cardId, status: 'error', error: eMsg })
      }
    }

    const remaining = saleUrls.length - results.length

    // チェーン判定: タイムアウトで中断 OR バッチが満杯（＝まだ未処理カードがある可能性）
    const shouldChain = (timedOut && remaining > 0) || saleUrls.length >= batchLimit
    if (shouldChain) {
      const host = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000'
      console.log(`[snkrdunk-chart-sync] Chaining: batch=${saleUrls.length}, batchLimit=${batchLimit}, timedOut=${timedOut}`)
      fetch(`${host}/api/cron/snkrdunk-chart-sync?chain=1`, {
        headers: { 'Authorization': `Bearer ${cronSecret}` },
      }).catch(e => console.error('[snkrdunk-chart-sync] Chain failed:', e.message))
    }

    if (!isChain) {
      await markCronJobRun('snkrdunk-chart-sync', 'success').catch(() => {})
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      remaining,
      chained: shouldChain,
      results,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error)
    console.error('[snkrdunk-chart-sync] Error:', error)
    await markCronJobRun('snkrdunk-chart-sync', 'error', message).catch(() => {})
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

async function upsertChartData(
  supabase: SupabaseClient,
  cardId: string,
  apparelId: number,
  productType: string,
  condition: string,
  cleaned: ReturnType<typeof cleanChartData>,
  fetchedAt: string
): Promise<number> {
  const rows = cleaned.map(p => ({
    card_id: cardId,
    apparel_id: apparelId,
    condition,
    product_type: productType,
    date: new Date(p.date).toISOString(),
    price: p.price,
    price_cleaned: p.priceCleaned,
    is_anomaly: p.isAnomaly,
    fetched_at: fetchedAt,
  }))

  let inserted = 0
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100)
    const { error } = await supabase
      .from('snkrdunk_chart_data')
      .upsert(batch, { onConflict: 'card_id,condition,date' })
    if (error) {
      console.error(`[snkrdunk-chart-sync] Upsert error:`, error.message)
    } else {
      inserted += batch.length
    }
  }
  return inserted
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
