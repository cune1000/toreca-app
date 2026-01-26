export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { chromium } from 'playwright'

export async function GET(request: NextRequest) {
  const token = process.env.BROWSERLESS_TOKEN
  const startTime = Date.now()
  
  const log: string[] = []
  log.push(`Token exists: ${!!token}`)
  log.push(`Token length: ${token?.length || 0}`)
  
  if (!token) {
    return NextResponse.json({
      success: false,
      error: 'BROWSERLESS_TOKEN not set',
      log
    })
  }
  
  let browser = null
  
  try {
    log.push(`Connecting to Browserless.io...`)
    const connectStart = Date.now()
    
    browser = await chromium.connect({
      wsEndpoint: `wss://chrome.browserless.io?token=${token}&stealth&timeout=30000`
    })
    
    log.push(`Connected in ${Date.now() - connectStart}ms`)
    
    log.push(`Creating page...`)
    const page = await browser.newPage()
    log.push(`Page created`)
    
    log.push(`Navigating to example.com...`)
    const navStart = Date.now()
    await page.goto('https://example.com', { timeout: 15000 })
    log.push(`Navigation completed in ${Date.now() - navStart}ms`)
    
    const title = await page.title()
    log.push(`Page title: ${title}`)
    
    await browser.close()
    log.push(`Browser closed`)
    
    return NextResponse.json({
      success: true,
      totalTime: Date.now() - startTime,
      title,
      log
    })
    
  } catch (error: any) {
    log.push(`ERROR: ${error.message}`)
    
    if (browser) {
      try { await browser.close() } catch {}
    }
    
    return NextResponse.json({
      success: false,
      error: error.message,
      totalTime: Date.now() - startTime,
      log
    }, { status: 500 })
  }
}
