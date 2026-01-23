import { NextRequest, NextResponse } from 'next/server'
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const page = searchParams.get('page') || '1'
  const checkDuplicates = searchParams.get('checkDuplicates') === 'true'
  const customUrl = searchParams.get('url')
  
  let browser = null
  
  try {
    console.log('Scraping Pokemon Card official site, page:', page)
    
    browser = await chromium.launch({ headless: true })
    const browserPage = await browser.newPage()
    
    // URLを決定
    let url: string
    if (customUrl) {
      const urlObj = new URL(customUrl)
      urlObj.searchParams.set('page', page)
      url = urlObj.toString()
    } else {
      url = `https://www.pokemon-card.com/card-search/index.php?keyword=&se_ta=&regulation_sidebar_form=XY&pg=&illust=&sm_and_keyword=true&page=${page}`
    }
    
    await browserPage.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await browserPage.waitForTimeout(2000)
    
    // スクロールして遅延読み込みを発火
    await browserPage.setViewportSize({ width: 1920, height: 10000 })
    
    for (let i = 0; i < 10; i++) {
      await browserPage.evaluate((scrollY) => {
        window.scrollTo(0, scrollY)
      }, i * 1000)
      await browserPage.waitForTimeout(300)
    }
    
    await browserPage.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight)
    })
    await browserPage.waitForTimeout(1000)
    
    // data-src を src にコピー
    await browserPage.evaluate(() => {
      document.querySelectorAll('img[data-src]').forEach(img => {
        const dataSrc = img.getAttribute('data-src')
        if (dataSrc) {
          img.setAttribute('src', dataSrc)
        }
      })
    })
    
    await browserPage.waitForTimeout(1000)
    
    // カード情報を取得
    const cards = await browserPage.evaluate(() => {
      const results: any[] = []
      const baseUrl = 'https://www.pokemon-card.com'
      const seen = new Set<string>()
      
      document.querySelectorAll('img').forEach(img => {
        let src = img.getAttribute('src') || ''
        const dataSrc = img.getAttribute('data-src')
        
        if (dataSrc && dataSrc.includes('/assets/images/card_images/')) {
          src = dataSrc
        }
        
        const alt = img.getAttribute('alt') || ''
        
        if (!src.includes('/assets/images/card_images/')) return
        if (!alt || alt.includes('ポケモンカードゲーム')) return
        
        const fullUrl = src.startsWith('http') ? src : baseUrl + src
        
        // 画像URLで重複チェック（名前ではなく）
        if (seen.has(fullUrl)) return
        seen.add(fullUrl)
        
        // カード番号を画像URLから抽出
        const pathMatch = src.match(/\/([^\/]+)\.(?:jpg|png|webp)/i)
        const cardId = pathMatch ? pathMatch[1] : null
        
        results.push({
          name: alt,
          imageUrl: fullUrl,
          cardId,
        })
      })
      
      return results
    })
    
    // 総件数を取得
    const total = await browserPage.evaluate(() => {
      const text = document.body.innerText
      const match = text.match(/(\d+)\s*件/)
      return match ? parseInt(match[1]) : 0
    })
    
    await browser.close()
    browser = null
    
    console.log(`Found ${cards.length} cards on page ${page}`)
    
    // 重複チェック（画像URLで判定）
    let cardsWithStatus = cards
    if (checkDuplicates && cards.length > 0) {
      const imageUrls = cards.map((c: any) => c.imageUrl)
      const { data: existingCards } = await supabase
        .from('cards')
        .select('image_url')
        .in('image_url', imageUrls)
      
      const existingUrls = new Set(existingCards?.map(c => c.image_url) || [])
      
      cardsWithStatus = cards.map((card: any) => ({
        ...card,
        exists: existingUrls.has(card.imageUrl),
      }))
    }
    
    return NextResponse.json({
      success: true,
      page: parseInt(page),
      total,
      totalPages: Math.ceil(total / 39),
      cards: cardsWithStatus,
      count: cards.length,
      url,
    })
  } catch (error: any) {
    console.error('Scrape error:', error)
    if (browser) await browser.close()
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// カードを一括でDBに保存（重複は画像URLでチェック）
export async function POST(request: NextRequest) {
  const { cards, skipExisting } = await request.json()
  
  if (!cards || !Array.isArray(cards)) {
    return NextResponse.json({ error: 'cards array is required' }, { status: 400 })
  }
  
  try {
    // ポケモンカードのカテゴリIDを取得
    const { data: category } = await supabase
      .from('category_large')
      .select('id')
      .eq('name', 'ポケモンカード')
      .single()
    
    let newCount = 0
    let updateCount = 0
    let skipCount = 0
    
    for (const card of cards) {
      // 画像URLで既存カードをチェック（名前ではなく画像URLで判定）
      const { data: existingList } = await supabase
        .from('cards')
        .select('id, image_url')
        .eq('image_url', card.imageUrl)
      
      const existing = existingList?.[0]
      
      if (existing) {
        if (skipExisting) {
          skipCount++
        } else {
          // 既に同じ画像URLが存在する場合は更新
          await supabase
            .from('cards')
            .update({ name: card.name })
            .eq('id', existing.id)
          updateCount++
        }
      } else {
        // 新規登録（同じ名前でも画像URLが違えば登録）
        await supabase
          .from('cards')
          .insert([{
            name: card.name,
            image_url: card.imageUrl,
            card_number: card.cardNumber || null,
            category_large_id: category?.id || null,
          }])
        newCount++
      }
    }
    
    return NextResponse.json({
      success: true,
      newCount,
      updateCount,
      skipCount,
      total: cards.length,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
