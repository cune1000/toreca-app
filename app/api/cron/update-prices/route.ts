import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const RAILWAY_URL = process.env.RAILWAY_SCRAPER_URL

// ===== 設定 =====
const CONFIG = {
  DEFAULT_INTERVAL: 30,        // デフォルト間隔（分）
  MAX_INTERVAL: 360,           // 最大間隔（分）= 6時間
  OUT_OF_STOCK_INTERVAL: 360,  // 在庫0の場合の間隔（分）
  ERROR_RETRY_INTERVAL: 30,    // エラー時のリトライ間隔（分）
  JITTER_PERCENT: 10,          // ゆらぎ幅（±%）
  
  // 変動なし時の間隔テーブル
  NO_CHANGE_INTERVALS: [30, 60, 180, 360],  // 0回, 1回, 2回, 3回以上
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

// 変動なし回数から間隔を取得
function getIntervalByNoChangeCount(count: number): number {
  const index = Math.min(count, CONFIG.NO_CHANGE_INTERVALS.length - 1)
  return CONFIG.NO_CHANGE_INTERVALS[index]
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
        const scrapeResult = await scrapeViaRailway(site.product_url, 'light')
        
        if (!scrapeResult.success) {
          // エラー時：30分後リトライ
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

        // 価格・在庫取得
        let newPrice = scrapeResult.price || scrapeResult.mainPrice
        let newStock = scrapeResult.stock

        if (typeof newStock !== 'number') {
          newStock = newStock ? parseInt(newStock, 10) : 0
        }
        
        // 状態別価格がある場合
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

        if (newPrice !== null && newPrice !== undefined) {
          const priceChanged = oldPrice !== newPrice
          const stockChanged = oldStock !== newStock
          
          let nextBaseInterval: number
          let newNoChangeCount: number
          let status: 'success' | 'no_change'

          if (priceChanged) {
            // 価格変動あり → 30分にリセット
            nextBaseInterval = CONFIG.DEFAULT_INTERVAL
            newNoChangeCount = 0
            status = 'success'
            results.updated++
          } else if (newStock === 0) {
            // 在庫0 → 6時間
            nextBaseInterval = CONFIG.OUT_OF_STOCK_INTERVAL
            newNoChangeCount = currentNoChangeCount
            status = 'no_change'
            results.noChange++
          } else {
            // 価格変動なし → 間隔延長
            newNoChangeCount = currentNoChangeCount + 1
            nextBaseInterval = getIntervalByNoChangeCount(newNoChangeCount)
            status = 'no_change'
            results.noChange++
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

          // 価格または在庫が変動した場合のみ履歴に追加
          if (priceChanged || stockChanged) {
            await supabase
              .from('price_history')
              .insert({
                card_sale_url_id: site.id,
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

        let newPrice = scrapeResult.price || scrapeResult.mainPrice
        let newStock = scrapeResult.stock

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

        if (newPrice !== null && newPrice !== undefined) {
          const priceChanged = oldPrice !== newPrice
          const stockChanged = oldStock !== newStock
          
          let nextBaseInterval: number
          let newNoChangeCount: number
          let status: 'success' | 'no_change'

          if (priceChanged) {
            nextBaseInterval = CONFIG.DEFAULT_INTERVAL
            newNoChangeCount = 0
            status = 'success'
            results.updated++
          } else if (newStock === 0) {
            nextBaseInterval = CONFIG.OUT_OF_STOCK_INTERVAL
            newNoChangeCount = currentNoChangeCount
            status = 'no_change'
            results.noChange++
          } else {
            newNoChangeCount = currentNoChangeCount + 1
            nextBaseInterval = getIntervalByNoChangeCount(newNoChangeCount)
            status = 'no_change'
            results.noChange++
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

          if (priceChanged || stockChanged) {
            await supabase
              .from('price_history')
              .insert({
                card_sale_url_id: site.id,
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
