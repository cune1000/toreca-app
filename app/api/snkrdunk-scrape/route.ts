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

        // データを整形
        const now = new Date()
        const scrapedData: Array<{ grade: string; price: number; sold_at: string }> = []

        salesHistory.forEach((item: any) => {
            // 時間をパース
            const soldAt = parseRelativeTime(item.dateText, now)
            if (!soldAt) return

            // グレードを正規化
            const grade = normalizeGrade(item.gradeText)
            if (!grade) return

            // 価格を抽出
            const price = parsePrice(item.priceText)
            if (!price) return

            scrapedData.push({
                grade,
                price,
                sold_at: soldAt.toISOString()
            })
        })

        // 既存データを取得（最新100件）
        const { data: existingData } = await supabase
            .from('snkrdunk_sales_history')
            .select('grade, price, sold_at, sequence_number')
            .eq('card_id', cardId)
            .order('sold_at', { ascending: false })
            .limit(100)

        // 既存データをMapに変換（高速検索用）
        const existingMap = new Map<string, Set<number>>()
        existingData?.forEach(item => {
            const key = `${item.grade}_${item.price}_${item.sold_at}`
            if (!existingMap.has(key)) {
                existingMap.set(key, new Set())
            }
            existingMap.get(key)!.add(item.sequence_number)
        })

        // 新規データのみを抽出 & sequence_number を割り当て
        const newData: any[] = []
        scrapedData.forEach(sale => {
            const key = `${sale.grade}_${sale.price}_${sale.sold_at}`
            const existingSeqs = existingMap.get(key) || new Set()

            // 次の利用可能なsequence_numberを見つける
            let seq = 0
            while (existingSeqs.has(seq)) {
                seq++
            }

            newData.push({
                card_id: cardId,
                grade: sale.grade,
                price: sale.price,
                sold_at: sale.sold_at,
                sequence_number: seq,
                scraped_at: new Date().toISOString()
            })

            // 次回のために追加
            existingSeqs.add(seq)
            existingMap.set(key, existingSeqs)
        })

        // 新規データのみ挿入
        let insertedCount = 0
        if (newData.length > 0) {
            const { data, error } = await supabase
                .from('snkrdunk_sales_history')
                .insert(newData)
                .select()

            if (error) {
                console.error('Database insert error:', error)
                return NextResponse.json(
                    { success: false, error: error.message },
                    { status: 500 }
                )
            }

            insertedCount = data?.length || 0
        }

        return NextResponse.json({
            success: true,
            total: scrapedData.length,
            inserted: insertedCount,
            skipped: scrapedData.length - insertedCount
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
