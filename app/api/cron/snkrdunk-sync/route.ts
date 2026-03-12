import { NextRequest, NextResponse } from 'next/server'
import { withCronAuth } from '@/lib/cron-gate'
import {
  extractApparelId,
  getProductInfo,
  getSalesHistory,
  getAllListings,
  getBoxSizes,
} from '@/lib/snkrdunk-api'
import { normalizeGrade, parseRelativeTime, extractGradePrices } from '@/lib/scraping/helpers'
import type { SupabaseClient } from '@supabase/supabase-js'

export const maxDuration = 300

const BATCH_SIZE = 15
const SYNC_INTERVAL_MINUTES = 120        // 通常: 2時間
const ERROR_BASE_RETRY_MINUTES = 60      // エラー初回: 1時間
const ERROR_MAX_RETRY_MINUTES = 360      // エラー最大: 6時間

// 2つの sold_at が同一取引かどうかを判定（10分以内の差を同一とみなす）
function isSameTransaction(existingSoldAt: string, newSoldAt: string): boolean {
  const t1 = new Date(existingSoldAt).getTime()
  const t2 = new Date(newSoldAt).getTime()
  if (isNaN(t1) || isNaN(t2)) return false
  return Math.abs(t1 - t2) < 10 * 60 * 1000
}

// アイコン番号を抽出するヘルパー
function extractIconNumber(imageUrl: string): number | null {
  if (!imageUrl) return null
  const match = imageUrl.match(/user-icon-(\d+)/)
  return match ? parseInt(match[1]) : null
}

// エクスポネンシャルバックオフでリトライ間隔を計算
function calculateErrorRetryMinutes(errorCount: number): number {
  // 1時間 → 2時間 → 4時間 → 6時間（上限）
  const retry = ERROR_BASE_RETRY_MINUTES * Math.pow(2, Math.min(errorCount, 3))
  return Math.min(retry, ERROR_MAX_RETRY_MINUTES)
}

/**
 * スニダン統合同期Cron
 * 売買履歴 + 販売中最安値を1カード1回の処理で取得
 * バッチ処理: 1回あたり最大15カード
 */
export const GET = withCronAuth('snkrdunk-sync', async (req: NextRequest, supabase) => {
  const now = new Date()
  const batchStart = Date.now()

  const { data: saleUrls, error: fetchError } = await supabase
    .from('card_sale_urls')
    .select('*, site:site_id(id, name), card:card_id(id, name)')
    .like('product_url', '%snkrdunk.com%')
    .or('next_scrape_at.is.null,next_scrape_at.lte.' + now.toISOString())
    .order('next_scrape_at', { ascending: true, nullsFirst: true })
    .limit(BATCH_SIZE)

  if (fetchError) {
    console.error('[snkrdunk-sync] Failed to fetch sale URLs:', fetchError)
    throw new Error(fetchError.message)
  }

  if (!saleUrls || saleUrls.length === 0) {
    return NextResponse.json({ success: true, processed: 0, message: 'No URLs to sync' })
  }

  console.log(`[snkrdunk-sync] Starting batch: ${saleUrls.length} cards`)
  const results = []

  for (const saleUrl of saleUrls) {
    const cardStart = Date.now()
    let syncResult: SyncResult | null = null
    let syncError: string | null = null

    try {
      syncResult = await syncCard(supabase, saleUrl, now)
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : String(error)
      console.error(`[snkrdunk-sync] Failed: ${saleUrl.card?.name}:`, errMsg)
      syncError = errMsg
    }

    // card_sale_urls 共通UPDATE
    const isSuccess = syncResult !== null
    const errorCount = isSuccess ? 0 : ((saleUrl.error_count || 0) + 1)
    const nextMinutes = isSuccess
      ? SYNC_INTERVAL_MINUTES
      : calculateErrorRetryMinutes(errorCount)
    const nextScrapeAt = new Date(now.getTime() + nextMinutes * 60 * 1000)

    const updatePayload: Record<string, string | number | null> = {
      last_scraped_at: now.toISOString(),
      last_scrape_status: isSuccess ? 'success' : 'error',
      last_scrape_error: syncError,
      next_scrape_at: nextScrapeAt.toISOString(),
      error_count: errorCount,
    }
    if (isSuccess && syncResult) {
      updatePayload.last_price = syncResult.overallMin
      updatePayload.last_stock = syncResult.totalListings
      updatePayload.last_checked_at = now.toISOString()
      updatePayload.apparel_id = syncResult.apparelId
      updatePayload.product_type = syncResult.productType
    }

    const { error: updateError } = await supabase
      .from('card_sale_urls')
      .update(updatePayload)
      .eq('id', saleUrl.id)
    if (updateError) {
      console.error(`[snkrdunk-sync] card_sale_urls update failed:`, updateError.message)
    }

    const elapsed = Date.now() - cardStart
    results.push(isSuccess
      ? {
        cardName: saleUrl.card?.name,
        status: 'success',
        salesInserted: syncResult!.salesInserted,
        salesSkipped: syncResult!.salesSkipped,
        overallMin: syncResult!.overallMin,
        totalListings: syncResult!.totalListings,
        gradePrices: syncResult!.gradePricesCount,
        ms: elapsed,
      }
      : {
        cardName: saleUrl.card?.name,
        status: 'error',
        error: syncError,
        ms: elapsed,
      }
    )
  }

  const totalMs = Date.now() - batchStart
  console.log(`[snkrdunk-sync] Batch complete: ${results.length} cards in ${totalMs}ms`)

  return NextResponse.json({
    success: true,
    processed: results.length,
    durationMs: totalMs,
    results,
  })
})

interface SyncResult {
  apparelId: number
  productType: string
  salesInserted: number
  salesSkipped: number
  overallMin: number | null
  totalListings: number
  gradePricesCount: number
}

/**
 * 1カード分の統合同期処理
 * 1. 商品情報（キャッシュ済みならスキップ） 2. 売買履歴 3. 出品一覧
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncCard(supabase: SupabaseClient, saleUrl: any, now: Date): Promise<SyncResult> {
  const cardId = saleUrl.card_id
  const siteId = saleUrl.site_id

  // apparel_id: DB保存済みならURL解析不要
  const apparelId = saleUrl.apparel_id ?? extractApparelId(saleUrl.product_url)
  if (!apparelId) {
    throw new Error(`Invalid URL: ${saleUrl.product_url}`)
  }

  // product_type判定: DB保存済みなら getProductInfo をスキップ
  let productType: string
  if (saleUrl.product_type) {
    productType = saleUrl.product_type
  } else {
    const productInfo = await getProductInfo(apparelId)
    productType = productInfo.isBox ? 'box' : 'single'
    console.log(`[snkrdunk-sync] ${productInfo.localizedName} (type=${productType}) [初回判定]`)
  }

  // 売買履歴取得（最新20件）& 出品一覧（グレード別最安値）を並列取得
  const [{ salesInserted, salesSkipped }, { overallMin, totalListings, gradePricesCount }] = await Promise.all([
    syncSalesHistory(supabase, cardId, apparelId, productType, now),
    syncListingPrices(supabase, cardId, siteId, apparelId, productType),
  ])

  return {
    apparelId,
    productType,
    salesInserted,
    salesSkipped,
    overallMin,
    totalListings,
    gradePricesCount,
  }
}

/**
 * 売買履歴の同期: snkrdunk_sales_history に新規レコードをバッチINSERT
 */
async function syncSalesHistory(
  supabase: SupabaseClient,
  cardId: string,
  apparelId: number,
  productType: string,
  now: Date
): Promise<{ salesInserted: number; salesSkipped: number }> {
  const { history } = await getSalesHistory(apparelId, 1, 20)

  const processedData = history
    .map((item: { date: string; size?: string; condition?: string; price?: number; imageUrl?: string; label?: string }) => {
      const soldAt = parseRelativeTime(item.date, now)
      if (!soldAt) return null

      const gradeSource = productType === 'box' ? item.size : item.condition
      const grade = normalizeGrade(gradeSource)
      if (!grade) return null

      if (!item.price || item.price === 0) return null

      return {
        card_id: cardId,
        apparel_id: apparelId,
        grade,
        price: item.price,
        sold_at: soldAt.toISOString(),
        product_type: productType,
        user_icon_number: extractIconNumber(item.imageUrl || ''),
        size: item.size || null,
        condition: item.condition || null,
        label: item.label || null,
      }
    })
    .filter(Boolean) as NonNullable<ReturnType<typeof Array.prototype.map>[number]>[]

  if (processedData.length === 0) {
    return { salesInserted: 0, salesSkipped: 0 }
  }

  // 既存データ取得（sold_at範囲を絞って効率化）
  const soldAtDates = processedData.map((d) => new Date((d as { sold_at: string }).sold_at).getTime())
  const oldestSoldAt = new Date(Math.min(...soldAtDates) - 11 * 60 * 1000)

  const { data: existingData } = await supabase
    .from('snkrdunk_sales_history')
    .select('grade, price, sold_at, user_icon_number')
    .eq('card_id', cardId)
    .gte('sold_at', oldestSoldAt.toISOString())
    .order('sold_at', { ascending: false })
    .limit(1000)

  // JS側で重複チェック → 新規レコードのみ抽出
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const newSales = processedData.filter((sale: any) => {
    if (sale.user_icon_number) {
      return !existingData?.some(existing =>
        existing.grade === sale.grade &&
        existing.price === sale.price &&
        existing.user_icon_number === sale.user_icon_number &&
        isSameTransaction(existing.sold_at, sale.sold_at)
      )
    } else {
      return !existingData?.some(existing =>
        existing.grade === sale.grade &&
        existing.price === sale.price &&
        isSameTransaction(existing.sold_at, sale.sold_at) &&
        !existing.user_icon_number
      )
    }
  })

  const skippedCount = processedData.length - newSales.length

  if (newSales.length === 0) {
    return { salesInserted: 0, salesSkipped: skippedCount }
  }

  // バッチINSERT（ユニーク制約違反時はフォールバック）
  const { error } = await supabase
    .from('snkrdunk_sales_history')
    .insert(newSales)

  if (!error) {
    return { salesInserted: newSales.length, salesSkipped: skippedCount }
  }

  if (error.code === '23505') {
    // 部分的にユニーク制約違反 → 1件ずつフォールバック
    let insertedCount = 0
    for (const sale of newSales) {
      const { error: singleErr } = await supabase
        .from('snkrdunk_sales_history')
        .insert(sale)
      if (!singleErr) {
        insertedCount++
      } else if (singleErr.code !== '23505') {
        console.error(`[snkrdunk-sync] Insert error:`, singleErr.message)
      }
    }
    return { salesInserted: insertedCount, salesSkipped: processedData.length - insertedCount }
  }

  console.error(`[snkrdunk-sync] Batch insert error:`, error.message)
  return { salesInserted: 0, salesSkipped: processedData.length }
}

interface SalePriceRow {
  card_id: string
  site_id: string
  price: number
  grade: string | null
  stock: number | null
  top_prices?: number[] | null
}

/**
 * 出品一覧の同期: sale_prices にグレード別最安値をバッチINSERT
 */
async function syncListingPrices(
  supabase: SupabaseClient,
  cardId: string,
  siteId: string,
  apparelId: number,
  productType: string
): Promise<{ overallMin: number | null; totalListings: number; gradePricesCount: number }> {
  let overallMin: number | null = null
  let totalListings = 0
  const gradePrices: { grade: string; price: number; stock?: number; topPrices?: number[] }[] = []

  if (productType === 'single') {
    const listings = await getAllListings(apparelId, 'single', 5)
    totalListings = listings.length

    if (listings.length > 0) {
      overallMin = Math.min(...listings.map(l => l.price))
    }

    gradePrices.push(...extractGradePrices(listings))
  } else {
    const sizes = await getBoxSizes(apparelId)
    // BOXは「1個」のみ保存（overallMin不要）
    const oneBox = sizes.find(s => s.name === '1個')
    if (oneBox) {
      overallMin = oneBox.minPrice
      totalListings = oneBox.listingCount
      gradePrices.push({ grade: '1個', price: oneBox.minPrice, stock: oneBox.listingCount })
    }
  }

  // sale_prices にバッチINSERT
  const salePriceRows: SalePriceRow[] = []

  if (overallMin !== null && productType === 'single') {
    salePriceRows.push({
      card_id: cardId,
      site_id: siteId,
      price: overallMin,
      stock: totalListings,
      grade: null,
    })
  }

  for (const gp of gradePrices) {
    if (!gp.price || gp.price <= 0) continue
    salePriceRows.push({
      card_id: cardId,
      site_id: siteId,
      price: gp.price,
      grade: gp.grade,
      stock: gp.stock ?? null,
      top_prices: gp.topPrices ?? null,
    })
  }

  if (salePriceRows.length > 0) {
    // 既存の最新レコードを取得して、価格が変わっていない場合はスキップ
    const { data: existingPrices } = await supabase
      .from('sale_prices')
      .select('grade, price, stock')
      .eq('card_id', cardId)
      .eq('site_id', siteId)
      .order('created_at', { ascending: false })
      .limit(20)

    const existingMap = new Map<string, { price: number; stock: number | null }>()
    for (const ep of existingPrices || []) {
      const key = ep.grade || '__null__'
      if (!existingMap.has(key)) existingMap.set(key, { price: ep.price, stock: ep.stock })
    }

    const newRows = salePriceRows.filter((row) => {
      const key = row.grade || '__null__'
      const existing = existingMap.get(key)
      if (!existing) return true  // 新規グレード
      return existing.price !== row.price || existing.stock !== row.stock  // 価格or在庫変動時のみ
    })

    if (newRows.length > 0) {
      const { error } = await supabase.from('sale_prices').insert(newRows)
      if (error) {
        if (error.message?.includes('top_prices') || error.code === '42703') {
          // top_pricesカラムが存在しない場合のフォールバック
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const rowsWithoutTopPrices = newRows.map(({ top_prices, ...rest }) => rest)
          const { error: retryErr } = await supabase.from('sale_prices').insert(rowsWithoutTopPrices)
          if (retryErr) {
            console.error(`[snkrdunk-sync] sale_prices batch insert error (fallback):`, retryErr.message)
          }
        } else {
          console.error(`[snkrdunk-sync] sale_prices batch insert error:`, error.message)
        }
      }
    }
  }

  return { overallMin, totalListings, gradePricesCount: gradePrices.length }
}
