import { NextRequest, NextResponse } from 'next/server'
import {
  getListings,
  getProductInfo,
} from '@/lib/snkrdunk-api'

// Railway経由でスクレイピング（スニダン以外）
async function scrapeViaRailway(url: string, mode: string = 'auto') {
  const RAILWAY_URL = process.env.RAILWAY_SCRAPER_URL

  if (!RAILWAY_URL) {
    throw new Error('RAILWAY_SCRAPER_URL is not configured')
  }

  const res = await fetch(`${RAILWAY_URL}/scrape`, {
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
  const match = url.match(/\/apparels\/(\d+)/)
  if (!match) throw new Error('Invalid snkrdunk URL: cannot extract apparelId')
  const apparelId = parseInt(match[1], 10)

  const info = await getProductInfo(apparelId)
  const productType: 'single' | 'box' = info?.isBox ? 'box' : 'single'

  const prices: { grade: string; price: number }[] = []
  let totalListings = 0
  let overallMin: number | null = null

  if (productType === 'single') {
    const listings = await getListings(apparelId, 'single', 1, 50)
    totalListings = listings.length

    if (listings.length > 0) {
      overallMin = Math.min(...listings.map(l => l.price))
    }

    // PSA10
    const psa10 = listings.filter(l =>
      l.condition?.includes('PSA10')
    )
    if (psa10.length > 0) {
      prices.push({ grade: 'PSA10', price: Math.min(...psa10.map(l => l.price)) })
    }

    // 状態A
    const gradeA = listings.filter(l =>
      (l.condition?.startsWith('A') || l.condition?.includes('A（')) &&
      !l.condition?.includes('PSA')
    )
    if (gradeA.length > 0) {
      prices.push({ grade: 'A', price: Math.min(...gradeA.map(l => l.price)) })
    }
  } else {
    const listings = await getListings(apparelId, 'box', 1, 50)
    totalListings = listings.length
    if (listings.length > 0) {
      overallMin = Math.min(...listings.map(l => l.price))
      prices.push({ grade: 'BOX', price: overallMin })
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
      railway: process.env.RAILWAY_SCRAPER_URL ? 'configured' : 'not configured'
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
