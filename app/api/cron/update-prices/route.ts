import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { shouldRunCronJob, markCronJobRun } from '@/lib/cron-gate'

const supabase = createServiceClient()
import { TORECA_SCRAPER_URL } from '@/lib/config'

// ===== 設定 =====
const CONFIG = {
  MIN_INTERVAL: 180,           // 最短間隔（分）= 3時間
  MAX_INTERVAL: 2880,          // 最長間隔（分）= 48時間
  DEFAULT_INTERVAL: 180,       // デフォルト間隔（分）= 3時間
  OUT_OF_STOCK_INTERVAL: 360,  // 在庫0の場合の間隔（分）= 6時間
  ERROR_RETRY_INTERVAL: 180,   // エラー時のリトライ間隔（分）= 3時間
  JITTER_PERCENT: 10,          // ゆらぎ幅（±%）

  // 価格変動ベースの間隔調整
  PRICE_CHANGE_THRESHOLD_LOW: 1,   // 変動1%未満 → +1時間
  PRICE_CHANGE_THRESHOLD_HIGH: 5,  // 変動5%以上 → -1時間
  INTERVAL_STEP: 60,               // 調整ステップ（分）= 1時間
}

// ===== ヘルパー関数 =====

// Cronジョブ認証
function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (authHeader === `Bearer ${cronSecret}`) return true
  if (process.env.NODE_ENV === 'development') return true

  return false
}

// 休み時間チェック（日本時間 2:00〜9:00）
function isRestTime(): boolean {
  const now = new Date()
  const jstHour = (now.getUTCHours() + 9) % 24
  return jstHour >= 2 && jstHour < 9
}

// ±10%のゆらぎを加えた間隔を計算
function getJitteredInterval(baseMinutes: number): number {
  const jitterRange = baseMinutes * (CONFIG.JITTER_PERCENT / 100)
  const jitter = (Math.random() * 2 - 1) * jitterRange  // -10% 〜 +10%
  return Math.round(baseMinutes + jitter)
}

// 次回チェック時刻を計算
function calculateNextCheckAt(intervalMinutes: number): string {
  const next = new Date(Date.now() + intervalMinutes * 60 * 1000)
  return next.toISOString()
}

// 価格変動率に応じた次回間隔を計算
function calculateNextInterval(currentInterval: number, oldPrice: number | null, newPrice: number | null): number {
  let interval = currentInterval || CONFIG.DEFAULT_INTERVAL

  // 最低3時間にクランプ
  if (interval < CONFIG.MIN_INTERVAL) interval = CONFIG.MIN_INTERVAL

  if (oldPrice && newPrice && oldPrice > 0) {
    const changePercent = Math.abs((newPrice - oldPrice) / oldPrice * 100)

    if (changePercent < CONFIG.PRICE_CHANGE_THRESHOLD_LOW) {
      // 変動1%未満 → +1時間
      interval += CONFIG.INTERVAL_STEP
    } else if (changePercent >= CONFIG.PRICE_CHANGE_THRESHOLD_HIGH) {
      // 変動5%以上 → -1時間
      interval -= CONFIG.INTERVAL_STEP
    }
    // 1%〜5%はそのまま維持
  }

  // 範囲制限
  return Math.max(CONFIG.MIN_INTERVAL, Math.min(CONFIG.MAX_INTERVAL, interval))
}

// Railwayでスクレイピング
async function scrapeViaRailway(url: string, mode: string = 'light') {
  if (!TORECA_SCRAPER_URL) {
    throw new Error('TORECA_SCRAPER_URL is not configured')
  }

  const res = await fetch(`${TORECA_SCRAPER_URL}/scrape`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, mode }),
  })

  return await res.json()
}

// cron_logsに記録
async function logCronResult(
  cardSaleUrlId: string,
  cardName: string,
  siteName: string,
  status: 'success' | 'error' | 'skipped' | 'no_change',
  oldPrice: number | null,
  newPrice: number | null,
  oldStock: number | null,
  newStock: number | null,
  nextInterval: number | null,
  errorMessage?: string
) {
  const priceChanged = oldPrice !== null && newPrice !== null && oldPrice !== newPrice
  const stockChanged = oldStock !== null && newStock !== null && oldStock !== newStock

  await supabase.from('cron_logs').insert({
    card_sale_url_id: cardSaleUrlId,
    card_name: cardName,
    site_name: siteName,
    status,
    old_price: oldPrice,
    new_price: newPrice,
    old_stock: oldStock,
    new_stock: newStock,
    price_changed: priceChanged,
    stock_changed: stockChanged,
    error_message: errorMessage || null,
    executed_at: new Date().toISOString()
  })
}

// ===== 共通処理 =====

interface UpdateResults {
  processed: number
  updated: number
  noChange: number
  errors: number
  skipped: number
  details: any[]
}

// 1つのURLを処理する共通関数
async function processSingleUrl(
  site: any,
  results: UpdateResults,
  logPrefix: string
): Promise<void> {
  // スニダンは snkrdunk-sync で処理するためスキップ
  if (site.product_url?.includes('snkrdunk.com')) {
    results.skipped++
    return
  }

  results.processed++

  const cardName = (site.card as any)?.name || 'Unknown'
  const siteName = (site.site as any)?.name || 'Unknown'
  const oldPrice = site.last_price
  const oldStock = site.last_stock
  const currentNoChangeCount = site.no_change_count || 0

  try {
    let newPrice: number | null = null
    let newStock: number | null = null

    const scrapeResult = await scrapeViaRailway(site.product_url, 'light')

    if (!scrapeResult.success) {
      results.errors++
      const errorMsg = scrapeResult.error || 'Scrape failed'
      const nextInterval = getJitteredInterval(CONFIG.ERROR_RETRY_INTERVAL)

      await supabase
        .from('card_sale_urls')
        .update({
          last_checked_at: new Date().toISOString(),
          next_check_at: calculateNextCheckAt(nextInterval),
          check_interval: CONFIG.ERROR_RETRY_INTERVAL,
          error_count: (site.error_count || 0) + 1,
          last_error: errorMsg
        })
        .eq('id', site.id)

      results.details.push({ cardName, siteName, status: 'error', error: errorMsg, nextInterval })
      await logCronResult(site.id, cardName, siteName, 'error', oldPrice, null, oldStock, null, nextInterval, errorMsg)
      return
    }

    newPrice = scrapeResult.price ?? scrapeResult.mainPrice
    newStock = scrapeResult.stock

    if (typeof newStock !== 'number' || isNaN(newStock)) {
      const parsed = parseInt(String(newStock), 10)
      newStock = isNaN(parsed) ? 0 : parsed
    }

    if (scrapeResult.conditions && scrapeResult.conditions.length > 0) {
      const conditionA = scrapeResult.conditions.find((c: any) => c.condition === '状態A')
      const conditionNew = scrapeResult.conditions.find((c: any) => c.condition === '新品')

      if (conditionA?.price) {
        newPrice = conditionA.price
        newStock = conditionA.stock ?? 0
      } else if (conditionNew?.price) {
        newPrice = conditionNew.price
        newStock = conditionNew.stock ?? 0
      }
    }

    // 在庫切れ（出品0件）: overallMin=null, totalListings=0 の場合
    if (newPrice === null && newStock === 0) {
      const nextInterval = getJitteredInterval(CONFIG.OUT_OF_STOCK_INTERVAL)
      await supabase
        .from('card_sale_urls')
        .update({
          last_stock: 0,
          last_checked_at: new Date().toISOString(),
          next_check_at: calculateNextCheckAt(nextInterval),
          error_count: 0,
          last_error: null,
        })
        .eq('id', site.id)

      results.noChange++
      results.details.push({ cardName, siteName, status: 'no_change', oldPrice, newPrice: oldPrice, oldStock, newStock: 0, priceChanged: false, stockChanged: oldStock !== 0, nextInterval, noChangeCount: currentNoChangeCount })
      await logCronResult(site.id, cardName, siteName, 'no_change', oldPrice, oldPrice, oldStock, 0, nextInterval)
      return
    }

    if (newPrice !== null && newPrice !== undefined) {
      const priceChanged = oldPrice !== newPrice
      const stockChanged = oldStock !== newStock

      let nextBaseInterval: number
      let newNoChangeCount: number
      let status: 'success' | 'no_change'

      if (newStock === 0) {
        nextBaseInterval = CONFIG.OUT_OF_STOCK_INTERVAL
        newNoChangeCount = currentNoChangeCount
        status = 'no_change'
        results.noChange++
      } else {
        const currentCheckInterval = site.check_interval || CONFIG.DEFAULT_INTERVAL
        nextBaseInterval = calculateNextInterval(currentCheckInterval, oldPrice, newPrice)

        if (priceChanged) {
          newNoChangeCount = 0
          status = 'success'
          results.updated++
        } else {
          newNoChangeCount = currentNoChangeCount + 1
          status = 'no_change'
          results.noChange++
        }
      }

      const nextInterval = getJitteredInterval(nextBaseInterval)

      await supabase
        .from('card_sale_urls')
        .update({
          last_price: newPrice,
          last_stock: newStock,
          last_checked_at: new Date().toISOString(),
          next_check_at: calculateNextCheckAt(nextInterval),
          check_interval: nextBaseInterval,
          no_change_count: newNoChangeCount,
          error_count: 0,
          last_error: null
        })
        .eq('id', site.id)

      // 毎回履歴に追加
      const { error: saleErr } = await supabase
        .from('sale_prices')
        .insert({
          card_id: site.card_id,
          site_id: site.site_id,
          price: newPrice,
          stock: newStock
        })
      if (saleErr) console.error(`[${logPrefix}] sale_prices insert error for ${cardName}:`, saleErr)

      results.details.push({
        cardName, siteName, status,
        oldPrice, newPrice, oldStock, newStock,
        priceChanged, stockChanged,
        nextInterval,
        noChangeCount: newNoChangeCount
      })
      await logCronResult(site.id, cardName, siteName, status, oldPrice, newPrice, oldStock, newStock, nextInterval)

    } else {
      results.errors++
      const errorMsg = 'Price not found in response'
      const nextInterval = getJitteredInterval(CONFIG.ERROR_RETRY_INTERVAL)

      await supabase
        .from('card_sale_urls')
        .update({
          last_checked_at: new Date().toISOString(),
          next_check_at: calculateNextCheckAt(nextInterval),
          error_count: (site.error_count || 0) + 1,
          last_error: errorMsg
        })
        .eq('id', site.id)

      results.details.push({ cardName, siteName, status: 'error', error: errorMsg, nextInterval })
      await logCronResult(site.id, cardName, siteName, 'error', oldPrice, null, oldStock, null, nextInterval, errorMsg)
    }

    // レート制限対策
    await new Promise(resolve => setTimeout(resolve, 1000))

  } catch (err: any) {
    results.errors++
    const nextInterval = getJitteredInterval(CONFIG.ERROR_RETRY_INTERVAL)

    await supabase
      .from('card_sale_urls')
      .update({
        last_checked_at: new Date().toISOString(),
        next_check_at: calculateNextCheckAt(nextInterval),
        error_count: (site.error_count || 0) + 1,
        last_error: err.message
      })
      .eq('id', site.id)

    results.details.push({ cardName, siteName, status: 'error', error: err.message, nextInterval })
    await logCronResult(site.id, cardName, siteName, 'error', oldPrice, null, oldStock, null, nextInterval, err.message)
  }
}

// URLリストを取得する共通クエリ
const SALE_URL_SELECT = `
  id, card_id, site_id, product_url,
  last_price, last_stock, check_interval, no_change_count,
  next_check_at, error_count,
  card:card_id(name),
  site:site_id(name, site_key)
`

// ===== メイン処理 =====

// GET: Cronジョブとして実行
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (isRestTime()) {
    return NextResponse.json({
      success: true,
      message: 'Rest time (2:00-9:00 JST), skipping',
      skipped: true
    })
  }

  const gate = await shouldRunCronJob('update-prices')
  if (!gate.shouldRun) {
    return NextResponse.json({ skipped: true, reason: gate.reason })
  }

  const startTime = Date.now()
  const results: UpdateResults = { processed: 0, updated: 0, noChange: 0, errors: 0, skipped: 0, details: [] }

  try {
    const now = new Date().toISOString()
    const { data: saleUrls, error: fetchError } = await supabase
      .from('card_sale_urls')
      .select(SALE_URL_SELECT)
      .not('product_url', 'is', null)
      .not('product_url', 'ilike', '%snkrdunk.com%')
      .or(`next_check_at.is.null,next_check_at.lte.${now}`)
      .order('next_check_at', { ascending: true, nullsFirst: true })
      .limit(50)

    if (fetchError) throw fetchError

    if (!saleUrls || saleUrls.length === 0) {
      return NextResponse.json({ success: true, message: 'No URLs to check at this time', ...results, duration: Date.now() - startTime })
    }

    for (const site of saleUrls) {
      await processSingleUrl(site, results, 'cron')
    }

    await markCronJobRun('update-prices', 'success')
    return NextResponse.json({ success: true, ...results, duration: Date.now() - startTime })
  } catch (error: any) {
    console.error('Cron error:', error)
    await markCronJobRun('update-prices', 'error', error.message)
    return NextResponse.json({ success: false, error: error.message, ...results, duration: Date.now() - startTime }, { status: 500 })
  }
}

// POST: 手動実行用（forceUpdate対応）
export async function POST(request: NextRequest) {
  let limit = 10
  let forceUpdate = false

  try {
    const body = await request.json()
    limit = body.limit ?? 10
    forceUpdate = body.forceUpdate ?? false
  } catch {
    // bodyが空の場合はデフォルト値を使用
  }

  const startTime = Date.now()
  const results: UpdateResults = { processed: 0, updated: 0, noChange: 0, errors: 0, skipped: 0, details: [] }

  try {
    let query = supabase
      .from('card_sale_urls')
      .select(SALE_URL_SELECT)
      .not('product_url', 'is', null)
      .not('product_url', 'ilike', '%snkrdunk.com%')
      .order('next_check_at', { ascending: true, nullsFirst: true })
      .limit(limit)

    if (!forceUpdate) {
      const now = new Date().toISOString()
      query = query.or(`next_check_at.is.null,next_check_at.lte.${now}`)
    }

    const { data: saleUrls, error: fetchError } = await query

    if (fetchError) throw fetchError

    if (!saleUrls || saleUrls.length === 0) {
      return NextResponse.json({ success: true, message: 'No URLs to update', duration: Date.now() - startTime })
    }

    for (const site of saleUrls) {
      await processSingleUrl(site, results, 'manual')
    }

    return NextResponse.json({ success: true, ...results, duration: Date.now() - startTime })
  } catch (error: any) {
    console.error('Manual update error:', error)
    return NextResponse.json({ success: false, error: error.message, ...results, duration: Date.now() - startTime }, { status: 500 })
  }
}
