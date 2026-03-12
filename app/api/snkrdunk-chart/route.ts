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
import { ALLOWED_GRADES } from '@/components/card-detail/constants'

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

    const supabase = createServiceClient()
    const query = supabase
        .from('snkrdunk_chart_data')
        .select('condition, date, price, price_cleaned, is_anomaly')
        .eq('card_id', cardId)
        .order('date', { ascending: true })

    const finalQuery = condition ? query.eq('condition', condition) : query

    const { data, error } = await finalQuery.limit(10000)

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
        const supabase = createServiceClient()
        const { cardId, conditions: requestedConditions } = await req.json()

        if (!cardId) {
            return NextResponse.json({ success: false, error: 'cardId is required' }, { status: 400 })
        }

        // card_sale_urls から apparel_id を取得
        const { data: saleUrls } = await supabase
            .from('card_sale_urls')
            .select('apparel_id, product_url')
            .eq('card_id', cardId)
            .like('product_url', '%snkrdunk.com%')
            .limit(1)

        const saleUrl = saleUrls?.[0]
        if (!saleUrl) {
            return NextResponse.json({ success: false, error: 'スニダンのURLが設定されていません' }, { status: 404 })
        }

        const apparelId = saleUrl.apparel_id ?? extractApparelId(saleUrl.product_url)
        if (!apparelId) {
            return NextResponse.json({ success: false, error: 'apparel_idを特定できません' }, { status: 400 })
        }

        // product_type 判定（snkrdunk_items_cacheから判定、なければAPI）
        let productType: string
        try {
            const info = await getProductInfo(apparelId)
            productType = info.isBox ? 'box' : 'single'
        } catch {
            productType = 'single'
        }

        const results: { condition: string; fetched: number; inserted: number; anomalies: number }[] = []
        const now = new Date().toISOString()

        if (productType === 'single') {
            // シングルカード: A, B, PSA10, PSA9 を取得（「すべての状態」は平均値のため除外）
            const conditionsToFetch = requestedConditions || [...ALLOWED_GRADES].filter(g => !/^\d+個$/.test(g))

            for (const condLabel of conditionsToFetch) {
                const optionId = SINGLE_CHART_OPTIONS[condLabel]
                if (optionId === undefined) continue

                try {
                    const chartData = await getSalesChartUsed(apparelId, optionId, 'all')
                    if (!chartData.points || chartData.points.length === 0) {
                        results.push({ condition: condLabel, fetched: 0, inserted: 0, anomalies: 0 })
                        continue
                    }

                    const cleaned = cleanChartData(chartData.points)
                    const r = await upsertChartData(cardId, apparelId, productType, condLabel, cleaned, now)
                    results.push({ condition: condLabel, ...r })

                    // レート制限対策
                    await sleep(300)
                } catch (e: unknown) {
                    console.error(`[snkrdunk-chart] Error fetching ${condLabel}:`, e instanceof Error ? e.message : e)
                    results.push({ condition: condLabel, fetched: 0, inserted: 0, anomalies: 0 })
                }
            }
        } else {
            // BOX: 「1個」のみ取得
            const options = await getBoxChartOptions(apparelId)
            if (options.length === 0) {
                return NextResponse.json({ success: true, message: 'BOXチャートオプションなし', results: [] })
            }

            const conditionsToFetch = requestedConditions || ['1個']

            for (const condLabel of conditionsToFetch) {
                const option = options.find(o => o.localizedName === condLabel)
                if (!option) continue

                try {
                    const chartData = await getSalesChart(apparelId, option.id, 'all')
                    if (!chartData.points || chartData.points.length === 0) {
                        results.push({ condition: condLabel, fetched: 0, inserted: 0, anomalies: 0 })
                        continue
                    }

                    const cleaned = cleanChartData(chartData.points)
                    const r = await upsertChartData(cardId, apparelId, productType, condLabel, cleaned, now)
                    results.push({ condition: condLabel, ...r })

                    await sleep(300)
                } catch (e: unknown) {
                    console.error(`[snkrdunk-chart] Error fetching BOX ${condLabel}:`, e instanceof Error ? e.message : e)
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
    } catch (error: unknown) {
        console.error('[snkrdunk-chart] Error:', error)
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
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
    const supabase = createServiceClient()
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
