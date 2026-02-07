import { validateApiKey, handleCorsOptions, apiSuccess, apiError } from '@/lib/api/auth'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * 公開API: 市場相場指数
 * 
 * GET /api/public/market-index
 * 
 * パラメータ:
 * - category: カテゴリ名（ポケモン, ワンピース等）
 * - rarity: レアリティ（SAR, AR等）
 * - grade: グレード（PSA10, A等）
 * - priceType: 価格タイプ（sale, purchase）
 * - days: 期間日数（デフォルト30, 最大90）
 * 
 * ヘッダー:
 * - X-API-Key: APIキー（必須）
 */
export async function GET(req: Request) {
    const authResult = await validateApiKey(req)
    if (authResult.error) return authResult.error

    try {
        const { searchParams } = new URL(req.url)
        const category = searchParams.get('category')
        const rarity = searchParams.get('rarity')
        const grade = searchParams.get('grade')
        const priceType = searchParams.get('priceType')
        const days = Math.min(parseInt(searchParams.get('days') || '30'), 90)

        // 期間計算
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - days)
        const cutoffDateStr = cutoffDate.toISOString().split('T')[0]

        // クエリ構築
        let query = supabase
            .from('daily_price_index')
            .select('date, category, sub_category, rarity, grade, price_type, avg_price, median_price, card_count, trade_count')
            .gte('date', cutoffDateStr)
            .order('date', { ascending: true })

        if (category) query = query.ilike('category', `%${category}%`)
        if (rarity) query = query.eq('rarity', rarity)
        if (grade) query = query.eq('grade', grade)
        if (priceType) query = query.eq('price_type', priceType)

        const { data, error } = await query

        if (error) {
            return apiError(error.message)
        }

        return apiSuccess({
            data: data || [],
            count: data?.length || 0,
            period: { days, from: cutoffDateStr },
        })
    } catch (error: any) {
        return apiError(error.message)
    }
}

export async function OPTIONS() {
    return handleCorsOptions()
}
