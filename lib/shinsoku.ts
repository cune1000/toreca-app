// lib/shinsoku.ts
// シンソク買取API連携ライブラリ

const SHINSOKU_API_BASE = 'https://shinsoku-tcg.com/api'

export interface ShinsokuItem {
    id: string
    item_id: string
    name: string
    name_processed: string
    type: string // PSA, BOX, NORMAL, CARTON, PACK
    brand: string
    rarity: string
    tags: { id: number; slug: string; label: string; category_label: string }[]
    is_postal_buy_target: boolean
    is_full_amount_flag: boolean
    postal_purchase_price_s: number | null
    postal_purchase_price_a: number | null
    postal_purchase_price_am: number | null
    postal_purchase_price_b: number | null
    postal_purchase_price_c: number | null
    image_url_public: string
    modelno?: string
}

export interface ShinsokuResponse {
    ok: boolean
    data: {
        items: ShinsokuItem[]
        has_more: boolean
    }
}

/**
 * シンソクAPIから商品を取得（ページネーション対応）
 * 全件取得してからフィルタリングする方式
 */
export async function fetchShinsokuItems(
    brand: string = 'ポケモン',
    type: string = 'ALL',
    maxPages: number = 50
): Promise<ShinsokuItem[]> {
    const allItems: ShinsokuItem[] = []
    let page = 0
    let hasMore = true

    while (hasMore && page < maxPages) {
        const params = new URLSearchParams({
            postal_only: 'true',
            sort: 'price_desc',
            type,
            brand,
            page: page.toString(),
            limit: '100',
        })

        const res = await fetch(`${SHINSOKU_API_BASE}/items?${params}`)
        if (!res.ok) break

        const json: ShinsokuResponse = await res.json()
        if (!json.ok) break

        allItems.push(...json.data.items)
        hasMore = json.data.has_more
        page++

        // レート制限対策: 200ms待機
        await new Promise(r => setTimeout(r, 200))
    }

    return allItems
}

/**
 * 価格を円に変換（API値 ÷ 100）
 * シンソクAPIは0.01円単位で返す
 */
export function toYen(price: number | null): number | null {
    if (price === null || price === undefined) return null
    return Math.round(price / 100)
}

/**
 * シンソク商品を名前で検索（部分一致）
 */
export function searchItems(items: ShinsokuItem[], query: string): ShinsokuItem[] {
    if (!query.trim()) return items
    const q = query.toLowerCase()
    return items.filter(item =>
        item.name.toLowerCase().includes(q) ||
        item.name_processed.toLowerCase().includes(q) ||
        (item.modelno && item.modelno.toLowerCase().includes(q))
    )
}

/**
 * ブランド一覧を取得
 */
export async function fetchBrands(): Promise<string[]> {
    try {
        const res = await fetch(`${SHINSOKU_API_BASE}/brands?context=yuso`)
        if (!res.ok) return ['ポケモン']
        const json = await res.json()
        return json.data?.brands?.map((b: any) => b.name || b) || ['ポケモン']
    } catch {
        return ['ポケモン']
    }
}
