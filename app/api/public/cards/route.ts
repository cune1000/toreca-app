import { validateApiKey, handleCorsOptions, apiSuccess, apiError } from '@/lib/api/auth'
import { supabase } from '@/lib/supabase'
import { buildKanaSearchFilter } from '@/lib/utils/kana'

export const dynamic = 'force-dynamic'

/**
 * 公開API: カード検索
 * 
 * GET /api/public/cards
 * 
 * パラメータ:
 * - q: 検索クエリ（2文字以上、ひらがな/カタカナ対応）
 * - category: カテゴリ名で絞り込み
 * - rarity: レアリティで絞り込み
 * - limit: 結果数（デフォルト20, 最大50）
 * - offset: オフセット（ページネーション用）
 * 
 * ヘッダー:
 * - X-API-Key: APIキー（必須）
 */
export async function GET(req: Request) {
    const authResult = await validateApiKey(req)
    if (authResult.error) return authResult.error

    try {
        const { searchParams } = new URL(req.url)
        const q = searchParams.get('q') || ''
        const category = searchParams.get('category')
        const rarity = searchParams.get('rarity')
        const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50)
        const offset = parseInt(searchParams.get('offset') || '0')

        let query = supabase
            .from('cards')
            .select(`
                id, name, card_number, image_url, expansion,
                category_large:category_large_id(id, name),
                category_medium:category_medium_id(id, name),
                rarity:rarity_id(id, name)
            `, { count: 'exact' })

        // 検索（ひらがな/カタカナ対応）
        if (q.length >= 2) {
            query = query.or(buildKanaSearchFilter(q, ['name', 'card_number']))
        }

        // カテゴリフィルタ
        if (category) {
            // category_large の名前で絞り込むため、サブクエリが必要
            const { data: catData } = await supabase
                .from('category_large')
                .select('id')
                .ilike('name', `%${category}%`)

            if (catData && catData.length > 0) {
                query = query.in('category_large_id', catData.map(c => c.id))
            }
        }

        // レアリティフィルタ
        if (rarity) {
            const { data: rarityData } = await supabase
                .from('rarities')
                .select('id')
                .ilike('name', `%${rarity}%`)

            if (rarityData && rarityData.length > 0) {
                query = query.in('rarity_id', rarityData.map(r => r.id))
            }
        }

        const { data, count, error } = await query
            .order('name', { ascending: true })
            .range(offset, offset + limit - 1)

        if (error) {
            return apiError(error.message)
        }

        // レスポンスを整形
        const cards = (data || []).map((card: any) => ({
            id: card.id,
            name: card.name,
            card_number: card.card_number,
            image_url: card.image_url,
            expansion: card.expansion,
            category: card.category_large?.name || null,
            sub_category: card.category_medium?.name || null,
            rarity: card.rarity?.name || null,
        }))

        return apiSuccess({
            data: cards,
            total: count || 0,
            limit,
            offset,
        })
    } catch (error: any) {
        return apiError(error.message)
    }
}

export async function OPTIONS() {
    return handleCorsOptions()
}
