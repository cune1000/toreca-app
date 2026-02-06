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

        // バックグラウンド処理の場合: ジョブIDを返す
        if (scrapeData.jobId) {
            console.log(`[Snkrdunk] Background job started: ${scrapeData.jobId}`)

            // ポーリング処理
            const pollInterval = 2000 // 2秒ごと
            const maxAttempts = 60 // 最大2分
            let attempts = 0

            const pollJob = async (): Promise<any> => {
                attempts++

                const statusRes = await fetch(`${TORECA_SCRAPER_URL}/scrape/status/${scrapeData.jobId}`)
                const statusData = await statusRes.json()

                if (statusData.status === 'completed') {
                    // 成功: 結果を処理
                    const salesHistory = statusData.result?.sales || []
                    console.log(`[Snkrdunk] Job completed: ${salesHistory.length} sales`)

                    // データベースに保存
                    return await processSalesHistory(cardId, salesHistory)
                } else if (statusData.status === 'failed') {
                    // 失敗
                    throw new Error(statusData.error || 'Scraping failed')
                } else if (attempts >= maxAttempts) {
                    // タイムアウト
                    throw new Error('Timeout: Job took too long')
                }

                // まだ処理中: 再度ポーリング
                await new Promise(resolve => setTimeout(resolve, pollInterval))
                return pollJob()
            }

            return await pollJob()
        }

        // 同期処理の場合(後方互換性)
        const salesHistory = scrapeData.sales || []
        console.log(`[Snkrdunk] Received ${salesHistory.length} sales from scraper`)

        return await processSalesHistory(cardId, salesHistory)
    } catch (error: any) {
        console.error('Scraping error:', error)
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}

/**
 * 売買履歴をデータベースに保存
 */
async function processSalesHistory(cardId: string, salesHistory: any[]) {
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
        const soldAt = parseRelativeTime(item.date, now)
        if (!soldAt) return

        const grade = normalizeGrade(item.size)
        if (!grade) return

        const price = item.price
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
}

/**
 * 相対時間を絶対時間に変換
 * 例: "25分前" → Date, "2026/01/17" → Date
 */
function parseRelativeTime(timeStr: string, baseTime: Date): Date | null {
    if (!timeStr || typeof timeStr !== 'string') return null

    // 西暦表記のパターン（2026/01/17, 2025/11/25など）
    const absoluteDatePattern = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/
    const absoluteMatch = timeStr.match(absoluteDatePattern)
    if (absoluteMatch) {
        const year = parseInt(absoluteMatch[1], 10)
        const month = parseInt(absoluteMatch[2], 10) - 1 // 月は0-indexed
        const day = parseInt(absoluteMatch[3], 10)
        const result = new Date(year, month, day, 0, 0, 0, 0)
        return isNaN(result.getTime()) ? null : result
    }

    // 相対時刻のパターン（3日前、2時間前など）
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

    // 個数表記 (BOX/パックなど)
    if (cleaned.includes('個')) return cleaned

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
