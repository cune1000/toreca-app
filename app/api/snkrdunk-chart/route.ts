import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import {
    extractApparelId,
    getProductInfo,
    getSalesChartUsed,
    getSalesChart,
    getBoxChartOptions,
    SINGLE_CHART_OPTIONS,
} from '@/lib/snkrdunk-api'
import { cleanChartData } from '@/lib/snkrdunk-chart'

const supabase = createServiceClient()

/**
 * GET /api/snkrdunk-chart?cardId=xxx
 * カードのチャートデータをDBから取得
 */
export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const cardId = searchParams.get('cardId')
    const condition = searchParams.get('condition') // オプション: 特定条件のみ

    if (!cardId) {
        return NextResponse.json({ success: false, error: 'cardId is required' }, { status: 400 })
    }

    const query = supabase
        .from('snkrdunk_chart_data')
        .select('condition, date, price, price_cleaned, is_anomaly')
        .eq('card_id', cardId)
        .order('date', { ascending: true })

    if (condition) {
        query.eq('condition', condition)
    }

    const { data, error } = await query.limit(10000)

    if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    // 条件別にグループ化
    const grouped: Record<string, { date: string; price: number; priceCleaned: number; isAnomaly: boolean }[]> = {}
    for (const row of data || []) {
        if (!grouped[row.condition]) grouped[row.condition] = []
        grouped[row.condition].push({
            date: row.date,
            price: row.price,
            priceCleaned: row.price_cleaned ?? row.price,
            isAnomaly: row.is_anomaly ?? false,
        })
    }

    return NextResponse.json({
        success: true,
        data: grouped,
        totalPoints: data?.length ?? 0,
    })
}

/**
 * POST /api/snkrdunk-chart
 * スニダンAPIからチャートデータを取得してDBに保存
 *
 * Body: { cardId, conditions? }
 * - cardId: カードID（必須）
 * - conditions: 取得する条件の配列（オプション、省略時は主要条件を全取得）
 */
export async function POST(req: Request) {
    try {
        const { cardId, conditions: requestedConditions } = await req.json()

        if (!cardId) {
            return NextResponse.json({ success: false, error: 'cardId is required' }, { status: 400 })
        }

        // card_sale_urls から apparel_id と product_type を取得
        const { data: saleUrl } = await supabase
            .from('card_sale_urls')
            .select('apparel_id, product_url, product_type')
            .eq('card_id', cardId)
            .like('product_url', '%snkrdunk.com%')
            .limit(1)
            .single()

        if (!saleUrl) {
            return NextResponse.json({ success: false, error: 'スニダンのURLが設定されていません' }, { status: 404 })
        }

        const apparelId = saleUrl.apparel_id ?? extractApparelId(saleUrl.product_url)
        if (!apparelId) {
            return NextResponse.json({ success: false, error: 'apparel_idを特定できません' }, { status: 400 })
        }

        // product_type 判定
        let productType = saleUrl.product_type
        if (!productType) {
            const info = await getProductInfo(apparelId)
            productType = info.isBox ? 'box' : 'single'
        }

        const results: { condition: string; fetched: number; inserted: number; anomalies: number }[] = []
        const now = new Date().toISOString()

        if (productType === 'single') {
            // シングルカード: 主要条件を取得
            const conditionsToFetch = requestedConditions || [
                'すべての状態', 'A', 'B', 'PSA10', 'PSA9',
            ]

            for (const condLabel of conditionsToFetch) {
                const optionId = SINGLE_CHART_OPTIONS[condLabel]
                if (optionId === undefined) continue

                try {
                    const chartData = await getSalesChartUsed(apparelId, optionId)
                    if (!chartData.points || chartData.points.length === 0) {
                        results.push({ condition: condLabel, fetched: 0, inserted: 0, anomalies: 0 })
                        continue
                    }

                    const cleaned = cleanChartData(chartData.points)
                    const r = await upsertChartData(cardId, apparelId, productType, condLabel, cleaned, now)
                    results.push({ condition: condLabel, ...r })

                    // レート制限対策
                    await sleep(300)
                } catch (e: any) {
                    console.error(`[snkrdunk-chart] Error fetching ${condLabel}:`, e.message)
                    results.push({ condition: condLabel, fetched: 0, inserted: 0, anomalies: 0 })
                }
            }
        } else {
            // BOX: まずオプション一覧を取得
            const options = await getBoxChartOptions(apparelId)
            if (options.length === 0) {
                return NextResponse.json({ success: true, message: 'BOXチャートオプションなし', results: [] })
            }

            // リクエストされた条件、または「すべて」+「1個」
            const conditionsToFetch = requestedConditions || ['すべて', '1個']

            for (const condLabel of conditionsToFetch) {
                const option = condLabel === 'すべて'
                    ? { id: 0, localizedName: 'すべて' }
                    : options.find(o => o.localizedName === condLabel)

                if (!option) continue

                try {
                    const chartData = await getSalesChart(apparelId, option.id)
                    if (!chartData.points || chartData.points.length === 0) {
                        results.push({ condition: condLabel, fetched: 0, inserted: 0, anomalies: 0 })
                        continue
                    }

                    const cleaned = cleanChartData(chartData.points)
                    const r = await upsertChartData(cardId, apparelId, productType, condLabel, cleaned, now)
                    results.push({ condition: condLabel, ...r })

                    await sleep(300)
                } catch (e: any) {
                    console.error(`[snkrdunk-chart] Error fetching BOX ${condLabel}:`, e.message)
                    results.push({ condition: condLabel, fetched: 0, inserted: 0, anomalies: 0 })
                }
            }
        }

        const totalFetched = results.reduce((s, r) => s + r.fetched, 0)
        const totalInserted = results.reduce((s, r) => s + r.inserted, 0)
        const totalAnomalies = results.reduce((s, r) => s + r.anomalies, 0)

        return NextResponse.json({
            success: true,
            apparelId,
            productType,
            totalFetched,
            totalInserted,
            totalAnomalies,
            results,
        })
    } catch (error: any) {
        console.error('[snkrdunk-chart] Error:', error)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}

/**
 * チャートデータをDBに upsert
 */
async function upsertChartData(
    cardId: string,
    apparelId: number,
    productType: string,
    condition: string,
    cleaned: ReturnType<typeof cleanChartData>,
    fetchedAt: string
): Promise<{ fetched: number; inserted: number; anomalies: number }> {
    const rows = cleaned.map(p => ({
        card_id: cardId,
        apparel_id: apparelId,
        condition,
        product_type: productType,
        date: new Date(p.date).toISOString(),
        price: p.price,
        price_cleaned: p.priceCleaned,
        is_anomaly: p.isAnomaly,
        fetched_at: fetchedAt,
    }))

    const anomalies = cleaned.filter(p => p.isAnomaly).length

    // バッチ upsert (100件ずつ)
    let inserted = 0
    for (let i = 0; i < rows.length; i += 100) {
        const batch = rows.slice(i, i + 100)
        const { error } = await supabase
            .from('snkrdunk_chart_data')
            .upsert(batch, { onConflict: 'card_id,condition,date' })

        if (error) {
            console.error(`[snkrdunk-chart] Upsert error:`, error.message)
        } else {
            inserted += batch.length
        }
    }

    return { fetched: cleaned.length, inserted, anomalies }
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}
