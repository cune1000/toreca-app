import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// 間隔の段階（分）
const INTERVALS = [30, 60, 180, 360, 720, 1440] // 30分, 1時間, 3時間, 6時間, 12時間, 24時間

// 次の間隔を取得
function getNextInterval(currentInterval: number, changed: boolean): number {
  if (changed) {
    return INTERVALS[0] // 変更があれば30分に戻す
  }
  
  const currentIndex = INTERVALS.indexOf(currentInterval)
  if (currentIndex === -1 || currentIndex >= INTERVALS.length - 1) {
    return INTERVALS[INTERVALS.length - 1]
  }
  return INTERVALS[currentIndex + 1]
}

// 日本時間で現在の曜日と時刻を取得
function getJapanTime(): { dayOfWeek: number; time: string; date: Date } {
  const now = new Date()
  const japanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  const dayOfWeek = japanTime.getDay()
  const hours = japanTime.getHours().toString().padStart(2, '0')
  const minutes = japanTime.getMinutes().toString().padStart(2, '0')
  return { dayOfWeek, time: `${hours}:${minutes}`, date: japanTime }
}

// 休憩時間中かチェック
function isInRestTime(time: string, restStart: string | null, restEnd: string | null): boolean {
  if (!restStart || !restEnd) return false
  return time >= restStart && time < restEnd
}

// 次回チェック時刻が休憩時間内なら休憩後に調整
async function adjustForRestTime(nextCheckDate: Date): Promise<Date> {
  const nextJapan = new Date(nextCheckDate.toLocaleString('en-US', { timeZone: 'Asia/Tokyo' }))
  const dayOfWeek = nextJapan.getDay()
  const hours = nextJapan.getHours().toString().padStart(2, '0')
  const minutes = nextJapan.getMinutes().toString().padStart(2, '0')
  const nextTime = `${hours}:${minutes}`
  
  const { data: restTimeData } = await supabase
    .from('cron_rest_times')
    .select('*')
    .eq('day_of_week', dayOfWeek)
    .single()
  
  if (!restTimeData) return nextCheckDate
  
  // 休憩1にかかるかチェック
  if (restTimeData.rest_start_1 && restTimeData.rest_end_1) {
    if (nextTime >= restTimeData.rest_start_1 && nextTime < restTimeData.rest_end_1) {
      const [h, m] = restTimeData.rest_end_1.split(':').map(Number)
      nextJapan.setHours(h, m + 15, 0, 0) // 休憩終了の15分後
      return new Date(nextJapan.getTime() + 9 * 60 * 60 * 1000 - nextJapan.getTimezoneOffset() * 60 * 1000)
    }
  }
  
  // 休憩2にかかるかチェック
  if (restTimeData.rest_start_2 && restTimeData.rest_end_2) {
    if (nextTime >= restTimeData.rest_start_2 && nextTime < restTimeData.rest_end_2) {
      const [h, m] = restTimeData.rest_end_2.split(':').map(Number)
      nextJapan.setHours(h, m + 15, 0, 0)
      return new Date(nextJapan.getTime() + 9 * 60 * 60 * 1000 - nextJapan.getTimezoneOffset() * 60 * 1000)
    }
  }
  
  return nextCheckDate
}

// スクレイピング実行
async function scrapeUrl(url: string): Promise<{ 
  price: number | null
  stock: number | null
  error?: string 
}> {
  try {
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    
    const res = await fetch(`${baseUrl}/api/scrape`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
    
    const data = await res.json()
    
    if (data.success) {
      // 在庫数を取得（数値または文字列に対応）
      let stock = null
      if (data.stock !== null && data.stock !== undefined) {
        if (typeof data.stock === 'number') {
          stock = data.stock
        } else if (typeof data.stock === 'string') {
          const stockMatch = data.stock.match(/(\d+)/)
          if (stockMatch) {
            stock = parseInt(stockMatch[1], 10)
          } else if (data.stock.includes('あり') || data.stock.includes('在庫')) {
            stock = 1
          } else if (data.stock.includes('なし') || data.stock.includes('売切')) {
            stock = 0
          }
        }
      }
      return { price: data.price || null, stock }
    }
    
    return { price: null, stock: null, error: data.error || 'Unknown error' }
  } catch (err: any) {
    return { price: null, stock: null, error: err.message }
  }
}

export async function GET(request: NextRequest) {
  // 認証チェック
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  console.log('=== Starting smart price update cron ===')
  
  const results = {
    processed: 0,
    updated: 0,
    unchanged: 0,
    errors: 0,
    skipped: 0
  }
  
  try {
    const japan = getJapanTime()
    console.log(`Japan time: ${japan.time}, Day: ${japan.dayOfWeek}`)
    
    // 休憩時間チェック
    const { data: restTimeData } = await supabase
      .from('cron_rest_times')
      .select('*')
      .eq('day_of_week', japan.dayOfWeek)
      .single()
    
    if (restTimeData) {
      const inRest1 = isInRestTime(japan.time, restTimeData.rest_start_1, restTimeData.rest_end_1)
      const inRest2 = isInRestTime(japan.time, restTimeData.rest_start_2, restTimeData.rest_end_2)
      
      if (inRest1 || inRest2) {
        const restEnd = inRest1 ? restTimeData.rest_end_1 : restTimeData.rest_end_2
        console.log(`In rest time until ${restEnd}, skipping...`)
        return NextResponse.json({
          success: true,
          message: `Skipped - rest time until ${restEnd}`,
          ...results,
          timestamp: new Date().toISOString()
        })
      }
    }
    
    // チェック対象を取得
    const now = new Date().toISOString()
    const { data: saleUrls, error: urlError } = await supabase
      .from('card_sale_urls')
      .select('*, card:card_id(name), site:site_id(name)')
      .lte('next_check_at', now)
      .order('next_check_at', { ascending: true })
      .limit(10)
    
    if (urlError) throw new Error('Failed to fetch URLs: ' + urlError.message)
    
    if (!saleUrls || saleUrls.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No URLs to check',
        ...results,
        timestamp: new Date().toISOString()
      })
    }
    
    console.log(`Found ${saleUrls.length} URLs to process`)
    
    // 各URLを処理
    for (const saleUrl of saleUrls) {
      results.processed++
      const cardName = saleUrl.card?.name || 'Unknown'
      const siteName = saleUrl.site?.name || 'Unknown'
      
      console.log(`Processing: ${cardName} @ ${siteName}`)
      
      try {
        const { price, stock, error } = await scrapeUrl(saleUrl.product_url)
        
        if (error) {
          // エラー：30分後にリトライ
          let nextCheck = new Date(Date.now() + 30 * 60 * 1000)
          nextCheck = await adjustForRestTime(nextCheck)
          
          await supabase
            .from('card_sale_urls')
            .update({
              next_check_at: nextCheck.toISOString(),
              error_count: (saleUrl.error_count || 0) + 1,
              last_error: error,
              last_checked_at: now
            })
            .eq('id', saleUrl.id)
          
          await supabase.from('cron_logs').insert({
            card_sale_url_id: saleUrl.id,
            card_name: cardName,
            site_name: siteName,
            status: 'error',
            error_message: error
          })
          
          results.errors++
          
        } else if (price !== null) {
          // 成功：変更チェック
          const priceChanged = saleUrl.last_price !== null && saleUrl.last_price !== price
          const stockChanged = saleUrl.last_stock !== null && saleUrl.last_stock !== stock
          const changed = priceChanged || stockChanged
          
          const currentInterval = saleUrl.check_interval || 30
          const nextInterval = getNextInterval(currentInterval, changed)
          let nextCheck = new Date(Date.now() + nextInterval * 60 * 1000)
          nextCheck = await adjustForRestTime(nextCheck)
          
          await supabase
            .from('card_sale_urls')
            .update({
              next_check_at: nextCheck.toISOString(),
              check_interval: nextInterval,
              last_price: price,
              last_stock: stock,
              last_checked_at: now,
              error_count: 0,
              last_error: null
            })
            .eq('id', saleUrl.id)
          
          // 初回または価格/在庫変動時に記録
          if (priceChanged || stockChanged || saleUrl.last_price === null) {
            await supabase.from('sale_prices').insert({
              card_id: saleUrl.card_id,
              site_id: saleUrl.site_id,
              price: price,
              stock: stock
            })
            results.updated++
          } else {
            results.unchanged++
          }
          
          await supabase.from('cron_logs').insert({
            card_sale_url_id: saleUrl.id,
            card_name: cardName,
            site_name: siteName,
            status: 'success',
            old_price: saleUrl.last_price,
            new_price: price,
            old_stock: saleUrl.last_stock,
            new_stock: stock,
            price_changed: priceChanged,
            stock_changed: stockChanged
          })
          
        } else {
          results.skipped++
          await supabase.from('cron_logs').insert({
            card_sale_url_id: saleUrl.id,
            card_name: cardName,
            site_name: siteName,
            status: 'skipped',
            error_message: 'Price not found'
          })
        }
        
        // レート制限回避
        await new Promise(resolve => setTimeout(resolve, 2000))
        
      } catch (err: any) {
        console.error(`Error: ${cardName}:`, err)
        results.errors++
      }
    }
    
    console.log('=== Cron completed ===', results)
    
    return NextResponse.json({
      success: true,
      message: 'Price update completed',
      ...results,
      timestamp: new Date().toISOString()
    })
    
  } catch (err: any) {
    console.error('Cron error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
