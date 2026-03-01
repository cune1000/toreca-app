import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { shouldRunCronJob, markCronJobRun } from '@/lib/cron-gate'
import {
  extractApparelId,
  getProductInfo,
  getSalesHistory,
  getAllListings,
  getBoxSizes,
} from '@/lib/snkrdunk-api'
import { normalizeGrade, parseRelativeTime, extractGradePrices } from '@/lib/scraping/helpers'

export const maxDuration = 120

const BATCH_SIZE = 15
const SYNC_INTERVAL_MINUTES = 120   // 2時間
const ERROR_RETRY_MINUTES = 30      // エラー時30分後にリトライ

const supabase = createServiceClient()

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

/**
 * スニダン統合同期Cron
 * 売買履歴 + 販売中最安値を1カード1回の処理で取得
 * バッチ処理: 1回あたり最大15カード
 */
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response('Unauthorized', { status: 401 })
    }

    const gate = await shouldRunCronJob('snkrdunk-sync')
    if (!gate.shouldRun) {
      return NextResponse.json({ skipped: true, reason: gate.reason })
    }

    const now = new Date()

    // 全スニダンURLを対象（auto_scrape_mode不問）
    const { data: saleUrls, error: fetchError } = await supabase
      .from('card_sale_urls')
      .select('*, site:site_id(id, name), card:card_id(id, name)')
      .like('product_url', '%snkrdunk.com%')
      .or('next_scrape_at.is.null,next_scrape_at.lte.' + now.toISOString())
      .order('next_scrape_at', { ascending: true, nullsFirst: true })
      .limit(BATCH_SIZE)

    if (fetchError) {
      console.error('[snkrdunk-sync] Failed to fetch sale URLs:', fetchError)
      await markCronJobRun('snkrdunk-sync', 'error', fetchError.message)
      return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 })
    }

    if (!saleUrls || saleUrls.length === 0) {
      await markCronJobRun('snkrdunk-sync', 'success')
      return NextResponse.json({ success: true, processed: 0, message: 'No URLs to sync' })
    }

    const results = []

    for (const saleUrl of saleUrls) {
      try {
        const result = await syncCard(saleUrl, now)

        const nextScrapeAt = new Date(now.getTime() + SYNC_INTERVAL_MINUTES * 60 * 1000)

        await supabase
          .from('card_sale_urls')
          .update({
            last_scraped_at: now.toISOString(),
            last_scrape_status: 'success',
            last_scrape_error: null,
            next_scrape_at: nextScrapeAt.toISOString(),
            // 最安値・在庫も更新
            last_price: result.overallMin,
            last_stock: result.totalListings,
            last_checked_at: now.toISOString(),
            apparel_id: result.apparelId,
          })
          .eq('id', saleUrl.id)

        results.push({
          cardName: saleUrl.card?.name,
          status: 'success',
          salesInserted: result.salesInserted,
          salesSkipped: result.salesSkipped,
          overallMin: result.overallMin,
          totalListings: result.totalListings,
          gradePrices: result.gradePricesCount,
        })
      } catch (error: any) {
        console.error(`[snkrdunk-sync] Failed to sync card ${saleUrl.card?.name}:`, error)

        const nextScrapeAt = new Date(now.getTime() + ERROR_RETRY_MINUTES * 60 * 1000)

        await supabase
          .from('card_sale_urls')
          .update({
            last_scraped_at: now.toISOString(),
            last_scrape_status: 'error',
            last_scrape_error: error.message,
            next_scrape_at: nextScrapeAt.toISOString(),
          })
          .eq('id', saleUrl.id)

        results.push({
          cardName: saleUrl.card?.name,
          status: 'error',
          error: error.message,
        })
      }
    }

    await markCronJobRun('snkrdunk-sync', 'success')
    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    })
  } catch (error: any) {
    console.error('[snkrdunk-sync] Cron job error:', error)
    await markCronJobRun('snkrdunk-sync', 'error', error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

interface SyncResult {
  apparelId: number
  salesInserted: number
  salesSkipped: number
  overallMin: number | null
  totalListings: number
  gradePricesCount: number
}

/**
 * 1カード分の統合同期処理
 * ① 商品情報 → ② 売買履歴 → ③ 出品一覧（最安値・在庫・Top3）
 */
async function syncCard(saleUrl: any, now: Date): Promise<SyncResult> {
  const cardId = saleUrl.card_id
  const siteId = saleUrl.site_id

  // ① 商品情報取得
  const apparelId = extractApparelId(saleUrl.product_url)
  if (!apparelId) {
    throw new Error(`Invalid URL: ${saleUrl.product_url}`)
  }

  const productInfo = await getProductInfo(apparelId)
  const productType = productInfo.isBox ? 'box' : 'single'

  console.log(`[snkrdunk-sync] ${productInfo.localizedName} (type=${productType}, apparelId=${apparelId})`)

  // ② 売買履歴取得（最新20件）
  const { salesInserted, salesSkipped } = await syncSalesHistory(
    cardId, apparelId, productType, now
  )

  // ③ 出品一覧（グレード別最安値）取得
  const { overallMin, totalListings, gradePricesCount } = await syncListingPrices(
    cardId, siteId, apparelId, productType
  )

  return {
    apparelId,
    salesInserted,
    salesSkipped,
    overallMin,
    totalListings,
    gradePricesCount,
  }
}

/**
 * 売買履歴の同期: snkrdunk_sales_history に新規レコードをINSERT
 */
async function syncSalesHistory(
  cardId: string,
  apparelId: number,
  productType: string,
  now: Date
): Promise<{ salesInserted: number; salesSkipped: number }> {
  const { history } = await getSalesHistory(apparelId, 1, 20)

  // データ整形
  const processedData = history
    .map((item: any) => {
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
        user_icon_number: extractIconNumber(item.imageUrl),
      }
    })
    .filter(Boolean)

  if (processedData.length === 0) {
    return { salesInserted: 0, salesSkipped: 0 }
  }

  // 既存データ取得（重複チェック用）
  const { data: existingData } = await supabase
    .from('snkrdunk_sales_history')
    .select('grade, price, sold_at, user_icon_number')
    .eq('card_id', cardId)
    .order('sold_at', { ascending: false })
    .limit(100)

  let insertedCount = 0
  let skippedCount = 0

  for (const sale of processedData) {
    let isDuplicate = false

    if (sale.user_icon_number) {
      isDuplicate = existingData?.some(existing =>
        existing.grade === sale.grade &&
        existing.price === sale.price &&
        existing.user_icon_number === sale.user_icon_number &&
        isSameTransaction(existing.sold_at, sale.sold_at)
      ) || false
    } else {
      isDuplicate = existingData?.some(existing =>
        existing.grade === sale.grade &&
        existing.price === sale.price &&
        isSameTransaction(existing.sold_at, sale.sold_at) &&
        !existing.user_icon_number
      ) || false
    }

    if (isDuplicate) {
      skippedCount++
    } else {
      const { error } = await supabase
        .from('snkrdunk_sales_history')
        .insert(sale)
      if (!error) {
        insertedCount++
      } else if (error.code === '23505') {
        // ユニーク制約違反 → 既存データ
        skippedCount++
      } else {
        console.error(`[snkrdunk-sync] Insert error:`, error.message)
        skippedCount++
      }
    }
  }

  return { salesInserted: insertedCount, salesSkipped: skippedCount }
}

/**
 * 出品一覧の同期: sale_prices にグレード別最安値を記録
 */
async function syncListingPrices(
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
    totalListings = sizes.reduce((sum, s) => sum + s.listingCount, 0)
    const oneBox = sizes.find(s => s.quantity === 1)
    if (oneBox) {
      gradePrices.push({ grade: 'BOX', price: oneBox.minPrice })
      overallMin = oneBox.minPrice
    } else if (sizes.length > 0) {
      const cheapest = sizes.reduce((a, b) => a.minPrice < b.minPrice ? a : b)
      gradePrices.push({ grade: 'BOX', price: cheapest.minPrice })
      overallMin = cheapest.minPrice
    }
  }

  // sale_prices に記録
  if (overallMin !== null) {
    // 全体最安値
    await supabase.from('sale_prices').insert({
      card_id: cardId,
      site_id: siteId,
      price: overallMin,
      stock: totalListings,
      grade: null,
    })
  }

  for (const gp of gradePrices) {
    if (!gp.price || gp.price <= 0) continue
    const { error } = await supabase.from('sale_prices').insert({
      card_id: cardId,
      site_id: siteId,
      price: gp.price,
      grade: gp.grade,
      stock: gp.stock ?? null,
      top_prices: gp.topPrices ?? null,
    })
    if (error) {
      // top_prices カラムが存在しない場合のフォールバック
      if (error.message?.includes('top_prices') || error.code === '42703') {
        await supabase.from('sale_prices').insert({
          card_id: cardId,
          site_id: siteId,
          price: gp.price,
          grade: gp.grade,
          stock: gp.stock ?? null,
        })
      } else {
        console.error(`[snkrdunk-sync] sale_prices insert error (grade=${gp.grade}):`, error.message)
      }
    }
  }

  return { overallMin, totalListings, gradePricesCount: gradePrices.length }
}
