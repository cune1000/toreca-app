import { NextRequest, NextResponse } from 'next/server'
import { chromium } from 'playwright'

export async function POST(request: NextRequest) {
  let browser = null
  
  try {
    const { url, site } = await request.json()
    
    if (!url) {
      return NextResponse.json({ error: 'URLが必要です' }, { status: 400 })
    }

    console.log('Scraping:', url)

    // ブラウザを起動
    browser = await chromium.launch({
      headless: true,
    })
    
    const page = await browser.newPage()
    
    // ユーザーエージェントを設定
    await page.setExtraHTTPHeaders({
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    })

    // domcontentloadedに変更（より早く完了する）
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 })
    
    // 少し待ってJSが実行されるのを待つ
    await page.waitForTimeout(2000)

    let result = null

    // サイト別のスクレイピング処理
    if (site === 'cardrush' || url.includes('cardrush')) {
      // カードラッシュ
      result = await page.evaluate(() => {
        const priceEl = document.querySelector('.price') || 
                        document.querySelector('[class*="price"]') ||
                        document.querySelector('.selling-price')
        const nameEl = document.querySelector('h1') || 
                       document.querySelector('.product-name') ||
                       document.querySelector('[class*="product-title"]')
        const stockEl = document.querySelector('[class*="stock"]')
        
        // ページ全体のテキストから価格を探す
        let priceText = priceEl?.textContent?.trim() || null
        if (!priceText) {
          const bodyText = document.body.innerText
          const priceMatch = bodyText.match(/[¥￥][\d,]+/)
          if (priceMatch) {
            priceText = priceMatch[0]
          }
        }
        
        return {
          name: nameEl?.textContent?.trim() || null,
          price: priceText,
          stock: stockEl?.textContent?.trim() || null,
          pageTitle: document.title,
        }
      })
    } else if (site === 'snkrdunk' || url.includes('snkrdunk')) {
      // スニーカーダンク
      result = await page.evaluate(() => {
        const priceEl = document.querySelector('[class*="Price"]') || document.querySelector('[class*="price"]')
        const nameEl = document.querySelector('h1')
        
        return {
          name: nameEl?.textContent?.trim() || null,
          price: priceEl?.textContent?.trim() || null,
          pageTitle: document.title,
        }
      })
    } else {
      // 汎用スクレイピング
      result = await page.evaluate(() => {
        // 価格っぽい要素を探す
        const priceSelectors = ['.price', '[class*="price"]', '[class*="Price"]', '.cost', '[class*="cost"]']
        let price = null
        for (const selector of priceSelectors) {
          const el = document.querySelector(selector)
          if (el) {
            price = el.textContent?.trim()
            break
          }
        }

        // 価格が見つからなければテキストから探す
        if (!price) {
          const bodyText = document.body.innerText
          const priceMatch = bodyText.match(/[¥￥][\d,]+/)
          if (priceMatch) {
            price = priceMatch[0]
          }
        }

        const nameEl = document.querySelector('h1')
        
        return {
          name: nameEl?.textContent?.trim() || null,
          price: price,
          pageTitle: document.title,
        }
      })
    }

    // 価格を数値に変換
    if (result?.price) {
      const priceMatch = result.price.match(/[\d,]+/)
      if (priceMatch) {
        result.priceNumber = parseInt(priceMatch[0].replace(/,/g, ''), 10)
      }
    }

    await browser.close()
    browser = null

    return NextResponse.json({
      success: true,
      url,
      ...result,
      scrapedAt: new Date().toISOString(),
    })
  } catch (error: any) {
    console.error('Scrape error:', error)
    if (browser) {
      await browser.close()
    }
    return NextResponse.json(
      { error: error.message || 'スクレイピングに失敗しました' },
      { status: 500 }
    )
  }
}
