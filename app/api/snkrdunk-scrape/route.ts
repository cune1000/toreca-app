import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const TORECA_SCRAPER_URL = process.env.TORECA_SCRAPER_URL || 'https://skillful-love-production.up.railway.app'

/**
 * スニーカーダンクの売買履歴をスクレイピング
 * toreca-scraper（Railway）を呼び出してスクレイピング
 */
export async function POST(req: Request) {
    try {
        const { cardId, url } = await req.json()

        if (!cardId || !url) {
            return NextResponse.json(
                { success: false, error: 'cardId and url are required' },
                { status: 400 }
            )
        }

        console.log(`[Snkrdunk] Scraping via toreca-scraper: ${url}`)

        // toreca-scraperを呼び出してスクレイピング
        const scrapeResponse = await fetch(`${TORECA_SCRAPER_URL}/api/snkrdunk-scrape`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        })

        if (!scrapeResponse.ok) {
            throw new Error(`Scraper failed: ${scrapeResponse.statusText}`)
        }

        const scrapeData = await scrapeResponse.json()

        if (!scrapeData.success) {
            throw new Error(scrapeData.error || 'Scraping failed')
        }

        const salesHistory = scrapeData.data || []
        console.log(`[Snkrdunk] Received ${salesHistory.length} sales from scraper`)

        if (salesHistory.length === 0) {
            return NextResponse.json({
                success: true,
                total: 0,
                inserted: 0,
                skipped: 0,
                message: 'No sales history found'
            })
        }

        // データを整形（アイコン番号も含む）
        const now = new Date()
        const scrapedData: Array<{
            grade: string
            price: number
            sold_at: string
            user_icon_number: number | null
        }> = []

        salesHistory.forEach((item: any) => {
            const soldAt = parseRelativeTime(item.dateText, now)
            if (!soldAt) return

            const grade = normalizeGrade(item.gradeText)
            if (!grade) return

            const price = parsePrice(item.priceText)
            if (!price) return

            scrapedData.push({
                grade,
                price,
                sold_at: soldAt.toISOString(),
                user_icon_number: item.userIconNumber || null
            })
        })

        // 既存データを取得
        const { data: existingData } = await supabase
            .from('snkrdunk_sales_history')
            .select('grade, price, sold_at, user_icon_number')
            .eq('card_id', cardId)

        // 新規データのみを抽出（user_icon_numberベースの重複判定）
        const newData: any[] = []
        let skippedCount = 0

        console.log(`[Debug] Total scraped: ${scrapedData.length}, Existing data: ${existingData?.length || 0}`)

        for (let i = 0; i < scrapedData.length; i++) {
            const sale = scrapedData[i]

            // 前後の取引情報（将来の拡張用）
            const context = {
                prev_1: i >= 1 ? {
                    grade: scrapedData[i - 1].grade,
                    price: scrapedData[i - 1].price,
                    icon: scrapedData[i - 1].user_icon_number
                } : null,
                next_1: i < scrapedData.length - 1 ? {
                    grade: scrapedData[i + 1].grade,
                    price: scrapedData[i + 1].price,
                    icon: scrapedData[i + 1].user_icon_number
                } : null
            }

            // 重複チェック
            let isDuplicate = false

            if (sale.user_icon_number) {
                // アイコン番号がある場合: グレード・価格・アイコン番号で判定
                isDuplicate = existingData?.some(existing =>
                    existing.grade === sale.grade &&
                    existing.price === sale.price &&
                    existing.user_icon_number === sale.user_icon_number
                ) || false
            } else {
                // アイコン番号がない場合: 従来通り時刻も含めて判定
                isDuplicate = existingData?.some(existing =>
                    existing.grade === sale.grade &&
                    existing.price === sale.price &&
                    existing.sold_at === sale.sold_at &&
                    !existing.user_icon_number
                ) || false
            }

            if (!isDuplicate) {
                newData.push({
                    card_id: cardId,
                    grade: sale.grade,
                    price: sale.price,
                    sold_at: sale.sold_at,
                    user_icon_number: sale.user_icon_number,
                    // context_fingerprint: context, // 一時的に無効化（スキーマキャッシュ問題）
                    sequence_number: 0, // 互換性のため残す
                    scraped_at: new Date().toISOString()
                })
                console.log(`[Debug] Added to newData: ${sale.grade} ¥${sale.price} icon:${sale.user_icon_number}`)
            } else {
                skippedCount++
                console.log(`[Duplicate detected] ${sale.grade} ¥${sale.price} icon:${sale.user_icon_number}`)
            }
        }

        console.log(`[Debug] newData count: ${newData.length}, skipped: ${skippedCount}`)

        // 新規データのみ挿入
        let insertedCount = 0
        for (const item of newData) {
            // マイグレーション前の互換性: user_icon_numberとcontext_fingerprintがnullの場合は除外
            const insertData: any = {
                card_id: item.card_id,
                grade: item.grade,
                price: item.price,
                sold_at: item.sold_at,
                sequence_number: item.sequence_number,
                scraped_at: item.scraped_at
            }

            // 新しいカラムは存在する場合のみ追加
            if (item.user_icon_number !== null && item.user_icon_number !== undefined) {
                insertData.user_icon_number = item.user_icon_number
            }
            // context_fingerprintは一時的に無効化
            // if (item.context_fingerprint !== null && item.context_fingerprint !== undefined) {
            //     insertData.context_fingerprint = item.context_fingerprint
            // }

            const { error } = await supabase
                .from('snkrdunk_sales_history')
                .insert(insertData)

            if (error) {
                // 重複エラー（23505）は無視、それ以外はログ出力
                if (error.code === '23505') {
                    console.log(`[DB duplicate] ${item.grade} ¥${item.price} icon:${item.user_icon_number}`)
                    skippedCount++
                } else {
                    console.error(`[Insert error] ${error.code}: ${error.message}`, insertData)
                }
            } else {
                insertedCount++
            }
        }

        return NextResponse.json({
            success: true,
            total: scrapedData.length,
            inserted: insertedCount,
            skipped: skippedCount
        })
    } catch (error: any) {
        console.error('Scraping error:', error)
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}

/**
 * 相対時間を絶対時間に変換
 * 例: "25分前" → Date
 */
function parseRelativeTime(timeStr: string, baseTime: Date): Date | null {
    const pattern = /(\d+)(分|時間|日)前/
    const match = timeStr.match(pattern)

    if (!match) return null

    const value = parseInt(match[1], 10)
    const unit = match[2]

    const result = new Date(baseTime)

    switch (unit) {
        case '分':
            result.setMinutes(result.getMinutes() - value)
            break
        case '時間':
            result.setHours(result.getHours() - value)
            break
        case '日':
            result.setDate(result.getDate() - value)
            break
        default:
            return null
    }

    return result
}

/**
 * グレードを正規化
 * 例: "PSA 10" → "PSA10", "状態 A" → "A"
 */
function normalizeGrade(gradeText: string): string | null {
    const cleaned = gradeText.replace(/\s+/g, '').toUpperCase()

    // PSA10, PSA9, PSA8以下
    if (cleaned.includes('PSA10')) return 'PSA10'
    if (cleaned.includes('PSA9')) return 'PSA9'
    if (cleaned.includes('PSA8') || cleaned.includes('PSA7') || cleaned.includes('PSA6')) return 'PSA8以下'

    // BGS
    if (cleaned.includes('BGS10BL')) return 'BGS10BL'
    if (cleaned.includes('BGS10GL')) return 'BGS10GL'
    if (cleaned.includes('BGS9.5')) return 'BGS9.5'
    if (cleaned.includes('BGS9')) return 'BGS9以下'

    // ARS
    if (cleaned.includes('ARS10+')) return 'ARS10+'
    if (cleaned.includes('ARS10')) return 'ARS10'
    if (cleaned.includes('ARS9')) return 'ARS9'
    if (cleaned.includes('ARS8')) return 'ARS8以下'

    // 状態
    if (cleaned.includes('A') || cleaned === 'A') return 'A'
    if (cleaned.includes('B') || cleaned === 'B') return 'B'
    if (cleaned.includes('C') || cleaned === 'C') return 'C'
    if (cleaned.includes('D') || cleaned === 'D') return 'D'

    return null
}

/**
 * 価格を抽出
 * 例: "¥35,500" → 35500
 */
function parsePrice(priceText: string): number | null {
    const cleaned = priceText.replace(/[¥,]/g, '')
    const price = parseInt(cleaned, 10)
    return isNaN(price) ? null : price
}
