import { NextRequest, NextResponse } from 'next/server'
import { chromium } from 'playwright'

// Browserless.io に接続
async function connectBrowser() {
  const token = process.env.BROWSERLESS_TOKEN
  
  if (token) {
    // Browserless.io を使用（本番環境）
    return await chromium.connect({
      wsEndpoint: `wss://chrome.browserless.io?token=${token}&stealth`
    })
  } else {
    // ローカル開発用
    return await chromium.launch({ headless: true })
  }
}

// スニダンから価格を取得
async function scrapeSnkrdunk(url: string) {
  let browser = null
  
  try {
    browser = await connectBrowser()
    const page = await browser.newPage()
    
    // User-Agentを設定
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7'
    })
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(3000)
    
    // ページ内容を取得
    const data = await page.evaluate(() => {
      // 商品名
      const nameEl = document.querySelector('h1') || document.querySelector('[class*="product-name"]')
      const name = nameEl?.textContent?.trim() || ''
      
      // 価格を探す（複数のセレクタを試す）
      let price = null
      const priceSelectors = [
        '[class*="price"]',
        '[class*="Price"]',
        '[data-price]',
        '.product-price',
      ]
      
      for (const selector of priceSelectors) {
        try {
          const el = document.querySelector(selector)
          if (el) {
            const text = el.textContent || ''
            const match = text.match(/[¥￥]?\s*([\d,]+)/)
            if (match) {
              price = parseInt(match[1].replace(/,/g, ''), 10)
              break
            }
          }
        } catch {}
      }
      
      // 全テキストから価格を探す
      if (!price) {
        const bodyText = document.body.innerText
        const priceMatches = bodyText.match(/[¥￥]\s*([\d,]+)/g)
        if (priceMatches && priceMatches.length > 0) {
          const match = priceMatches[0].match(/[\d,]+/)
          if (match) {
            price = parseInt(match[0].replace(/,/g, ''), 10)
          }
        }
      }
      
      // 在庫数を探す
      let stock = null
      const stockMatch = document.body.innerText.match(/在庫[：:\s]*(\d+)/) ||
                         document.body.innerText.match(/(\d+)\s*点在庫/)
      if (stockMatch) {
        stock = parseInt(stockMatch[1], 10)
      }
      
      // 画像URL
      const imgEl = document.querySelector('img[src*="product"]') || document.querySelector('img')
      const imageUrl = imgEl?.getAttribute('src') || ''
      
      return { name, price, stock, imageUrl }
    })
    
    await browser.close()
    
    return {
      success: true,
      source: 'snkrdunk',
      url,
      ...data
    }
  } catch (error: any) {
    if (browser) await browser.close()
    throw error
  }
}

// トレカキャンプから価格と在庫を取得
async function scrapeTorecaCamp(url: string) {
  let browser = null
  
  try {
    browser = await connectBrowser()
    const page = await browser.newPage()
    
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7'
    })
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(3000)
    
    // ページ内容を取得
    const data = await page.evaluate(() => {
      // 商品名
      const nameEl = document.querySelector('h1') || document.querySelector('[class*="product-title"]')
      const name = nameEl?.textContent?.trim() || ''
      
      // 価格と在庫情報を格納
      const conditions: { condition: string; price: number | null; stock: number | null }[] = []
      
      // 状態ごとの価格を探す
      const rows = document.querySelectorAll('tr, [class*="variant"], [class*="option"]')
      
      rows.forEach(row => {
        const text = row.textContent || ''
        
        // 状態を判定
        let condition = ''
        if (text.includes('新品')) condition = '新品'
        else if (text.includes('状態A-')) condition = '状態A-'
        else if (text.includes('状態A')) condition = '状態A'
        else if (text.includes('状態B')) condition = '状態B'
        
        if (condition) {
          // 価格を抽出
          const priceMatch = text.match(/[¥￥]?\s*([\d,]+)\s*円?/)
          const price = priceMatch ? parseInt(priceMatch[1].replace(/,/g, ''), 10) : null
          
          // 在庫数を抽出
          const stockMatch = text.match(/在庫[：:\s]*(\d+)/) || text.match(/(\d+)\s*点/)
          const stock = stockMatch ? parseInt(stockMatch[1], 10) : null
          
          conditions.push({ condition, price, stock })
        }
      })
      
      // 行で見つからない場合、全体から探す
      if (conditions.length === 0) {
        const bodyText = document.body.innerText
        
        // 新品の価格
        const newMatch = bodyText.match(/新品[^\d]*[¥￥]?\s*([\d,]+)/)
        if (newMatch) {
          conditions.push({ 
            condition: '新品', 
            price: parseInt(newMatch[1].replace(/,/g, ''), 10),
            stock: null 
          })
        }
        
        // 状態Aの価格
        const aMatch = bodyText.match(/状態A[^-][^\d]*[¥￥]?\s*([\d,]+)/)
        if (aMatch) {
          conditions.push({ 
            condition: '状態A', 
            price: parseInt(aMatch[1].replace(/,/g, ''), 10),
            stock: null 
          })
        }
        
        // 状態A-の価格
        const aMinusMatch = bodyText.match(/状態A-[^\d]*[¥￥]?\s*([\d,]+)/)
        if (aMinusMatch) {
          conditions.push({ 
            condition: '状態A-', 
            price: parseInt(aMinusMatch[1].replace(/,/g, ''), 10),
            stock: null 
          })
        }
      }
      
      // 画像URL
      const imgEl = document.querySelector('img[src*="cdn.shopify"]') || document.querySelector('img')
      const imageUrl = imgEl?.getAttribute('src') || ''
      
      // 単一価格（メイン価格）
      let mainPrice = null
      const mainPriceEl = document.querySelector('[class*="price"]')
      if (mainPriceEl) {
        const match = mainPriceEl.textContent?.match(/[¥￥]?\s*([\d,]+)/)
        if (match) {
          mainPrice = parseInt(match[1].replace(/,/g, ''), 10)
        }
      }
      
      // 在庫数
      let stock = null
      const stockMatch = document.body.innerText.match(/在庫[：:\s]*(\d+)/) ||
                         document.body.innerText.match(/残り\s*(\d+)/)
      if (stockMatch) {
        stock = parseInt(stockMatch[1], 10)
      }
      
      return { name, mainPrice, stock, conditions, imageUrl }
    })
    
    await browser.close()
    
    return {
      success: true,
      source: 'torecacamp',
      url,
      ...data
    }
  } catch (error: any) {
    if (browser) await browser.close()
    throw error
  }
}

// カードラッシュから価格と在庫を取得
async function scrapeCardRush(url: string) {
  let browser = null
  
  try {
    browser = await connectBrowser()
    const page = await browser.newPage()
    
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7'
    })
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(3000)
    
    const data = await page.evaluate(() => {
      const nameEl = document.querySelector('h1') || document.querySelector('.product-name')
      const name = nameEl?.textContent?.trim() || ''
      
      let price = null
      const priceEl = document.querySelector('.price') || document.querySelector('[class*="price"]')
      if (priceEl) {
        const match = priceEl.textContent?.match(/[¥￥]?\s*([\d,]+)/)
        if (match) {
          price = parseInt(match[1].replace(/,/g, ''), 10)
        }
      }
      
      let stock = null
      const stockMatch = document.body.innerText.match(/在庫[：:\s]*(\d+)/)
      if (stockMatch) {
        stock = parseInt(stockMatch[1], 10)
      }
      
      const imgEl = document.querySelector('img[src*="product"]') || document.querySelector('img')
      const imageUrl = imgEl?.getAttribute('src') || ''
      
      return { name, price, stock, imageUrl }
    })
    
    await browser.close()
    
    return {
      success: true,
      source: 'cardrush',
      url,
      ...data
    }
  } catch (error: any) {
    if (browser) await browser.close()
    throw error
  }
}

export async function POST(request: NextRequest) {
  const { url, source } = await request.json()
  
  if (!url) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }
  
  try {
    let result
    
    // URLからソースを自動判定
    const detectedSource = source || (
      url.includes('snkrdunk.com') ? 'snkrdunk' :
      url.includes('torecacamp') ? 'torecacamp' :
      url.includes('cardrush') ? 'cardrush' :
      null
    )
    
    switch (detectedSource) {
      case 'snkrdunk':
        result = await scrapeSnkrdunk(url)
        break
      case 'torecacamp':
        result = await scrapeTorecaCamp(url)
        break
      case 'cardrush':
        result = await scrapeCardRush(url)
        break
      default:
        return NextResponse.json({ error: 'Unknown source. Supported: snkrdunk, torecacamp, cardrush' }, { status: 400 })
    }
    
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Scrape error:', error)
    return NextResponse.json(
      { error: error.message || 'Scrape failed' },
      { status: 500 }
    )
  }
}

// GETでテスト用
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')
  
  if (!url) {
    return NextResponse.json({ 
      message: 'Price scraping API (Browserless.io)',
      usage: 'POST with { url: "https://..." } or GET with ?url=https://...',
      supported: ['snkrdunk.com', 'torecacamp-pokemon.com', 'cardrush.jp'],
      browserless: process.env.BROWSERLESS_TOKEN ? 'configured' : 'not configured'
    })
  }
  
  // POSTと同じ処理
  const body = { url }
  const mockRequest = {
    json: async () => body
  } as NextRequest
  
  return POST(mockRequest)
}
