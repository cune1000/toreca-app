import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { shouldRunCronJob, markCronJobRun } from '@/lib/cron-gate'
import { getCategoryItems } from '@/lib/snkrdunk-api'
import { parseExternalName } from '@/app/linking/lib/matching'

export const maxDuration = 300

const supabase = createServiceClient()

/** 1回のcron実行でフェッチするデフォルトの最大ページ数 */
const DEFAULT_MAX_PAGES_PER_RUN = 5
/** 1ページあたりの取得件数 */
const PER_PAGE = 120
/** ページ間の待機時間（ms） */
const PAGE_DELAY_MS = 500
/** 同期対象のカテゴリID: 25=シングル(~39,571件), 14=BOX/パック(~1,108件) */
const CATEGORY_IDS = [25, 14]

/**
 * スニダン商品キャッシュ同期cron
 * ポケカ全商品（約39,000件）を snkrdunk_items_cache にキャッシュ
 * 6時間ごとに実行
 */
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return new Response('Unauthorized', { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const isFullSync = searchParams.get('full') === 'true'

    const forceParam = searchParams.get('force') === '1'
    const gate = await shouldRunCronJob('snkrdunk-items-sync', { force: forceParam })
    if (!gate.shouldRun && !isFullSync) { // フル同期（手動）の場合はゲートを無視してもよい
      return NextResponse.json({ skipped: true, reason: gate.reason })
    }

    const pagesParam = parseInt(searchParams.get('pages') || '0')
    const startPage = parseInt(searchParams.get('start') || '1')
    const maxPages = isFullSync ? 9999 : (pagesParam || DEFAULT_MAX_PAGES_PER_RUN)
    // 特定カテゴリのみ同期する場合（例: ?catId=14）
    const catIdParam = searchParams.get('catId')
    const categoryIds = catIdParam ? [parseInt(catIdParam)] : CATEGORY_IDS

    console.log(`[snkrdunk-items-sync] Starting ${isFullSync ? 'Full' : 'Light'} sync (start=${startPage}, max=${maxPages}, categories=${categoryIds.join(',')})...`)
    const startTime = Date.now()
    const now = new Date().toISOString()

    let totalInserted = 0
    let totalFetched = 0
    let totalPagesProcessed = 0
    const categoryResults: Record<number, { fetched: number; upserted: number; pages: number }> = {}

    for (const catId of categoryIds) {
      console.log(`[snkrdunk-items-sync] Syncing categoryId=${catId}...`)
      let catFetched = 0
      let catUpserted = 0
      let page = startPage
      let totalPages = 9999

      const endPage = startPage + maxPages - 1
      while (page <= totalPages && page <= endPage) {
        console.log(`[snkrdunk-items-sync] [catId=${catId}] Fetching page ${page}/${Math.min(totalPages, endPage)}...`)

        const result = await getCategoryItems(page, PER_PAGE, 'new', catId)
        totalPages = result.totalPages
        catFetched += result.items.length

        if (result.items.length === 0) break

        // バッチUPSERT（snkrdunk_items_cache）— 名前からset_code/languageをパース
        const rows = result.items.map(item => {
          const parsed = parseExternalName(item.name)
          return {
            apparel_id: item.id,
            name: item.name,
            localized_name: item.localizedName || null,
            product_number: item.productNumber || null,
            min_price: item.minPrice,
            total_listing_count: item.totalListingCount,
            image_url: item.imageUrl,
            released_at: item.releasedAt,
            parsed_set_code: parsed.setCode || null,
            language: parsed.language || null,
            synced_at: now,
          }
        })

        const { error, count } = await supabase
          .from('snkrdunk_items_cache')
          .upsert(rows, { onConflict: 'apparel_id', count: 'exact' })

        if (error) {
          console.error(`[snkrdunk-items-sync] [catId=${catId}] Upsert error on page ${page}:`, error.message)
        } else {
          const upsertedCount = count ?? rows.length
          catUpserted += upsertedCount
        }

        page++

        // レート制限対策
        if (page <= totalPages && page <= endPage) {
          await new Promise(resolve => setTimeout(resolve, PAGE_DELAY_MS))
        }
      }

      const pagesProcessed = page - startPage
      categoryResults[catId] = { fetched: catFetched, upserted: catUpserted, pages: pagesProcessed }
      totalFetched += catFetched
      totalInserted += catUpserted
      totalPagesProcessed += pagesProcessed

      console.log(`[snkrdunk-items-sync] [catId=${catId}] Done: fetched=${catFetched}, upserted=${catUpserted}, pages=${pagesProcessed}`)
    }

    const durationMs = Date.now() - startTime
    const summary = {
      success: true,
      totalFetched,
      totalUpserted: totalInserted,
      totalPagesProcessed,
      categoryResults,
      durationMs,
    }

    console.log(`[snkrdunk-items-sync] Complete:`, summary)
    await markCronJobRun('snkrdunk-items-sync', 'success')

    return NextResponse.json(summary)
  } catch (error: any) {
    console.error('[snkrdunk-items-sync] Cron job error:', error)
    await markCronJobRun('snkrdunk-items-sync', 'error', error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
