import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const supabase = createServiceClient()
import { parseRelativeTime, normalizeGrade, extractGradePrices } from '@/lib/scraping/helpers'
import {
    extractApparelId,
    getProductInfo,
    getSalesHistory,
    getAllSalesHistory,
    getAllListings,
    getBoxSizes,
    type SnkrdunkSaleRecord,
} from '@/lib/snkrdunk-api'

/**
 * スニダン売買履歴をAPI経由で取得してDBに保存
 * 手動実行用エンドポイント
 */
export async function POST(req: Request) {
    try {
        const { cardId, url, backfill } = await req.json()

        if (!cardId || !url) {
            return NextResponse.json(
                { success: false, error: 'cardId and url are required' },
                { status: 400 }
            )
        }

        // URLからapparelIdを抽出
        const apparelId = extractApparelId(url)
        if (!apparelId) {
            return NextResponse.json(
                { success: false, error: 'URLからapparelIdを抽出できません' },
                { status: 400 }
            )
        }

        console.log(`[SnkrdunkAPI] Starting fetch for apparelId=${apparelId}, cardId=${cardId}`)
        const timings: Record<string, number> = {}
        let t = Date.now()

        // ① 商品情報を取得して商品タイプを判定
        const productInfo = await getProductInfo(apparelId)
        const productType = productInfo.isBox ? 'box' : 'single'
        timings['1_getProductInfo'] = Date.now() - t
        t = Date.now()
        console.log(`[SnkrdunkAPI] Product: ${productInfo.localizedName} (${productType}) [${timings['1_getProductInfo']}ms]`)

        // ② card_sale_urls の apparel_id を更新（初回のみ）
        await supabase
            .from('card_sale_urls')
            .update({ apparel_id: apparelId })
            .eq('card_id', cardId)
            .eq('product_url', url)
            .is('apparel_id', null)
        timings['2_updateApparelId'] = Date.now() - t
        t = Date.now()

        // ③ 売買履歴を取得
        // backfill=true: 全ページ取得（初回用）、デフォルト: 1ページ（20件）のみ
        let salesHistory: SnkrdunkSaleRecord[]
        if (backfill) {
            salesHistory = await getAllSalesHistory(apparelId, 10, 50)
        } else {
            const result = await getSalesHistory(apparelId, 1, 20)
            salesHistory = result.history
        }
        timings['3_getSalesHistory'] = Date.now() - t
        t = Date.now()
        console.log(`[SnkrdunkAPI] Fetched ${salesHistory.length} sales [${timings['3_getSalesHistory']}ms]`)

        if (salesHistory.length === 0) {
            return NextResponse.json({
                success: true,
                apparelId,
                productType,
                productName: productInfo.localizedName,
                total: 0,
                inserted: 0,
                skipped: 0,
                message: 'No sales history found',
            })
        }

        // ④ データを整形
        const now = new Date()
        const processedData = salesHistory.map((item: SnkrdunkSaleRecord) => {
            // 日時パース（相対時刻 or 絶対日付）
            const soldAt = parseRelativeTime(item.date, now)
            if (!soldAt) return null

            // グレード正規化
            // シングル: condition ("PSA10", "A" etc) を使う
            // BOX: size ("1個", "2個" etc) を使う
            const gradeSource = productType === 'box' ? item.size : item.condition
            const grade = normalizeGrade(gradeSource)
            if (!grade) return null

            if (!item.price || item.price === 0) return null

            return {
                grade,
                price: item.price,
                sold_at: soldAt.toISOString(),
                product_type: productType,
                size: item.size || null,
                condition: item.condition || null,
                label: item.label || null,
                user_icon_number: extractIconNumber(item.imageUrl),
            }
        }).filter(Boolean) as any[]

        timings['4_processData'] = Date.now() - t
        t = Date.now()

        // ⑤ 既存データを取得（重複判定用）
        const { data: existingData } = await supabase
            .from('snkrdunk_sales_history')
            .select('grade, price, sold_at, user_icon_number')
            .eq('card_id', cardId)
        timings['5_fetchExisting'] = Date.now() - t
        t = Date.now()

        // ⑥ 重複判定して新規のみ抽出
        const newData: any[] = []
        let skippedCount = 0

        for (const sale of processedData) {
            let isDuplicate = false

            if (sale.user_icon_number) {
                // user_icon_number + grade + price + 日時近似で重複判定
                isDuplicate = existingData?.some(existing =>
                    existing.grade === sale.grade &&
                    existing.price === sale.price &&
                    existing.user_icon_number === sale.user_icon_number &&
                    isSameTransaction(existing.sold_at, sale.sold_at)
                ) || false
            } else {
                // grade + price + 日時近似で重複判定
                isDuplicate = existingData?.some(existing =>
                    existing.grade === sale.grade &&
                    existing.price === sale.price &&
                    isSameTransaction(existing.sold_at, sale.sold_at) &&
                    !existing.user_icon_number
                ) || false
            }

            if (isDuplicate) {
                skippedCount++
                continue
            }

            newData.push({
                card_id: cardId,
                grade: sale.grade,
                price: sale.price,
                sold_at: sale.sold_at,
                product_type: sale.product_type,
                size: sale.size,
                condition: sale.condition,
                label: sale.label,
                user_icon_number: sale.user_icon_number,
                sequence_number: 0,
                scraped_at: new Date().toISOString(),
            })
        }
        timings['6_dedup'] = Date.now() - t
        t = Date.now()

        // ⑦ バッチINSERT（50件ずつ）
        let insertedCount = 0
        for (let i = 0; i < newData.length; i += 50) {
            const batch = newData.slice(i, i + 50)
            const { error, count } = await supabase
                .from('snkrdunk_sales_history')
                .insert(batch)

            if (error) {
                console.error(`[Batch insert error] ${error.code}: ${error.message}`)
                for (const item of batch) {
                    const { error: singleErr } = await supabase
                        .from('snkrdunk_sales_history')
                        .insert(item)
                    if (singleErr) {
                        if (singleErr.code === '23505') skippedCount++
                        else console.error(`[Insert error] ${singleErr.code}: ${singleErr.message}`)
                    } else {
                        insertedCount++
                    }
                }
            } else {
                insertedCount += batch.length
            }
        }
        timings['7_dbInsert'] = Date.now() - t
        t = Date.now()

        console.log(`[SnkrdunkAPI] DB write: inserted=${insertedCount}, skipped=${skippedCount}`, timings)

        // ⑧ 出品一覧から最安値を取得して sale_prices に保存
        // site_id を card_sale_urls から取得
        const { data: saleUrlData } = await supabase
            .from('card_sale_urls')
            .select('site_id')
            .eq('card_id', cardId)
            .eq('product_url', url)
            .single()
        const siteId = saleUrlData?.site_id

        let overallMin: number | null = null
        let totalListings = 0
        const gradePrices: { grade: string; price: number; stock?: number; topPrices?: number[] }[] = []

        if (productType === 'single') {
            try {
                const listings = await getAllListings(apparelId, 'single')
                totalListings = listings.length
                console.log(`[SnkrdunkAPI] Fetched ${listings.length} listings`)

                if (listings.length > 0) {
                    overallMin = Math.min(...listings.map(l => l.price))
                }

                // 共通ヘルパーでPSA10/A/Bのグレード別最安値・在庫・トップ3を抽出
                gradePrices.push(...extractGradePrices(listings))
                console.log(`[SnkrdunkAPI] Grade prices:`, gradePrices.map(g => `${g.grade}=¥${g.price}(${g.stock}件)`).join(', '))
            } catch (e: any) {
                console.error(`[SnkrdunkAPI] Listings fetch error: ${e.message}`)
            }
        } else {
            // BOX: /sizes APIから価格・出品数を取得
            try {
                const sizes = await getBoxSizes(apparelId)
                totalListings = sizes.reduce((sum, s) => sum + s.listingCount, 0)
                const oneBox = sizes.find(s => s.quantity === 1)
                if (oneBox) {
                    overallMin = oneBox.minPrice
                    gradePrices.push({ grade: 'BOX', price: oneBox.minPrice })
                } else if (sizes.length > 0) {
                    const cheapest = sizes.reduce((a, b) => a.minPrice < b.minPrice ? a : b)
                    overallMin = cheapest.minPrice
                    gradePrices.push({ grade: 'BOX', price: cheapest.minPrice })
                }
            } catch (e: any) {
                console.error(`[SnkrdunkAPI] Box sizes fetch error: ${e.message}`)
            }
            console.log(`[SnkrdunkAPI] BOX overallMin: ${overallMin}`)
        }

        // sale_prices に保存（grade=null の全体最安値 + グレード別）
        if (siteId) {
            // 全体最安値（grade=null）— チャートのサイト別価格線に使用
            if (overallMin !== null && overallMin > 0) {
                const { error: overallErr } = await supabase
                    .from('sale_prices')
                    .insert({
                        card_id: cardId,
                        site_id: siteId,
                        price: overallMin,
                        stock: totalListings,
                    })
                if (overallErr) console.error(`[SnkrdunkAPI] sale_prices insert (overall) error:`, overallErr.message)
            }

            // グレード別最安値
            for (const gp of gradePrices) {
                if (gp.price > 0) {
                    const { error: gradeErr } = await supabase
                        .from('sale_prices')
                        .insert({
                            card_id: cardId,
                            site_id: siteId,
                            price: gp.price,
                            grade: gp.grade,
                            stock: gp.stock ?? null,
                            top_prices: gp.topPrices ?? null,
                        })
                    if (gradeErr) console.error(`[SnkrdunkAPI] sale_prices insert (${gp.grade}) error:`, gradeErr.message)
                }
            }
        }
        timings['8_listingPrices'] = Date.now() - t

        // ⑨ スクレイピング成功: ステータスをクリア
        await supabase
            .from('card_sale_urls')
            .update({
                last_scraped_at: new Date().toISOString(),
                last_scrape_status: 'success',
                last_scrape_error: null,
            })
            .eq('card_id', cardId)
            .eq('product_url', url)

        return NextResponse.json({
            success: true,
            apparelId,
            productType,
            productName: productInfo.localizedName,
            minPrice: overallMin,
            gradePrices,
            total: processedData.length,
            inserted: insertedCount,
            skipped: skippedCount,
            timings,
        })
    } catch (error: any) {
        console.error('[SnkrdunkAPI] Error:', error)
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}

/**
 * 2つの sold_at が同一取引かどうかを判定
 * 相対時刻パースの微小な差を吸収するため、10分以内の差を同一と判定
 */
function isSameTransaction(existingSoldAt: string, newSoldAt: string): boolean {
    const t1 = new Date(existingSoldAt).getTime()
    const t2 = new Date(newSoldAt).getTime()
    if (isNaN(t1) || isNaN(t2)) return false
    return Math.abs(t1 - t2) < 10 * 60 * 1000 // 10分
}

/**
 * ユーザーアイコンURLからアイコン番号を抽出
 * 例: "https://assets.snkrdunk.com/.../user-icon-18.png" → 18
 */
function extractIconNumber(imageUrl: string): number | null {
    if (!imageUrl) return null
    const match = imageUrl.match(/user-icon-(\d+)\./)
    return match ? parseInt(match[1], 10) : null
}

