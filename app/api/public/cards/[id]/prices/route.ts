import { validateApiKey, handleCorsOptions, apiSuccess, apiError } from '@/lib/api/auth'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * 公開API: カード別価格履歴
 * 
 * GET /api/public/cards/[id]/prices
 * 
 * パラメータ:
 * - days: 期間日数（デフォルト30）
 * 
 * ヘッダー:
 * - X-API-Key: APIキー（必須）
 * 
 * レスポンス: 日次集約データ（PSA10/A/BOX売買平均 + 買取平均 + 販売平均）
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const authResult = await validateApiKey(req)
    if (authResult.error) return authResult.error

    try {
        const { id: cardId } = await params
        const { searchParams } = new URL(req.url)
        const days = parseInt(searchParams.get('days') || '30')

        // カードの存在確認
        const { data: card } = await supabase
            .from('cards')
            .select('id, name, card_number, image_url')
            .eq('id', cardId)
            .single()

        if (!card) {
            return apiError('Card not found', 404)
        }

        // 期間計算
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - days)
        const cutoffStr = cutoff.toISOString()

        // スニダン売買履歴を取得
        const { data: salesData } = await supabase
            .from('snkrdunk_sales_history')
            .select('price, grade, sold_at')
            .eq('card_id', cardId)
            .gt('price', 0)
            .gte('sold_at', cutoffStr)
            .order('sold_at', { ascending: true })

        // 買取価格を取得
        const { data: purchaseData } = await supabase
            .from('purchase_prices')
            .select('price, created_at')
            .eq('card_id', cardId)
            .gt('price', 0)
            .gte('created_at', cutoffStr)
            .order('created_at', { ascending: true })

        // 販売価格を取得
        const { data: saleData } = await supabase
            .from('sale_prices')
            .select('price, created_at')
            .eq('card_id', cardId)
            .gt('price', 0)
            .gte('created_at', cutoffStr)
            .order('created_at', { ascending: true })

        // 日次集約
        const byDate: Record<string, {
            psa10_prices: number[]
            a_prices: number[]
            box_prices: number[]
            purchase_prices: number[]
            sale_prices: number[]
        }> = {}

        const ensureDate = (dateStr: string) => {
            const d = new Date(dateStr).toISOString().split('T')[0]
            if (!byDate[d]) {
                byDate[d] = {
                    psa10_prices: [],
                    a_prices: [],
                    box_prices: [],
                    purchase_prices: [],
                    sale_prices: [],
                }
            }
            return byDate[d]
        }

        // スニダン売買
        for (const sale of (salesData || [])) {
            const entry = ensureDate(sale.sold_at)
            if (sale.grade === 'PSA10') {
                entry.psa10_prices.push(sale.price)
            } else if (sale.grade === 'A') {
                entry.a_prices.push(sale.price)
            } else if (sale.grade?.includes('個') || sale.grade?.includes('BOX')) {
                const match = sale.grade.match(/(\d+)/)
                const quantity = match ? parseInt(match[1]) : 1
                entry.box_prices.push(Math.round(sale.price / quantity))
            }
        }

        // 買取価格
        for (const p of (purchaseData || [])) {
            ensureDate(p.created_at).purchase_prices.push(p.price)
        }

        // 販売価格
        for (const s of (saleData || [])) {
            ensureDate(s.created_at).sale_prices.push(s.price)
        }

        // 平均計算
        const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null

        const dailyData = Object.entries(byDate)
            .map(([date, entry]) => ({
                date,
                psa10_avg: avg(entry.psa10_prices),
                psa10_count: entry.psa10_prices.length || null,
                a_avg: avg(entry.a_prices),
                a_count: entry.a_prices.length || null,
                box_avg: avg(entry.box_prices),
                box_count: entry.box_prices.length || null,
                purchase_avg: avg(entry.purchase_prices),
                purchase_count: entry.purchase_prices.length || null,
                sale_avg: avg(entry.sale_prices),
                sale_count: entry.sale_prices.length || null,
            }))
            .sort((a, b) => a.date.localeCompare(b.date))

        return apiSuccess({
            card: {
                id: card.id,
                name: card.name,
                card_number: card.card_number,
                image_url: card.image_url,
            },
            period: { days },
            data: dailyData,
        })
    } catch (error: any) {
        return apiError(error.message)
    }
}

export async function OPTIONS() {
    return handleCorsOptions()
}
