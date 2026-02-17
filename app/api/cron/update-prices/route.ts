import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const supabase = createServiceClient()
import {
  extractApparelId,
  getProductInfo,
  getAllListings,
  getBoxSizes,
} from '@/lib/snkrdunk-api'

const RAILWAY_URL = process.env.RAILWAY_SCRAPER_URL

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
  if (!RAILWAY_URL) {
    throw new Error('RAILWAY_SCRAPER_URL is not configured')
  }

  const res = await fetch(`${RAILWAY_URL}/scrape`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, mode }),
  })

  return await res.json()
}

// スニダンAPIでグレード別最安値を取得
interface SnkrdunkPriceResult {
  prices: { grade: string; price: number }[]
  overallMin: number | null
  totalListings: number  // 全出品数
}
async function scrapeSnkrdunkPrices(productUrl: string): Promise<SnkrdunkPriceResult> {
  const apparelId = extractApparelId(productUrl)
  if (!apparelId) {
    throw new Error('Invalid snkrdunk URL: cannot extract apparelId')
  }

  const productInfo = await getProductInfo(apparelId)
  const productType = productInfo.isBox ? 'box' : 'single'
  const prices: { grade: string; price: number }[] = []
  let totalListings = 0
  let overallMin: number | null = null

  if (productType === 'single') {
    // シングル: 出品一覧からグレード別最安値を取得
    const listings = await getAllListings(apparelId, 'single', 5)
    totalListings = listings.length

    // 全体最安値（全出品の中から）
    if (listings.length > 0) {
      overallMin = Math.min(...listings.map(l => l.price))
    }

    // PSA10最安値
    const psa10Items = listings.filter(l => l.condition.includes('PSA10'))
    if (psa10Items.length > 0) {
      prices.push({ grade: 'PSA10', price: Math.min(...psa10Items.map(l => l.price)) })
    }

    // 状態A最安値（PSA/ARS/BGS鑑定品を除外）
    const gradeAItems = listings.filter(l =>
      (l.condition.startsWith('A') || l.condition.includes('A（')) &&
      !l.condition.includes('PSA') &&
      !l.condition.includes('ARS') &&
      !l.condition.includes('BGS')
    )
    if (gradeAItems.length > 0) {
      prices.push({ grade: 'A', price: Math.min(...gradeAItems.map(l => l.price)) })
    }
  } else {
    // BOX: /sizes APIから価格・出品数を取得
    // productInfoはBOXでminPrice=0, totalListingCount=0を返すため
    const sizes = await getBoxSizes(apparelId)
    totalListings = sizes.reduce((sum, s) => sum + s.listingCount, 0)
    const oneBox = sizes.find(s => s.quantity === 1)
    if (oneBox) {
      prices.push({ grade: 'BOX', price: oneBox.minPrice })
      overallMin = oneBox.minPrice
    } else if (sizes.length > 0) {
      const cheapest = sizes.reduce((a, b) => a.minPrice < b.minPrice ? a : b)
      prices.push({ grade: 'BOX', price: cheapest.minPrice })
      overallMin = cheapest.minPrice
    }
  }

  return { prices, overallMin, totalListings }
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

// ===== メイン処理 =====

// GET: Cronジョブとして実行
export async function GET(request: NextRequest) {
  // 認証チェック
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 休み時間チェック
  if (isRestTime()) {
    return NextResponse.json({
      success: true,
      message: 'Rest time (2:00-9:00 JST), skipping',
      skipped: true
    })
  }

  const startTime = Date.now()
  const results = {
    processed: 0,
    updated: 0,
    noChange: 0,
    errors: 0,
    skipped: 0,
    details: [] as any[]
  }

  try {
    // next_check_atが現在時刻以前のものを取得（チェック予定を過ぎたもの）
    const now = new Date().toISOString()

    const { data: saleUrls, error: fetchError } = await supabase
      .from('card_sale_urls')
      .select(`
        id,
        card_id,
        site_id,
        product_url,
        last_price,
        last_stock,
        check_interval,
        no_change_count,
        next_check_at,
        error_count,
        card:card_id(name),
        site:site_id(name, site_key)
      `)
      .not('product_url', 'is', null)
      .or(`next_check_at.is.null,next_check_at.lte.${now}`)
      .order('next_check_at', { ascending: true, nullsFirst: true })
      .limit(50)

    if (fetchError) throw fetchError

    if (!saleUrls || saleUrls.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No URLs to check at this time',
        ...results,
        duration: Date.now() - startTime
      })
    }

    for (const site of saleUrls) {
      results.processed++

      const cardName = (site.card as any)?.name || 'Unknown'
      const siteName = (site.site as any)?.name || 'Unknown'
      const oldPrice = site.last_price
      const oldStock = site.last_stock
      const currentNoChangeCount = site.no_change_count || 0

      try {
        // スニダンURL判定
        const isSnkrdunk = site.product_url?.includes('snkrdunk.com')

        let newPrice: number | null = null
        let newStock: number | null = null
        let gradePrices: { grade: string; price: number }[] = []

        if (isSnkrdunk) {
          // 新API方式: グレード別最安値 + 全体最安値 + 出品数を取得
          const result = await scrapeSnkrdunkPrices(site.product_url)
          gradePrices = result.prices
          newPrice = result.overallMin
          newStock = result.totalListings  // 全出品数を在庫として記録
        } else {
          // 既存のRailway方式
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
            continue
          }

          newPrice = scrapeResult.price ?? scrapeResult.mainPrice
          newStock = scrapeResult.stock

          if (typeof newStock !== 'number') {
            newStock = newStock ? parseInt(newStock, 10) : 0
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
        }

        if (newPrice !== null && newPrice !== undefined) {
          const priceChanged = oldPrice !== newPrice
          const stockChanged = oldStock !== newStock

          let nextBaseInterval: number
          let newNoChangeCount: number
          let status: 'success' | 'no_change'

          if (newStock === 0) {
            // 在庫0 → 6時間
            nextBaseInterval = CONFIG.OUT_OF_STOCK_INTERVAL
            newNoChangeCount = currentNoChangeCount
            status = 'no_change'
            results.noChange++
          } else {
            // 価格変動率に応じて間隔を調整
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

          // DB更新
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

          // 毎回履歴に追加（価格・在庫の変動有無に関係なく）
          if (gradePrices.length > 0) {
            // スニダン: 全体最安値 + 出品数（grade=null）を保存
            await supabase
              .from('sale_prices')
              .insert({
                card_id: site.card_id,
                site_id: site.site_id,
                price: newPrice,
                stock: newStock,
                grade: null,
              })
            // スニダン: グレード別に保存
            for (const gp of gradePrices) {
              await supabase
                .from('sale_prices')
                .insert({
                  card_id: site.card_id,
                  site_id: site.site_id,
                  price: gp.price,
                  grade: gp.grade,
                })
            }
          } else {
            // 通常サイト: grade無しで保存
            await supabase
              .from('sale_prices')
              .insert({
                card_id: site.card_id,
                site_id: site.site_id,
                price: newPrice,
                stock: newStock
              })
          }

          results.details.push({
            cardName, siteName, status,
            oldPrice, newPrice, oldStock, newStock,
            priceChanged, stockChanged,
            nextInterval,
            noChangeCount: newNoChangeCount
          })
          await logCronResult(site.id, cardName, siteName, status, oldPrice, newPrice, oldStock, newStock, nextInterval)

        } else {
          // 価格取得失敗
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

    return NextResponse.json({
      success: true,
      ...results,
      duration: Date.now() - startTime
    })

  } catch (error: any) {
    console.error('Cron error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      ...results,
      duration: Date.now() - startTime
    }, { status: 500 })
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
  const results = {
    processed: 0,
    updated: 0,
    noChange: 0,
    errors: 0,
    skipped: 0,
    details: [] as any[]
  }

  try {
    let query = supabase
      .from('card_sale_urls')
      .select(`
        id,
        card_id,
        site_id,
        product_url,
        last_price,
        last_stock,
        check_interval,
        no_change_count,
        next_check_at,
        error_count,
        card:card_id(name),
        site:site_id(name, site_key)
      `)
      .not('product_url', 'is', null)
      .order('next_check_at', { ascending: true, nullsFirst: true })
      .limit(limit)

    // forceUpdateでない場合は、next_check_atを過ぎたもののみ
    if (!forceUpdate) {
      const now = new Date().toISOString()
      query = query.or(`next_check_at.is.null,next_check_at.lte.${now}`)
    }

    const { data: saleUrls, error: fetchError } = await query

    if (fetchError) throw fetchError

    if (!saleUrls || saleUrls.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No URLs to update',
        duration: Date.now() - startTime
      })
    }

    for (const site of saleUrls) {
      results.processed++

      const cardName = (site.card as any)?.name || 'Unknown'
      const siteName = (site.site as any)?.name || 'Unknown'
      const oldPrice = site.last_price
      const oldStock = site.last_stock
      const currentNoChangeCount = site.no_change_count || 0

      try {
        // スニダンURL判定
        const isSnkrdunk = site.product_url?.includes('snkrdunk.com')

        let newPrice: number | null = null
        let newStock: number | null = null
        let gradePrices: { grade: string; price: number }[] = []

        if (isSnkrdunk) {
          // 新API方式: グレード別最安値 + 全体最安値 + 出品数を取得
          const result = await scrapeSnkrdunkPrices(site.product_url)
          gradePrices = result.prices
          newPrice = result.overallMin
          newStock = result.totalListings  // 全出品数を在庫として記録
        } else {
          // 既存のRailway方式
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
            continue
          }

          newPrice = scrapeResult.price ?? scrapeResult.mainPrice
          newStock = scrapeResult.stock

          if (typeof newStock !== 'number') {
            newStock = newStock ? parseInt(newStock, 10) : 0
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

          // 毎回履歴に追加（価格・在庫の変動有無に関係なく）
          if (gradePrices.length > 0) {
            // スニダン: 全体最安値 + 出品数（grade=null）を保存
            await supabase
              .from('sale_prices')
              .insert({
                card_id: site.card_id,
                site_id: site.site_id,
                price: newPrice,
                stock: newStock,
                grade: null,
              })
            // スニダン: グレード別に保存
            for (const gp of gradePrices) {
              await supabase
                .from('sale_prices')
                .insert({
                  card_id: site.card_id,
                  site_id: site.site_id,
                  price: gp.price,
                  grade: gp.grade,
                })
            }
          } else {
            // 通常サイト
            await supabase
              .from('sale_prices')
              .insert({
                card_id: site.card_id,
                site_id: site.site_id,
                price: newPrice,
                stock: newStock
              })
          }

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
          const errorMsg = 'Price not found'
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

    return NextResponse.json({
      success: true,
      ...results,
      duration: Date.now() - startTime
    })

  } catch (error: any) {
    console.error('Manual update error:', error)
    return NextResponse.json({
      success: false,
      error: error.message,
      ...results,
      duration: Date.now() - startTime
    }, { status: 500 })
  }
}
