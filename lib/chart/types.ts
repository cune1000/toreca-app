// チャートサイト用型定義
// 独立時にAPI仕様としてそのまま使える

export interface ChartCard {
    id: string
    name: string
    image_url: string
    category: string
    subcategory?: string
    rarity: string
    card_number?: string
    set_name?: string
    avg_price: number
    price_change_24h: number     // %
    price_change_7d: number      // %
    price_change_30d: number     // %
    purchase_price_avg?: number  // 買取平均
}

export interface CardDetail extends ChartCard {
    illustrator?: string
    regulation?: string
    high_price: number
    low_price: number
}

export interface PricePoint {
    date: string       // YYYY-MM-DD
    avg_price: number
    purchase_avg?: number
}

export interface PurchaseShopPrice {
    shop_name: string
    shop_icon?: string
    price: number
    change_pct?: number
    updated_at: string
}

export interface RankingDef {
    id: string
    label: string
    icon: string
    category: string
    color: string
    dataSource: 'sale' | 'purchase' | 'psa' | 'box' | 'condition_a'
    sortBy: 'change_pct_desc' | 'change_pct_asc' | 'change_yen_desc' | 'change_yen_asc' | 'price_desc'
    comingSoon?: boolean
}

export interface Category {
    slug: string
    name: string
    card_count?: number
}
