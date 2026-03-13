import { NextRequest, NextResponse, after } from 'next/server'
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

const BATCH_SIZE = 30
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

    // batchLimit+1件取得し、余剰があれば未処理カードが残っていると判定
    const { data: saleUrls, error: fetchError } = await supabase
      .from('card_sale_urls')
      .select('card_id, apparel_id, product_url')
      .like('product_url', '%snkrdunk.com%')
      .not('apparel_id', 'is', null)
      .order('last_scraped_at', { ascending: true, nullsFirst: true })
      .limit(batchLimit + 1)

    if (fetchError) {
      throw new Error(fetchError.message)
    }

    if (!saleUrls || saleUrls.length === 0) {
      await markCronJobRun('snkrdunk-chart-sync', 'success')
      return NextResponse.json({ success: true, processed: 0, message: 'No cards to update' })
    }

    const hasMore = saleUrls.length > batchLimit
    const toProcess = saleUrls.slice(0, batchLimit)

    const results: { cardId: string; status: string; conditions?: number; inserted?: number; error?: string }[] = []
    let timedOut = false

    for (const url of toProcess) {
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
        // 既存データからproduct_typeを取得（なければAPIで判定）
        const productType = await resolveProductType(supabase, cardId, apparelId)

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
            } else {
              console.warn(`[snkrdunk-chart-sync] BOX ${cardId}: '1個' option not found in [${options.map(o => o.localizedName).join(', ')}]`)
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

        results.push({
          cardId,
          status: condCount > 0 ? 'success' : 'no_data',
          conditions: condCount,
          inserted: totalInserted,
        })
        await sleep(500)
      } catch (e: unknown) {
        const eMsg = e instanceof Error ? e.message : String(e)
        console.error(`[snkrdunk-chart-sync] ${cardId}:`, eMsg)
        results.push({ cardId, status: 'error', error: eMsg })
      }
    }

    const remaining = toProcess.length - results.length

    // チェーン判定: タイムアウトで中断 OR まだ未処理カードが存在
    const shouldChain = (timedOut && remaining > 0) || hasMore
    if (shouldChain) {
      const host = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:3000'
      const chainUrl = `${host}/api/cron/snkrdunk-chart-sync?chain=1`
      console.log(`[snkrdunk-chart-sync] Chaining: hasMore=${hasMore}, timedOut=${timedOut}`)
      // after() でレスポンス返却後にも確実に送信
      after(async () => {
        try {
          const res = await fetch(chainUrl, {
            headers: { 'Authorization': `Bearer ${cronSecret}` },
          })
          console.log(`[snkrdunk-chart-sync] Chain response: ${res.status}`)
        } catch (e: unknown) {
          const eMsg = e instanceof Error ? e.message : String(e)
          console.error('[snkrdunk-chart-sync] Chain failed:', eMsg)
        }
      })
    }

    if (!isChain) {
      await markCronJobRun('snkrdunk-chart-sync', 'success').catch(() => {})
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      remaining,
      hasMore,
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

/** 既存チャートデータからproduct_typeを取得、なければAPIで判定 */
async function resolveProductType(
  supabase: SupabaseClient,
  cardId: string,
  apparelId: number
): Promise<string> {
  const { data } = await supabase
    .from('snkrdunk_chart_data')
    .select('product_type')
    .eq('card_id', cardId)
    .limit(1)
    .single()

  if (data?.product_type) return data.product_type

  try {
    const info = await getProductInfo(apparelId)
    return info.isBox ? 'box' : 'single'
  } catch {
    return 'single'
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
