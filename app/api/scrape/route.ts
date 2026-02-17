import { NextRequest, NextResponse } from 'next/server'
import {
  getAllListings,
  getProductInfo,
  getBoxSizes,
  extractApparelId,
} from '@/lib/snkrdunk-api'
import { extractGradePrices } from '@/lib/scraping/helpers'
import { TORECA_SCRAPER_URL } from '@/lib/config'

// Railway経由でスクレイピング（スニダン以外）
async function scrapeViaRailway(url: string, mode: string = 'auto') {
  if (!TORECA_SCRAPER_URL) {
    throw new Error('TORECA_SCRAPER_URL is not configured')
  }

  const res = await fetch(`${TORECA_SCRAPER_URL}/scrape`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, mode }),
  })

  const text = await res.text()
  try {
    return JSON.parse(text)
  } catch {
    throw new Error(`Railway returned non-JSON response: ${text.substring(0, 100)}`)
  }
}

// スニダンAPIで価格取得
async function scrapeSnkrdunk(url: string) {
  const apparelId = extractApparelId(url)
  if (!apparelId) throw new Error('Invalid snkrdunk URL: cannot extract apparelId')

  const info = await getProductInfo(apparelId)
  const productType: 'single' | 'box' = info?.isBox ? 'box' : 'single'

  const prices: { grade: string; price: number; stock?: number; topPrices?: number[] }[] = []
  let totalListings = 0
  let overallMin: number | null = null

  if (productType === 'single') {
    const listings = await getAllListings(apparelId, 'single')
    totalListings = listings.length

    if (listings.length > 0) {
      overallMin = Math.min(...listings.map(l => l.price))
    }

    // グレード別最安値（PSA10, A, B）を共通ヘルパーで抽出
    prices.push(...extractGradePrices(listings))
  } else {
    // BOX: /sizes APIから価格・出品数を取得
    // productInfoはBOXでminPrice=0, totalListingCount=0を返すため
    const sizes = await getBoxSizes(apparelId)
    totalListings = sizes.reduce((sum, s) => sum + s.listingCount, 0)
    // 1個あたりの最安値を基準にする
    const oneBox = sizes.find(s => s.quantity === 1)
    if (oneBox) {
      overallMin = oneBox.minPrice
      prices.push({ grade: 'BOX', price: oneBox.minPrice })
    } else if (sizes.length > 0) {
      // 1個サイズがなければ最安値のサイズを使用
      const cheapest = sizes.reduce((a, b) => a.minPrice < b.minPrice ? a : b)
      overallMin = cheapest.minPrice
      prices.push({ grade: 'BOX', price: cheapest.minPrice })
    }
  }

  return {
    success: true,
    price: overallMin,
    stock: totalListings,
    gradePrices: prices,
    source: 'snkrdunk-api',
  }
}

function isSnkrdunkUrl(url: string): boolean {
  return url.includes('snkrdunk.com')
}

export async function POST(request: NextRequest) {
  const { url, mode = 'auto' } = await request.json()

  if (!url) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }

  try {
    // スニダンURLの場合はAPIを直接使用
    const result = isSnkrdunkUrl(url)
      ? await scrapeSnkrdunk(url)
      : await scrapeViaRailway(url, mode)

    if (result.success) {
      return NextResponse.json(result)
    } else {
      return NextResponse.json(result, { status: 500 })
    }
  } catch (error: any) {
    console.error('Scrape error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Scrape failed' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const url = searchParams.get('url')
  const mode = searchParams.get('mode') || 'auto'

  if (!url) {
    return NextResponse.json({
      message: 'Price scraping API (Railway + SnkrdunkAPI)',
      usage: 'POST with { url: "https://...", mode: "auto|light|browser" }',
      modes: {
        auto: '軽量版を試して、失敗したらブラウザ版でリトライ',
        light: '軽量版のみ（高速）',
        browser: 'ブラウザ版のみ（確実）'
      },
      supported: ['snkrdunk.com (API直接)', 'torecacamp-pokemon.com', 'cardrush-pokemon.jp'],
      railway: TORECA_SCRAPER_URL ? 'configured' : 'not configured'
    })
  }

  try {
    const result = isSnkrdunkUrl(url)
      ? await scrapeSnkrdunk(url)
      : await scrapeViaRailway(url, mode)

    if (result.success) {
      return NextResponse.json(result)
    } else {
      return NextResponse.json(result, { status: 500 })
    }
  } catch (error: any) {
    console.error('Scrape error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Scrape failed' },
      { status: 500 }
    )
  }
}
