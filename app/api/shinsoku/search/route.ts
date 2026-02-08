import { NextRequest, NextResponse } from 'next/server'
import { fetchShinsokuItems, searchItems, toYen } from '@/lib/shinsoku'

// シンソク商品検索API
// GET /api/shinsoku/search?q=リザードン&brand=ポケモン&type=ALL
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const query = searchParams.get('q') || ''
        const brand = searchParams.get('brand') || 'ポケモン'
        const type = searchParams.get('type') || 'ALL'

        if (!query || query.length < 2) {
            return NextResponse.json({
                success: false,
                error: '検索キーワードは2文字以上必要です',
            }, { status: 400 })
        }

        // シンソクAPIから全商品を取得
        const allItems = await fetchShinsokuItems(brand, type)

        // 名前でフィルタリング
        const filtered = searchItems(allItems, query)

        return NextResponse.json({
            success: true,
            data: {
                items: filtered.slice(0, 50).map(item => ({
                    item_id: item.item_id,
                    name: item.name,
                    type: item.type,
                    brand: item.brand,
                    tags: item.tags,
                    modelno: item.modelno,
                    rarity: item.rarity,
                    image_url: item.image_url_public,
                    is_full_amount: item.is_full_amount_flag,
                    prices: {
                        s: toYen(item.postal_purchase_price_s),
                        a: toYen(item.postal_purchase_price_a),
                        am: toYen(item.postal_purchase_price_am),
                        b: toYen(item.postal_purchase_price_b),
                        c: toYen(item.postal_purchase_price_c),
                    },
                })),
                total: filtered.length,
                fetched: allItems.length,
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
