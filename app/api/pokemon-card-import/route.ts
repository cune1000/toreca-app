import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { chromium } from 'playwright'

// ポケモンカード公式サイトからカード情報をスクレイピング
async function scrapePokemonCard(url: string) {
  let browser = null
  
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForTimeout(2000)
    
    // カード情報を取得
    const cardData = await page.evaluate(() => {
      // カード名
      const nameEl = document.querySelector('.card-name') || document.querySelector('h1')
      const name = nameEl?.textContent?.trim() || ''
      
      // カード画像
      const imgEl = document.querySelector('.card-img img') || document.querySelector('img[src*="card"]')
      const imageUrl = imgEl?.getAttribute('src') || ''
      
      // カード番号
      const numberEl = document.querySelector('.card-number')
      const cardNumber = numberEl?.textContent?.trim() || ''
      
      // レアリティ
      const rarityEl = document.querySelector('.rarity')
      const rarity = rarityEl?.textContent?.trim() || ''
      
      // イラストレーター
      const illustratorEl = document.querySelector('.illustrator')
      const illustrator = illustratorEl?.textContent?.replace('イラスト：', '').trim() || ''
      
      // エキスパンション
      const expansionEl = document.querySelector('.expansion')
      const expansion = expansionEl?.textContent?.trim() || ''
      
      // レギュレーション
      const regulationEl = document.querySelector('.regulation')
      const regulation = regulationEl?.textContent?.trim() || ''
      
      return {
        name,
        imageUrl,
        cardNumber,
        rarity,
        illustrator,
        expansion,
        regulation
      }
    })
    
    await browser.close()
    
    return {
      success: true,
      url,
      ...cardData
    }
    
  } catch (error: any) {
    if (browser) await browser.close()
    throw error
  }
}

// カードリストページからカード一覧を取得
async function scrapeCardList(listUrl: string, limit: number = 20) {
  let browser = null
  
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    
    await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForTimeout(3000)
    
    // カードリンクを取得
    const cardLinks = await page.evaluate(() => {
      const links: { name: string; url: string; imageUrl: string }[] = []
      
      // カードリストのリンクを取得
      const cardElements = document.querySelectorAll('.card-list a, .card-item a, a[href*="/card-search/details"]')
      
      cardElements.forEach(el => {
        const href = el.getAttribute('href')
        const img = el.querySelector('img')
        const nameEl = el.querySelector('.card-name') || el.querySelector('.name')
        
        if (href) {
          let fullUrl = href
          if (!href.startsWith('http')) {
            fullUrl = 'https://www.pokemon-card.com' + href
          }
          
          links.push({
            name: nameEl?.textContent?.trim() || '',
            url: fullUrl,
            imageUrl: img?.getAttribute('src') || ''
          })
        }
      })
      
      return links
    })
    
    await browser.close()
    
    return {
      success: true,
      totalFound: cardLinks.length,
      cards: cardLinks.slice(0, limit)
    }
    
  } catch (error: any) {
    if (browser) await browser.close()
    throw error
  }
}

// GET: カードリストまたは単体カード情報を取得
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')
  const limit = parseInt(searchParams.get('limit') || '20')
  
  if (!url) {
    return NextResponse.json({
      message: 'Pokemon Card Scrape API',
      usage: {
        single: 'GET ?url=https://www.pokemon-card.com/card-search/details.php/card/12345',
        list: 'GET ?url=https://www.pokemon-card.com/card-search/index.php?...&limit=20'
      }
    })
  }
  
  try {
    // URLの種類を判定
    const isListPage = url.includes('index.php') || url.includes('card-search/?')
    
    if (isListPage) {
      const result = await scrapeCardList(url, limit)
      return NextResponse.json(result)
    } else {
      const result = await scrapePokemonCard(url)
      return NextResponse.json(result)
    }
    
  } catch (error: any) {
    console.error('Scrape error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// POST: スクレイピングしてDBに保存
export async function POST(request: NextRequest) {
  const { url, limit = 20, saveToDb = true } = await request.json()
  
  if (!url) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }
  
  try {
    // リストページからカード一覧を取得
    const listResult = await scrapeCardList(url, limit)
    
    if (!listResult.success) {
      return NextResponse.json(listResult, { status: 500 })
    }
    
    if (!saveToDb) {
      return NextResponse.json(listResult)
    }
    
    // 各カードの詳細を取得してDBに保存
    let savedCount = 0
    let errorCount = 0
    const errors: string[] = []
    
    // ポケモンカードのカテゴリIDを取得
    const { data: category } = await supabase
      .from('category_large')
      .select('id')
      .eq('name', 'ポケモンカード')
      .single()
    
    for (const card of listResult.cards) {
      try {
        // 既存チェック
        const { data: existing } = await supabase
          .from('cards')
          .select('id')
          .eq('image_url', card.imageUrl)
          .single()
        
        if (existing) {
          continue // 既に存在する場合はスキップ
        }
        
        // 詳細ページをスクレイピング
        const detail = await scrapePokemonCard(card.url)
        
        if (!detail.success) {
          errorCount++
          errors.push(`${card.name}: Scrape failed`)
          continue
        }
        
        // DBに保存
        await supabase
          .from('cards')
          .insert({
            name: detail.name || card.name,
            image_url: detail.imageUrl || card.imageUrl,
            card_number: detail.cardNumber,
            rarity: detail.rarity,
            illustrator: detail.illustrator,
            expansion: detail.expansion,
            regulation: detail.regulation,
            category_large_id: category?.id || null
          })
        
        savedCount++
        
        // レート制限対策
        await new Promise(resolve => setTimeout(resolve, 2000))
        
      } catch (err: any) {
        errorCount++
        errors.push(`${card.name}: ${err.message}`)
      }
    }
    
    return NextResponse.json({
      success: true,
      totalFound: listResult.totalFound,
      processed: listResult.cards.length,
      savedCount,
      errorCount,
      errors: errors.slice(0, 10)
    })
    
  } catch (error: any) {
    console.error('Scrape error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
