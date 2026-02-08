import { NextRequest, NextResponse } from 'next/server'

// Railway経由でスクレイピング
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

export async function POST(request: NextRequest) {
  const { url, mode = 'auto' } = await request.json()

  if (!url) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }

  try {
    const result = await scrapeViaRailway(url, mode)

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
      message: 'Price scraping API (via Railway)',
      usage: 'POST with { url: "https://...", mode: "auto|light|browser" }',
      modes: {
        auto: '軽量版を試して、失敗したらブラウザ版でリトライ',
        light: '軽量版のみ（高速）',
        browser: 'ブラウザ版のみ（確実）'
      },
      supported: ['snkrdunk.com', 'torecacamp-pokemon.com', 'cardrush-pokemon.jp'],
      railway: process.env.RAILWAY_SCRAPER_URL ? 'configured' : 'not configured'
    })
  }

  try {
    const result = await scrapeViaRailway(url, mode)

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
