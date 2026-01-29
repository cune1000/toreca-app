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

// カードリストページからカード一覧を取得（offset対応）
async function scrapeCardList(listUrl: string, limit: number = 20, offset: number = 0) {
  let browser = null
  
  try {
    browser = await chromium.launch({ headless: true })
    const page = await browser.newPage()
    
    // offsetをページ番号に変換（公式サイトは1ページ20件）
    const pageNum = Math.floor(offset / 20) + 1
    
    // URLにページ番号を追加
    let urlWithPage = listUrl
    if (pageNum > 1) {
      // 既存のページパラメータを削除
      urlWithPage = listUrl.replace(/&pg=\d+/, '').replace(/\?pg=\d+&?/, '?')
      // 新しいページ番号を追加
      urlWithPage += (urlWithPage.includes('?') ? '&' : '?') + `pg=${pageNum}`
    }
    
    console.log(`[Scrape] Fetching page ${pageNum}: ${urlWithPage}`)
    
    await page.goto(urlWithPage, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForTimeout(3000)
    
    // 総件数とカードリンクを取得
    const result = await page.evaluate(() => {
      // 総件数を取得
      let totalFound = 0
      const totalText = document.body.innerText
      const totalMatch = totalText.match(/(\d+)件/)
      if (totalMatch) {
        totalFound = parseInt(totalMatch[1], 10)
      }
      
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
      
      return { totalFound, links }
    })
    
    await browser.close()
    
    // limitに応じてカードを返す
    const cards = result.links.slice(0, limit)
    
    return {
      success: true,
      totalFound: result.totalFound,
      page: pageNum,
      cards: cards
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
  const offset = parseInt(searchParams.get('offset') || '0')
  
  if (!url) {
    return NextResponse.json({
      message: 'Pokemon Card Scrape API',
      usage: {
        single: 'GET ?url=https://www.pokemon-card.com/card-search/details.php/card/12345',
        list: 'GET ?url=https://www.pokemon-card.com/card-search/index.php?...&limit=20&offset=0'
      }
    })
  }
  
  try {
    // URLの種類を判定
    const isListPage = url.includes('index.php') || url.includes('card-search/?')
    
    if (isListPage) {
      const result = await scrapeCardList(url, limit, offset)
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
  const { url, limit = 20, offset = 0, skipExisting = true } = await request.json()
  
  if (!url) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }
  
  try {
    // リストページからカード一覧を取得（offset対応）
    const listResult = await scrapeCardList(url, limit, offset)
    
    if (!listResult.success) {
      return NextResponse.json(listResult, { status: 500 })
    }
    
    // ポケモンカードのカテゴリIDを取得
    const { data: category } = await supabase
      .from('category_large')
      .select('id')
      .eq('name', 'ポケモンカード')
      .single()
    
    let newCount = 0
    let updateCount = 0
    let skipCount = 0
    let errorCount = 0
    const errors: string[] = []
    
    for (const card of listResult.cards) {
      try {
        if (!card.imageUrl) {
          errorCount++
          continue
        }
        
        // 既存チェック（画像URLで判定）
        const { data: existingList } = await supabase
          .from('cards')
          .select('id')
          .eq('image_url', card.imageUrl)
        
        const existing = existingList?.[0]
        
        if (existing) {
          if (skipExisting) {
            skipCount++
          } else {
            // 詳細ページをスクレイピングして更新
            try {
              const detail = await scrapePokemonCard(card.url)
              await supabase
                .from('cards')
                .update({
                  name: detail.name || card.name,
                  card_number: detail.cardNumber,
                  rarity: detail.rarity,
                  illustrator: detail.illustrator,
                  expansion: detail.expansion,
                  regulation: detail.regulation
                })
                .eq('id', existing.id)
              updateCount++
            } catch (err) {
              skipCount++
            }
          }
        } else {
          // 詳細ページをスクレイピング
          try {
            const detail = await scrapePokemonCard(card.url)
            
            // DBに保存
            await supabase
              .from('cards')
              .insert([{
                name: detail.name || card.name,
                image_url: detail.imageUrl || card.imageUrl,
                card_number: detail.cardNumber,
                rarity: detail.rarity,
                illustrator: detail.illustrator,
                expansion: detail.expansion,
                regulation: detail.regulation,
                category_large_id: category?.id || null
              }])
            newCount++
          } catch (err: any) {
            // 詳細取得失敗でもリストの情報で保存
            await supabase
              .from('cards')
              .insert([{
                name: card.name,
                image_url: card.imageUrl,
                category_large_id: category?.id || null
              }])
            newCount++
          }
        }
        
        // レート制限対策
        await new Promise(resolve => setTimeout(resolve, 1500))
        
      } catch (err: any) {
        errorCount++
        errors.push(`${card.name}: ${err.message}`)
      }
    }
    
    return NextResponse.json({
      success: true,
      totalFound: listResult.totalFound,
      processed: listResult.cards.length,
      newCount,
      updateCount,
      skipCount,
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
