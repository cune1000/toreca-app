import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { parseRelativeTime, normalizeGrade } from '@/lib/scraping/helpers'
import {
    extractApparelId,
    getProductInfo,
    getSalesHistory,
    getAllSalesHistory,
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

        // ① 商品情報を取得して商品タイプを判定
        const productInfo = await getProductInfo(apparelId)
        const productType = productInfo.isBox ? 'box' : 'single'
        console.log(`[SnkrdunkAPI] Product: ${productInfo.localizedName} (${productType})`)

        // ② card_sale_urls の apparel_id を更新（初回のみ）
        await supabase
            .from('card_sale_urls')
            .update({ apparel_id: apparelId })
            .eq('card_id', cardId)
            .eq('product_url', url)
            .is('apparel_id', null)

        // ③ 売買履歴を取得
        // backfill=true: 全ページ取得（初回用）、デフォルト: 1ページ（20件）のみ
        let salesHistory: SnkrdunkSaleRecord[]
        if (backfill) {
            salesHistory = await getAllSalesHistory(apparelId, 10, 50)
            console.log(`[SnkrdunkAPI] Backfill: ${salesHistory.length} sales records`)
        } else {
            const result = await getSalesHistory(apparelId, 1, 20)
            salesHistory = result.history
            console.log(`[SnkrdunkAPI] Fetched ${salesHistory.length} recent sales`)
        }

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

        console.log(`[SnkrdunkAPI] Processed ${processedData.length} valid records from ${salesHistory.length} raw`)

        // ⑤ 既存データを取得（重複判定用）
        const { data: existingData } = await supabase
            .from('snkrdunk_sales_history')
            .select('grade, price, sold_at, user_icon_number')
            .eq('card_id', cardId)

        // ⑥ 重複判定して新規のみ抽出
        const newData: any[] = []
        let skippedCount = 0

        for (const sale of processedData) {
            let isDuplicate = false

            if (sale.user_icon_number) {
                isDuplicate = existingData?.some(existing =>
                    existing.grade === sale.grade &&
                    existing.price === sale.price &&
                    existing.user_icon_number === sale.user_icon_number
                ) || false
            } else {
                isDuplicate = existingData?.some(existing =>
                    existing.grade === sale.grade &&
                    existing.price === sale.price &&
                    existing.sold_at === sale.sold_at &&
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

        // ⑦ バッチINSERT（50件ずつ）
        let insertedCount = 0
        for (let i = 0; i < newData.length; i += 50) {
            const batch = newData.slice(i, i + 50)
            const { error, count } = await supabase
                .from('snkrdunk_sales_history')
                .insert(batch)

            if (error) {
                console.error(`[Batch insert error] ${error.code}: ${error.message}`)
                // バッチ失敗時は1件ずつフォールバック
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

        console.log(`[SnkrdunkAPI] DB write: inserted=${insertedCount}, skipped=${skippedCount}`)

        return NextResponse.json({
            success: true,
            apparelId,
            productType,
            productName: productInfo.localizedName,
            minPrice: productInfo.minPrice,
            total: processedData.length,
            inserted: insertedCount,
            skipped: skippedCount,
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
 * ユーザーアイコンURLからアイコン番号を抽出
 * 例: "https://assets.snkrdunk.com/.../user-icon-18.png" → 18
 */
function extractIconNumber(imageUrl: string): number | null {
    if (!imageUrl) return null
    const match = imageUrl.match(/user-icon-(\d+)\./)
    return match ? parseInt(match[1], 10) : null
}
