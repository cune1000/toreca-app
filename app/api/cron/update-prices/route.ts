import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const RAILWAY_URL = process.env.RAILWAY_SCRAPER_URL

// Cronジョブ認証（Vercel Cron用）
function verifyCronAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  // Vercel Cronからの呼び出しの場合
  if (authHeader === `Bearer ${cronSecret}`) {
    return true
  }
  
  // 開発環境では認証スキップ
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

// GET: Cronジョブとして実行
export async function GET(request: NextRequest) {
  // 認証チェック
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
    // 1. 更新が必要なカードURLを取得（優先度順）
    // - 最後の更新から24時間以上経過
    // - 価格変動が激しいもの優先
    // - 在庫ありのもの優先
    const { data: saleSites, error: fetchError } = await supabase
      .from('card_sale_sites')
      .select(`
        id,
        card_id,
        site_id,
        url,
        last_price,
        last_stock,
        last_checked_at,
        cards (name),
        sale_sites (name, site_key)
      `)
      .not('url', 'is', null)
      .order('last_checked_at', { ascending: true, nullsFirst: true })
      .limit(50) // 1回のCronで最大50件

    if (fetchError) throw fetchError

    if (!saleSites || saleSites.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No URLs to update',
        duration: Date.now() - startTime
      })
    }

    // 2. 各URLをスクレイピング
    for (const site of saleSites) {
      results.processed++
      
      const cardName = (site.cards as any)?.name || 'Unknown'
      const siteName = (site.sale_sites as any)?.name || 'Unknown'
      
      try {
        // 24時間以内に更新済みの場合はスキップ
        if (site.last_checked_at) {
          const lastChecked = new Date(site.last_checked_at)
          const hoursSince = (Date.now() - lastChecked.getTime()) / (1000 * 60 * 60)
          
          if (hoursSince < 24) {
            results.skipped++
            continue
          }
        }

        // スクレイピング実行
        const scrapeResult = await scrapeViaRailway(site.url, 'light')
        
        if (!scrapeResult.success) {
          results.errors++
          results.details.push({
            cardName,
            siteName,
            error: scrapeResult.error || 'Scrape failed'
          })
          continue
        }

        // 価格と在庫を取得
        let newPrice = scrapeResult.price || scrapeResult.mainPrice
        let newStock = scrapeResult.stock
        
        // 状態別価格がある場合（トレカキャンプ等）
        if (scrapeResult.conditions && scrapeResult.conditions.length > 0) {
          // 状態Aの価格を優先
          const conditionA = scrapeResult.conditions.find((c: any) => c.condition === '状態A')
          const conditionNew = scrapeResult.conditions.find((c: any) => c.condition === '新品')
          
          if (conditionA?.price) {
            newPrice = conditionA.price
            newStock = conditionA.stock
          } else if (conditionNew?.price) {
            newPrice = conditionNew.price
            newStock = conditionNew.stock
          }
        }

        // 価格が取得できた場合のみ更新
        if (newPrice !== null && newPrice !== undefined) {
          const priceChanged = site.last_price !== newPrice
          
          // card_sale_sites を更新
          await supabase
            .from('card_sale_sites')
            .update({
              last_price: newPrice,
              last_stock: newStock,
              last_checked_at: new Date().toISOString()
            })
            .eq('id', site.id)

          // 価格変動があった場合は履歴に記録
          if (priceChanged) {
            await supabase
              .from('price_history')
              .insert({
                card_sale_site_id: site.id,
                price: newPrice,
                stock: newStock
              })
          }

          results.updated++
          results.details.push({
            cardName,
            siteName,
            oldPrice: site.last_price,
            newPrice,
            changed: priceChanged
          })
        } else {
          results.errors++
          results.details.push({
            cardName,
            siteName,
            error: 'Price not found in response'
          })
        }

        // レート制限対策（1秒待機）
        await new Promise(resolve => setTimeout(resolve, 1000))

      } catch (err: any) {
        results.errors++
        results.details.push({
          cardName,
          siteName,
          error: err.message
        })
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
  // bodyが空でもエラーにならないように修正
  let limit = 10
  let forceUpdate = false
  
  try {
    const body = await request.json()
    limit = body.limit ?? 10
    forceUpdate = body.forceUpdate ?? false
  } catch {
    // bodyが空の場合はデフォルト値を使用
  }
  
  // GETと同じ処理を実行（認証スキップ）
  const startTime = Date.now()
  const results = {
    processed: 0,
    updated: 0,
    errors: 0,
    skipped: 0,
    details: [] as any[]
  }

  try {
    const { data: saleSites, error: fetchError } = await supabase
      .from('card_sale_sites')
      .select(`
        id,
        card_id,
        site_id,
        url,
        last_price,
        last_stock,
        last_checked_at,
        cards (name),
        sale_sites (name, site_key)
      `)
      .not('url', 'is', null)
      .order('last_checked_at', { ascending: true, nullsFirst: true })
      .limit(limit)

    if (fetchError) throw fetchError

    if (!saleSites || saleSites.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No URLs to update',
        duration: Date.now() - startTime
      })
    }

    for (const site of saleSites) {
      results.processed++
      
      const cardName = (site.cards as any)?.name || 'Unknown'
      const siteName = (site.sale_sites as any)?.name || 'Unknown'
      
      try {
        // forceUpdateでない場合、24時間以内に更新済みならスキップ
        if (!forceUpdate && site.last_checked_at) {
          const lastChecked = new Date(site.last_checked_at)
          const hoursSince = (Date.now() - lastChecked.getTime()) / (1000 * 60 * 60)
          
          if (hoursSince < 24) {
            results.skipped++
            continue
          }
        }

        const scrapeResult = await scrapeViaRailway(site.url, 'light')
        
        if (!scrapeResult.success) {
          results.errors++
          results.details.push({ cardName, siteName, error: scrapeResult.error })
          continue
        }

        let newPrice = scrapeResult.price || scrapeResult.mainPrice
        let newStock = scrapeResult.stock
        
        if (scrapeResult.conditions && scrapeResult.conditions.length > 0) {
          const conditionA = scrapeResult.conditions.find((c: any) => c.condition === '状態A')
          const conditionNew = scrapeResult.conditions.find((c: any) => c.condition === '新品')
          
          if (conditionA?.price) {
            newPrice = conditionA.price
            newStock = conditionA.stock
          } else if (conditionNew?.price) {
            newPrice = conditionNew.price
            newStock = conditionNew.stock
          }
        }

        if (newPrice !== null && newPrice !== undefined) {
          const priceChanged = site.last_price !== newPrice
          
          await supabase
            .from('card_sale_sites')
            .update({
              last_price: newPrice,
              last_stock: newStock,
              last_checked_at: new Date().toISOString()
            })
            .eq('id', site.id)

          if (priceChanged) {
            await supabase
              .from('price_history')
              .insert({
                card_sale_site_id: site.id,
                price: newPrice,
                stock: newStock
              })
          }

          results.updated++
          results.details.push({ cardName, siteName, oldPrice: site.last_price, newPrice, changed: priceChanged })
        } else {
          results.errors++
          results.details.push({ cardName, siteName, error: 'Price not found' })
        }

        await new Promise(resolve => setTimeout(resolve, 1000))

      } catch (err: any) {
        results.errors++
        results.details.push({ cardName, siteName, error: err.message })
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
