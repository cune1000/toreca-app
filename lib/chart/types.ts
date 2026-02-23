// チャートサイト用型定義
// 海外相場（PriceCharting）ベース

export interface ChartCard {
    id: string
    name: string
    image_url: string
    category: string
    rarity: string
    card_number?: string
    // 海外相場（メイン）
    loose_price_jpy: number
    loose_price_usd: number       // ペニー単位
    graded_price_jpy?: number
    graded_price_usd?: number     // ペニー単位
    // 変動率（表示中のpriceTypeに応じた値）
    price_change_24h: number
    price_change_7d: number
    price_change_30d: number
    // 表示用
    display_price: number         // ランキングのpriceTypeに応じたJPY価格
    display_price_usd: number     // 同USD（ペニー）
}

export interface CardDetail extends ChartCard {
    pricecharting_id?: string | null
    pricecharting_url?: string | null
    high_price: number
    low_price: number
    // 買取価格（条件別最高値）
    purchase_loose_best?: number
    purchase_psa10_best?: number
    // 店舗別買取一覧
    purchase_prices: PurchaseShopPrice[]
}

export interface PricePoint {
    date: string       // YYYY-MM-DD
    loose_price_jpy: number
    loose_price_usd: number
    graded_price_jpy: number
    graded_price_usd: number
}

export interface PurchaseShopPrice {
    shop_name: string
    shop_icon?: string
    condition: string   // '素体', 'PSA10', '未開封' etc.
    price: number
    updated_at: string
}

export interface RankingDef {
    id: string
    label: string
    icon: string
    category: string
    color: string
    priceType: 'loose' | 'graded'
    sortBy: 'change_pct_desc' | 'change_pct_asc' | 'price_desc'
    comingSoon?: boolean
}

export interface Category {
    slug: string
    name: string
    card_count?: number
}
