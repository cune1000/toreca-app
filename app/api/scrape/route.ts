import { NextRequest, NextResponse } from 'next/server'
import { chromium } from 'playwright'

// スニダンから価格を取得
async function scrapeSnkrdunk(url: string) {
  let browser = null
  
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    
    // User-Agentを設定
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
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
      
      // スニダンの価格セレクタ
      const priceSelectors = [
        '[class*="Price"]',
        '[class*="price"]',
        '[data-testid*="price"]',
        '.product-price',
        '[class*="amount"]',
      ]
      
      for (const selector of priceSelectors) {
        try {
          const els = document.querySelectorAll(selector)
          els.forEach(el => {
            if (price) return
            const text = el.textContent || ''
            const match = text.match(/[¥￥]?\s*([\d,]+)/)
            if (match && parseInt(match[1].replace(/,/g, '')) > 100) {
              price = parseInt(match[1].replace(/,/g, ''), 10)
            }
          })
        } catch {}
      }
      
      // 全テキストから価格を探す
      if (!price) {
        const bodyText = document.body.innerText
        const priceMatches = bodyText.match(/[¥￥]\s*([\d,]+)/g)
        if (priceMatches && priceMatches.length > 0) {
          // 妥当な価格（100円以上）を探す
          for (const priceMatch of priceMatches) {
            const match = priceMatch.match(/[\d,]+/)
            if (match) {
              const val = parseInt(match[0].replace(/,/g, ''), 10)
              if (val > 100) {
                price = val
                break
              }
            }
          }
        }
      }
      
      // 在庫数を探す
      let stock = null
      const bodyText = document.body.innerText
      
      // 「○点」「在庫○」「○個」などのパターン
      const stockPatterns = [
        /在庫[：:\s]*(\d+)/,
        /(\d+)\s*点/,
        /(\d+)\s*個/,
        /残り\s*(\d+)/,
        /(\d+)\s*枚/,
      ]
      
      for (const pattern of stockPatterns) {
        const match = bodyText.match(pattern)
        if (match) {
          stock = parseInt(match[1], 10)
          break
        }
      }
      
      // 在庫あり/なしのチェック
      if (stock === null) {
        if (bodyText.includes('売り切れ') || bodyText.includes('SOLD OUT') || bodyText.includes('在庫なし')) {
          stock = 0
        } else if (bodyText.includes('在庫あり') || bodyText.includes('購入可能')) {
          stock = 1
        }
      }
      
      // 画像URL
      const imgEl = document.querySelector('img[src*="product"]') || document.querySelector('img[src*="cdn"]')
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

// カードラッシュから価格を取得
async function scrapeCardrush(url: string) {
  let browser = null
  
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })
    
    await page.goto(url, { waitUntil: 'load', timeout: 30000 })
    await page.waitForTimeout(3000)
    
    const data = await page.evaluate(() => {
      // 商品名
      const nameEl = document.querySelector('h1') || document.querySelector('.product-name')
      const name = nameEl?.textContent?.trim() || ''
      
      // 価格を探す
      let price = null
      const priceSelectors = [
        '.price',
        '[class*="price"]',
        '.selling-price',
        '[class*="Price"]',
      ]
      
      for (const selector of priceSelectors) {
        try {
          const el = document.querySelector(selector)
          if (el) {
            const text = el.textContent || ''
            const match = text.match(/[¥￥]?\s*([\d,]+)/)
            if (match && parseInt(match[1].replace(/,/g, '')) > 100) {
              price = parseInt(match[1].replace(/,/g, ''), 10)
              break
            }
          }
        } catch {}
      }
      
      // テキストから探す
      if (!price) {
        const bodyText = document.body.innerText
        const priceMatch = bodyText.match(/[¥￥]\s*([\d,]+)/)
        if (priceMatch) {
          price = parseInt(priceMatch[1].replace(/,/g, ''), 10)
        }
      }
      
      // 在庫
      const stockEl = document.querySelector('[class*="stock"]')
      const stock = stockEl?.textContent?.trim() || null
      
      return { name, price, stock }
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

// トレカキャンプから価格と在庫を取得
async function scrapeTorecaCamp(url: string) {
  let browser = null
  
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await page.waitForTimeout(2000)
    
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
      
      // 単一価格（メイン価格）
      let mainPrice = null
      const mainPriceEl = document.querySelector('[class*="price"]')
      if (mainPriceEl) {
        const match = mainPriceEl.textContent?.match(/[¥￥]?\s*([\d,]+)/)
        if (match) {
          mainPrice = parseInt(match[1].replace(/,/g, ''), 10)
        }
      }
      
      // メイン在庫数を探す
      let mainStock = null
      const bodyText = document.body.innerText
      
      // 在庫パターンを探す
      const stockPatterns = [
        /在庫[：:\s]*(\d+)/,
        /(\d+)\s*点/,
        /(\d+)\s*個/,
        /残り\s*(\d+)/,
        /(\d+)\s*枚/,
      ]
      
      for (const pattern of stockPatterns) {
        const match = bodyText.match(pattern)
        if (match) {
          mainStock = parseInt(match[1], 10)
          break
        }
      }
      
      // conditionsから最初の在庫を取得
      if (mainStock === null && conditions.length > 0 && conditions[0].stock !== null) {
        mainStock = conditions[0].stock
      }
      
      // 在庫あり/なしのチェック
      if (mainStock === null) {
        if (bodyText.includes('売り切れ') || bodyText.includes('SOLD OUT') || bodyText.includes('在庫なし') || bodyText.includes('sold out')) {
          mainStock = 0
        } else if (bodyText.includes('在庫あり') || bodyText.includes('カートに入れる')) {
          mainStock = 1
        }
      }
      
      // 画像URL
      const imgEl = document.querySelector('img[src*="cdn.shopify"]') || document.querySelector('img')
      const imageUrl = imgEl?.getAttribute('src') || ''
      
      return { name, price: mainPrice, stock: mainStock, conditions, imageUrl }
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

// 汎用スクレイピング
async function scrapeGeneric(url: string) {
  let browser = null
  
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })
    
    await page.goto(url, { waitUntil: 'load', timeout: 30000 })
    await page.waitForTimeout(3000)
    
    const data = await page.evaluate(() => {
      // 価格っぽい要素を探す
      const priceSelectors = ['.price', '[class*="price"]', '[class*="Price"]', '.cost', '[class*="cost"]']
      let price = null
      
      for (const selector of priceSelectors) {
        const el = document.querySelector(selector)
        if (el) {
          const text = el.textContent || ''
          const match = text.match(/[¥￥]?\s*([\d,]+)/)
          if (match && parseInt(match[1].replace(/,/g, '')) > 100) {
            price = parseInt(match[1].replace(/,/g, ''), 10)
            break
          }
        }
      }

      // 価格が見つからなければテキストから探す
      if (!price) {
        const bodyText = document.body.innerText
        const priceMatch = bodyText.match(/[¥￥]\s*([\d,]+)/)
        if (priceMatch) {
          price = parseInt(priceMatch[1].replace(/,/g, ''), 10)
        }
      }

      // 在庫数を探す
      let stock = null
      const bodyText = document.body.innerText
      
      const stockPatterns = [
        /在庫[：:\s]*(\d+)/,
        /(\d+)\s*点/,
        /(\d+)\s*個/,
        /残り\s*(\d+)/,
        /(\d+)\s*枚/,
      ]
      
      for (const pattern of stockPatterns) {
        const match = bodyText.match(pattern)
        if (match) {
          stock = parseInt(match[1], 10)
          break
        }
      }
      
      if (stock === null) {
        if (bodyText.includes('売り切れ') || bodyText.includes('SOLD OUT') || bodyText.includes('在庫なし')) {
          stock = 0
        } else if (bodyText.includes('在庫あり') || bodyText.includes('カートに入れる')) {
          stock = 1
        }
      }

      const nameEl = document.querySelector('h1')
      const name = nameEl?.textContent?.trim() || ''
      
      return { name, price, stock }
    })
    
    await browser.close()
    
    return {
      success: true,
      source: 'generic',
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
  
  console.log('Scraping:', url, 'source:', source)
  
  try {
    let result
    
    // URLからソースを自動判定
    const detectedSource = source || (
      url.includes('snkrdunk.com') ? 'snkrdunk' :
      url.includes('cardrush') ? 'cardrush' :
      url.includes('torecacamp') ? 'torecacamp' :
      'generic'
    )
    
    console.log('Detected source:', detectedSource)
    
    switch (detectedSource) {
      case 'snkrdunk':
        result = await scrapeSnkrdunk(url)
        break
      case 'cardrush':
        result = await scrapeCardrush(url)
        break
      case 'torecacamp':
        result = await scrapeTorecaCamp(url)
        break
      default:
        result = await scrapeGeneric(url)
    }
    
    console.log('Scrape result:', result)
    
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
      message: 'Price scraping API',
      usage: 'POST with { url: "https://...", source?: "snkrdunk" | "cardrush" | "torecacamp" }',
      supported: ['snkrdunk.com', 'cardrush', 'torecacamp-pokemon.com', 'その他（汎用）']
    })
  }
  
  // POSTと同じ処理
  const body = { url }
  const mockRequest = {
    json: async () => body
  } as NextRequest
  
  return POST(mockRequest)
}
