import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// シンソク商品検索API（DBキャッシュベース）
// GET /api/shinsoku/search?q=リザードン&brand=ポケモン&type=ALL
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const query = searchParams.get('q') || ''
        const brand = searchParams.get('brand') || ''
        const type = searchParams.get('type') || ''

        if (!query || query.length < 2) {
            return NextResponse.json({
                success: false,
                error: '検索キーワードは2文字以上必要です',
            }, { status: 400 })
        }

        // DBキャッシュから検索（ilike = 部分一致検索）
        let dbQuery = supabase
            .from('shinsoku_items')
            .select('*')
            .ilike('name', `%${query}%`)
            .order('price_s', { ascending: false, nullsFirst: false })
            .limit(50)

        if (brand && brand !== 'ALL') {
            dbQuery = dbQuery.eq('brand', brand)
        }
        if (type && type !== 'ALL') {
            dbQuery = dbQuery.eq('type', type)
        }

        const { data, error, count } = await dbQuery

        if (error) throw error

        // キャッシュが空の場合のフォールバック情報
        if (!data || data.length === 0) {
            // キャッシュにデータがあるか確認
            const { count: totalCount } = await supabase
                .from('shinsoku_items')
                .select('*', { count: 'exact', head: true })

            if (totalCount === 0) {
                return NextResponse.json({
                    success: true,
                    data: {
                        items: [],
                        total: 0,
                        cache_empty: true,
                        message: 'キャッシュが空です。/api/cron/shinsoku-sync を実行してください。',
                    },
                })
            }
        }

        return NextResponse.json({
            success: true,
            data: {
                items: (data || []).map(item => ({
                    item_id: item.item_id,
                    name: item.name,
                    type: item.type,
                    brand: item.brand,
                    tags: item.tags || [],
                    modelno: item.modelno,
                    rarity: item.rarity,
                    image_url: item.image_url,
                    is_full_amount: item.is_full_amount,
                    prices: {
                        s: item.price_s,
                        a: item.price_a,
                        am: item.price_am,
                        b: item.price_b,
                        c: item.price_c,
                    },
                })),
                total: (data || []).length,
            },
        })
    } catch (error: any) {
        console.error('Shinsoku search error:', error)
        return NextResponse.json({
            success: false,
            error: error.message,
        }, { status: 500 })
    }
}
