import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const RAILWAY_URL = process.env.RAILWAY_SCRAPER_URL

// Cronジョブ認証（Vercel Cron用）
function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  if (authHeader === `Bearer ${cronSecret}`) {
    return true
  }
  
  if (process.env.NODE_ENV === 'development') {
    return true
  }
  
  return false
}

// Railway経由でスクレイピング
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
  status: 'success' | 'error' | 'skipped',
  oldPrice: number | null,
  newPrice: number | null,
  oldStock: number | null,
  newStock: number | null,
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

// GET: Cronジョブとして実行
export async function GET(request: NextRequest) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const startTime = Date.now()
  const results = {
    processed: 0,
    updated: 0,
    errors: 0,
    skipped: 0,
    details: [] as any[]
  }

  try {
    const { data: saleUrls, error: fetchError } = await supabase
      .from('card_sale_urls')
      .select(`
        id,
        card_id,
        site_id,
        product_url,
        last_price,
        last_stock,
        last_checked_at,
        card:card_id(name),
        site:site_id(name, site_key)
      `)
      .not('product_url', 'is', null)
      .order('last_checked_at', { ascending: true, nullsFirst: true })
      .limit(50)

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
      
      try {
        // 24時間以内に更新済みの場合はスキップ
        if (site.last_checked_at) {
          const lastChecked = new Date(site.last_checked_at)
          const hoursSince = (Date.now() - lastChecked.getTime()) / (1000 * 60 * 60)
          
          if (hoursSince < 24) {
            results.skipped++
            await logCronResult(site.id, cardName, siteName, 'skipped', oldPrice, oldPrice, oldStock, oldStock)
            continue
          }
        }

        const scrapeResult = await scrapeViaRailway(site.product_url, 'light')
        
        if (!scrapeResult.success) {
          results.errors++
          const errorMsg = scrapeResult.error || 'Scrape failed'
          results.details.push({ cardName, siteName, error: errorMsg })
          await logCronResult(site.id, cardName, siteName, 'error', oldPrice, null, oldStock, null, errorMsg)
          continue
        }

        let newPrice = scrapeResult.price || scrapeResult.mainPrice
        let newStock = scrapeResult.stock

        // 在庫が数値でない場合は0として扱う
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
          const priceChanged = site.last_price !== newPrice
          const stockChanged = site.last_stock !== newStock
          
          await supabase
            .from('card_sale_urls')
            .update({
              last_price: newPrice,
              last_stock: newStock,
              last_checked_at: new Date().toISOString()
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

          results.updated++
          results.details.push({ cardName, siteName, oldPrice, newPrice, oldStock, newStock, priceChanged, stockChanged })
          await logCronResult(site.id, cardName, siteName, 'success', oldPrice, newPrice, oldStock, newStock)
        } else {
          results.errors++
          const errorMsg = 'Price not found in response'
          results.details.push({ cardName, siteName, error: errorMsg })
          await logCronResult(site.id, cardName, siteName, 'error', oldPrice, null, oldStock, null, errorMsg)
        }

        await new Promise(resolve => setTimeout(resolve, 1000))

      } catch (err: any) {
        results.errors++
        results.details.push({ cardName, siteName, error: err.message })
        await logCronResult(site.id, cardName, siteName, 'error', oldPrice, null, oldStock, null, err.message)
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

// POST: 手動実行用
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
    errors: 0,
    skipped: 0,
    details: [] as any[]
  }

  try {
    const { data: saleUrls, error: fetchError } = await supabase
      .from('card_sale_urls')
      .select(`
        id,
        card_id,
        site_id,
        product_url,
        last_price,
        last_stock,
        last_checked_at,
        card:card_id(name),
        site:site_id(name, site_key)
      `)
      .not('product_url', 'is', null)
      .order('last_checked_at', { ascending: true, nullsFirst: true })
      .limit(limit)

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
      
      try {
        if (!forceUpdate && site.last_checked_at) {
          const lastChecked = new Date(site.last_checked_at)
          const hoursSince = (Date.now() - lastChecked.getTime()) / (1000 * 60 * 60)
          
          if (hoursSince < 24) {
            results.skipped++
            await logCronResult(site.id, cardName, siteName, 'skipped', oldPrice, oldPrice, oldStock, oldStock)
            continue
          }
        }

        const scrapeResult = await scrapeViaRailway(site.product_url, 'light')
        
        if (!scrapeResult.success) {
          results.errors++
          const errorMsg = scrapeResult.error || 'Scrape failed'
          results.details.push({ cardName, siteName, error: errorMsg })
          await logCronResult(site.id, cardName, siteName, 'error', oldPrice, null, oldStock, null, errorMsg)
          continue
        }

        let newPrice = scrapeResult.price || scrapeResult.mainPrice
        let newStock = scrapeResult.stock

        // 在庫が数値でない場合は0として扱う
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
          const priceChanged = site.last_price !== newPrice
          const stockChanged = site.last_stock !== newStock
          
          await supabase
            .from('card_sale_urls')
            .update({
              last_price: newPrice,
              last_stock: newStock,
              last_checked_at: new Date().toISOString()
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

          results.updated++
          results.details.push({ cardName, siteName, oldPrice, newPrice, oldStock, newStock, priceChanged, stockChanged })
          await logCronResult(site.id, cardName, siteName, 'success', oldPrice, newPrice, oldStock, newStock)
        } else {
          results.errors++
          const errorMsg = 'Price not found'
          results.details.push({ cardName, siteName, error: errorMsg })
          await logCronResult(site.id, cardName, siteName, 'error', oldPrice, null, oldStock, null, errorMsg)
        }

        await new Promise(resolve => setTimeout(resolve, 1000))

      } catch (err: any) {
        results.errors++
        results.details.push({ cardName, siteName, error: err.message })
        await logCronResult(site.id, cardName, siteName, 'error', oldPrice, null, oldStock, null, err.message)
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
