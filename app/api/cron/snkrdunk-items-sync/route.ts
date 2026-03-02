import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { shouldRunCronJob, markCronJobRun } from '@/lib/cron-gate'
import { getCategoryItems } from '@/lib/snkrdunk-api'

export const maxDuration = 300

const supabase = createServiceClient()

/** 1回のcron実行でフェッチする最大ページ数 */
const MAX_PAGES_PER_RUN = 50
/** 1ページあたりの取得件数 */
const PER_PAGE = 120
/** ページ間の待機時間（ms） */
const PAGE_DELAY_MS = 500

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

    const gate = await shouldRunCronJob('snkrdunk-items-sync')
    if (!gate.shouldRun) {
      return NextResponse.json({ skipped: true, reason: gate.reason })
    }

    console.log('[snkrdunk-items-sync] Starting full sync...')
    const startTime = Date.now()
    const now = new Date().toISOString()

    let totalInserted = 0
    let totalUpdated = 0
    let totalFetched = 0
    let page = 1
    let totalPages = 1

    // ページネーションで全件取得
    while (page <= totalPages && page <= MAX_PAGES_PER_RUN) {
      console.log(`[snkrdunk-items-sync] Fetching page ${page}/${totalPages}...`)

      const result = await getCategoryItems(page, PER_PAGE)
      totalPages = result.totalPages
      totalFetched += result.items.length

      if (result.items.length === 0) break

      // バッチUPSERT（snkrdunk_items_cache）
      const rows = result.items.map(item => ({
        apparel_id: item.id,
        name: item.name,
        product_number: item.productNumber || null,
        min_price: item.minPrice,
        total_listing_count: item.totalListingCount,
        image_url: item.imageUrl,
        released_at: item.releasedAt,
        synced_at: now,
      }))

      const { error, count } = await supabase
        .from('snkrdunk_items_cache')
        .upsert(rows, { onConflict: 'apparel_id', count: 'exact' })

      if (error) {
        console.error(`[snkrdunk-items-sync] Upsert error on page ${page}:`, error.message)
        // エラーでも続行（部分同期）
      } else {
        // count は upsert された行数（挿入+更新の合計）
        const upsertedCount = count ?? rows.length
        totalInserted += upsertedCount
      }

      page++

      // レート制限対策
      if (page <= totalPages && page <= MAX_PAGES_PER_RUN) {
        await new Promise(resolve => setTimeout(resolve, PAGE_DELAY_MS))
      }
    }

    const durationMs = Date.now() - startTime
    const summary = {
      success: true,
      totalFetched,
      totalUpserted: totalInserted,
      totalPages,
      pagesProcessed: page - 1,
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
