import { NextRequest, NextResponse } from 'next/server'
import { chromium } from 'playwright'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Browserless.io接続
async function connectBrowser() {
  const token = process.env.BROWSERLESS_TOKEN
  
  if (token) {
    return await chromium.connect({
      wsEndpoint: `wss://production-sfo.browserless.io/chromium/playwright?token=${token}`
    })
  } else {
    return await chromium.launch({ headless: true })
  }
}

// レアリティマッピング
const RARITY_MAP: { [key: string]: string } = {
  'ic_rare_sar.gif': 'SAR',
  'ic_rare_sr.gif': 'SR',
  'ic_rare_ar.gif': 'AR',
  'ic_rare_ur.gif': 'UR',
  'ic_rare_rr.gif': 'RR',
  'ic_rare_r.gif': 'R',
  'ic_rare_u.gif': 'U',
  'ic_rare_c.gif': 'C',
  'ic_rare_tr.gif': 'TR',
  'ic_rare_hr.gif': 'HR',
  'ic_rare_pr.gif': 'PR',
  'ic_rare_csr.gif': 'CSR',
  'ic_rare_chr.gif': 'CHR',
  'ic_rare_s.gif': 'S',
  'ic_rare_a.gif': 'A',
  'ic_rare_h.gif': 'H',
  'ic_rare_k.gif': 'K',
  'ic_rare_ssr.gif': 'SSR',
  'ic_rare_im.gif': 'IM',
}

// 一覧ページからカード詳細URLを取得
async function getCardLinksFromList(page: any, listUrl: string): Promise<string[]> {
  console.log('Loading list page:', listUrl)
  
  await page.goto(listUrl, { waitUntil: 'domcontentloaded', timeout: 60000 })
  
  // 絞り込みが適用されるまで長めに待機
  console.log('Waiting for filters to apply...')
  await page.waitForTimeout(5000)
  
  // スクロールして遅延読み込みを発火
  for (let i = 0; i < 10; i++) {
    await page.evaluate((scrollY: number) => {
      window.scrollTo(0, scrollY)
    }, i * 1000)
    await page.waitForTimeout(500)
  }
  
  // 最下部までスクロール
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight)
  })
  await page.waitForTimeout(2000)
  
  // カードリンクを取得
  const links = await page.evaluate(() => {
    const baseUrl = 'https://www.pokemon-card.com'
    const cardLinks: string[] = []
    
    // カード画像のリンクを取得
    document.querySelectorAll('a[href*="/card-search/details.php"]').forEach(a => {
      const href = a.getAttribute('href')
      if (href) {
        const fullUrl = href.startsWith('http') ? href : baseUrl + href
        if (!cardLinks.includes(fullUrl)) {
          cardLinks.push(fullUrl)
        }
      }
    })
    
    return cardLinks
  })
  
  console.log(`Found ${links.length} card links`)
  return links
}

// 詳細ページからカード情報を取得
async function getCardDetails(page: any, detailUrl: string): Promise<any> {
  console.log('Loading detail page:', detailUrl)
  
  await page.goto(detailUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
  await page.waitForTimeout(2000)
  
  const cardData = await page.evaluate(() => {
    const baseUrl = 'https://www.pokemon-card.com'
    
    // カード名
    const name = document.querySelector('h1')?.textContent?.trim() || ''
    
    // 画像URL
    let imageUrl = ''
    const imgEl = document.querySelector('img[src*="/card_images/"]')
    if (imgEl) {
      const src = imgEl.getAttribute('src') || ''
      imageUrl = src.startsWith('http') ? src : baseUrl + src
    }
    
    // カード番号（例: "233 / 193"）
    let cardNumber = ''
    const bodyText = document.body.innerText
    const numberMatch = bodyText.match(/(\d+)\s*\/\s*(\d+)/)
    if (numberMatch) {
      cardNumber = `${numberMatch[1]}/${numberMatch[2]}`
    }
    
    // レアリティ（画像ファイル名から判定）
    let rarityIcon = ''
    const rarityImg = document.querySelector('img[src*="/rarity/"]')
    if (rarityImg) {
      const src = rarityImg.getAttribute('src') || ''
      const match = src.match(/ic_rare_\w+\.gif/)
      if (match) {
        rarityIcon = match[0]
      }
    }
    
    // イラストレーター
    let illustrator = ''
    const illustLinks = document.querySelectorAll('a[href*="illust="]')
    illustLinks.forEach(link => {
      const text = link.textContent?.trim()
      if (text && !text.includes('検索')) {
        illustrator = text
      }
    })
    
    // 拡張パック
    let expansion = ''
    const expansionLinks = document.querySelectorAll('a[href*="/ex/"], a[href*="/products/"]')
    expansionLinks.forEach(link => {
      const text = link.textContent?.trim()
      if (text && text.length > 2) {
        expansion = text
      }
    })
    // 別のパターン: リスト内のリンク
    if (!expansion) {
      const listItems = document.querySelectorAll('li a')
      listItems.forEach(link => {
        const href = link.getAttribute('href') || ''
        const text = link.textContent?.trim() || ''
        if (href.includes('/ex/') && text.length > 2) {
          expansion = text
        }
      })
    }
    
    // レギュレーション（画像から）
    let regulation = ''
    const regImg = document.querySelector('img[src*="/regulation_logo"]')
    if (regImg) {
      const src = regImg.getAttribute('src') || ''
      const alt = regImg.getAttribute('alt') || ''
      // ファイル名から取得 (例: M2a.gif)
      const match = src.match(/\/([A-Z0-9a-z]+)\.gif/)
      if (match) {
        regulation = match[1]
      } else if (alt) {
        regulation = alt
      }
    }
    
    return {
      name,
      imageUrl,
      cardNumber,
      rarityIcon,
      illustrator,
      expansion,
      regulation
    }
  })
  
  // レアリティをマッピング
  const rarity = RARITY_MAP[cardData.rarityIcon] || ''
  
  return {
    name: cardData.name,
    imageUrl: cardData.imageUrl,
    cardNumber: cardData.cardNumber,
    rarity,
    illustrator: cardData.illustrator,
    expansion: cardData.expansion,
    regulation: cardData.regulation,
    sourceUrl: detailUrl
  }
}

// GET: 一覧URLから詳細情報を取得（プレビュー）
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const listUrl = searchParams.get('url')
  const limit = parseInt(searchParams.get('limit') || '10')
  
  if (!listUrl) {
    return NextResponse.json({
      message: 'Pokemon Card Official Import API',
      usage: 'GET ?url=<list_url>&limit=10',
      example: '/api/pokemon-card-import?url=https://www.pokemon-card.com/card-search/index.php?sc_rare_sar=1&limit=5'
    })
  }
  
  let browser = null
  
  try {
    browser = await connectBrowser()
    const page = await browser.newPage()
    
    // 一覧からリンク取得
    const cardLinks = await getCardLinksFromList(page, listUrl)
    
    if (cardLinks.length === 0) {
      await browser.close()
      return NextResponse.json({
        success: false,
        error: 'No cards found on list page'
      })
    }
    
    // 制限付きで詳細取得
    const linksToProcess = cardLinks.slice(0, limit)
    const cards = []
    
    for (const link of linksToProcess) {
      try {
        const cardData = await getCardDetails(page, link)
        cards.push(cardData)
        console.log(`Got: ${cardData.name} (${cardData.rarity})`)
        
        // レート制限対策
        await page.waitForTimeout(1000)
      } catch (err: any) {
        console.error(`Error getting ${link}:`, err.message)
        cards.push({ error: err.message, sourceUrl: link })
      }
    }
    
    await browser.close()
    
    return NextResponse.json({
      success: true,
      totalFound: cardLinks.length,
      processed: cards.length,
      cards
    })
    
  } catch (error: any) {
    if (browser) await browser.close()
    console.error('Import error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// POST: DBに保存
export async function POST(request: NextRequest) {
  const { url: listUrl, limit = 50, skipExisting = true } = await request.json()
  
  if (!listUrl) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }
  
  let browser = null
  
  try {
    browser = await connectBrowser()
    const page = await browser.newPage()
    
    // 一覧からリンク取得
    const cardLinks = await getCardLinksFromList(page, listUrl)
    
    if (cardLinks.length === 0) {
      await browser.close()
      return NextResponse.json({
        success: false,
        error: 'No cards found on list page'
      })
    }
    
    // ポケモンカードのカテゴリIDを取得
    const { data: category } = await supabase
      .from('category_large')
      .select('id')
      .eq('name', 'ポケモンカード')
      .single()
    
    const linksToProcess = cardLinks.slice(0, limit)
    
    let newCount = 0
    let updateCount = 0
    let skipCount = 0
    let errorCount = 0
    const errors: string[] = []
    
    for (const link of linksToProcess) {
      try {
        const cardData = await getCardDetails(page, link)
        
        if (!cardData.name || !cardData.imageUrl) {
          errorCount++
          errors.push(`Empty data for ${link}`)
          continue
        }
        
        // 既存チェック（画像URLで判定）
        const { data: existingList } = await supabase
          .from('cards')
          .select('id')
          .eq('image_url', cardData.imageUrl)
        
        const existing = existingList?.[0]
        
        if (existing) {
          if (skipExisting) {
            skipCount++
          } else {
            // 更新
            await supabase
              .from('cards')
              .update({
                name: cardData.name,
                card_number: cardData.cardNumber,
                rarity: cardData.rarity,
                illustrator: cardData.illustrator,
                expansion: cardData.expansion,
                regulation: cardData.regulation
              })
              .eq('id', existing.id)
            updateCount++
          }
        } else {
          // 新規登録
          await supabase
            .from('cards')
            .insert([{
              name: cardData.name,
              image_url: cardData.imageUrl,
              card_number: cardData.cardNumber,
              rarity: cardData.rarity,
              illustrator: cardData.illustrator,
              expansion: cardData.expansion,
              regulation: cardData.regulation,
              category_large_id: category?.id || null
            }])
          newCount++
        }
        
        console.log(`Saved: ${cardData.name}`)
        
        // レート制限対策
        await page.waitForTimeout(1000)
        
      } catch (err: any) {
        errorCount++
        errors.push(`${link}: ${err.message}`)
        console.error(`Error:`, err.message)
      }
    }
    
    await browser.close()
    
    return NextResponse.json({
      success: true,
      totalFound: cardLinks.length,
      processed: linksToProcess.length,
      newCount,
      updateCount,
      skipCount,
      errorCount,
      errors: errors.slice(0, 10)
    })
    
  } catch (error: any) {
    if (browser) await browser.close()
    console.error('Import error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
