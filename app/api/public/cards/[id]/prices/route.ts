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

        // 買取価格を取得（label付き）
        const { data: purchaseData } = await supabase
            .from('purchase_prices')
            .select('price, created_at, link:link_id(label)')
            .eq('card_id', cardId)
            .gt('price', 0)
            .gte('created_at', cutoffStr)
            .order('created_at', { ascending: true })

        // 販売価格を取得（grade付き）
        const { data: saleData } = await supabase
            .from('sale_prices')
            .select('price, grade, created_at')
            .eq('card_id', cardId)
            .gt('price', 0)
            .gte('created_at', cutoffStr)
            .order('created_at', { ascending: true })

        // 日次集約
        const byDate: Record<string, {
            psa10_prices: number[]
            a_prices: number[]
            box_prices: number[]
            // 販売最安値（grade別）
            psa10_sale: number[]
            a_sale: number[]
            box_sale: number[]
            // 買取価格（状態別）
            purchase_normal: number[]
            purchase_psa10: number[]
            purchase_sealed: number[]
            purchase_opened: number[]
        }> = {}

        const ensureDate = (dateStr: string) => {
            const d = new Date(dateStr).toISOString().split('T')[0]
            if (!byDate[d]) {
                byDate[d] = {
                    psa10_prices: [], a_prices: [], box_prices: [],
                    psa10_sale: [], a_sale: [], box_sale: [],
                    purchase_normal: [], purchase_psa10: [],
                    purchase_sealed: [], purchase_opened: [],
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

        // 販売価格（grade別）
        for (const s of (saleData || [])) {
            const entry = ensureDate(s.created_at)
            if (s.grade === 'PSA10') entry.psa10_sale.push(s.price)
            else if (s.grade === 'A') entry.a_sale.push(s.price)
            else if (s.grade === 'BOX') entry.box_sale.push(s.price)
        }

        // 買取価格（状態別）
        for (const p of (purchaseData || [])) {
            const entry = ensureDate(p.created_at)
            const label = (p.link as any)?.label || ''
            if (label.includes('PSA10') || label.includes('psa10')) {
                entry.purchase_psa10.push(p.price)
            } else if (label.includes('未開封')) {
                entry.purchase_sealed.push(p.price)
            } else if (label.includes('開封')) {
                entry.purchase_opened.push(p.price)
            } else {
                entry.purchase_normal.push(p.price)
            }
        }

        // 平均計算
        const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null

        const dailyData = Object.entries(byDate)
            .map(([date, entry]) => ({
                date,
                psa10_avg: avg(entry.psa10_prices),
                a_avg: avg(entry.a_prices),
                box_avg: avg(entry.box_prices),
                psa10_sale: avg(entry.psa10_sale),
                a_sale: avg(entry.a_sale),
                box_sale: avg(entry.box_sale),
                purchase_normal: avg(entry.purchase_normal),
                purchase_psa10: avg(entry.purchase_psa10),
                purchase_sealed: avg(entry.purchase_sealed),
                purchase_opened: avg(entry.purchase_opened),
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
