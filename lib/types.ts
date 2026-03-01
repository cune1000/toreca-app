// =============================================================================
// Database Types (Supabaseテーブル対応)
// =============================================================================

/** カード */
export interface Card {
  id: string
  name: string
  image_url?: string
  card_number?: string
  rarity?: string
  rarity_id?: string
  expansion?: string
  illustrator?: string
  regulation?: string
  category_large_id?: string
  category_medium_id?: string
  category_small_id?: string
  category_detail_id?: string
  shinsoku_item_id?: string | null
  shinsoku_linked_at?: string | null
  pricecharting_id?: string | null
  pricecharting_name?: string | null
  set_code?: string | null
  name_en?: string | null
  set_name_en?: string | null
  release_year?: number | null
  justtcg_id?: string | null
  tcgplayer_id?: string | null
  pricecharting_url?: string | null
  created_at?: string
  updated_at?: string
}

/** カード（リレーション込み） */
export interface CardWithRelations extends Card {
  category_large?: { name: string; icon?: string }
  category_medium?: { name: string }
  category_small?: { name: string }
  category_detail?: { name: string }
  rarities?: { name: string }
}

/** 買取店舗 */
export interface Shop {
  id: string
  name: string
  icon?: string
  x_account?: string
  url?: string
  created_at?: string
}

/** 買取価格 */
export interface PurchasePrice {
  id: string
  card_id: string
  shop_id: string
  price: number
  condition?: string
  is_psa?: boolean
  psa_grade?: number
  recorded_at?: string
  tweet_time?: string
  source_image_url?: string
  created_at?: string
}

/** 販売価格 */
export interface SalePrice {
  id: string
  card_id: string
  site_id: string
  price: number
  product_url?: string
  created_at?: string
}

// =============================================================================
// PriceCharting / 海外価格関連
// =============================================================================

/** 海外価格（PriceCharting） */
export interface OverseasPrice {
  id: string
  card_id: string
  pricecharting_id: string
  loose_price_usd?: number | null   // ペニー単位
  cib_price_usd?: number | null
  new_price_usd?: number | null
  graded_price_usd?: number | null
  exchange_rate?: number | null       // USD/JPY
  loose_price_jpy?: number | null     // 円換算
  graded_price_jpy?: number | null
  recorded_at?: string
  created_at?: string
}

/** 為替レート */
export interface ExchangeRate {
  id: string
  base_currency: string
  target_currency: string
  rate: number
  recorded_at?: string
}

/** PriceCharting API 商品レスポンス */
export interface PriceChartingProduct {
  status: string
  id: string
  'product-name': string
  'console-name': string
  genre?: string
  'loose-price'?: number
  'cib-price'?: number
  'new-price'?: number
  'graded-price'?: number
  'bgs-10-price'?: number
  'manual-only-price'?: number
  'release-date'?: string
  'sales-volume'?: string
}

// =============================================================================
// 保留関連
// =============================================================================

/** 保留画像ステータス */
export type PendingImageStatus = 'pending' | 'processing' | 'completed' | 'failed'

/** 保留画像 */
export interface PendingImage {
  id: string
  shop_id: string
  image_url?: string
  image_base64?: string
  tweet_url?: string
  tweet_time?: string
  status: PendingImageStatus
  created_at?: string
  ai_result?: any    // ← 追加: AI解析結果
  // リレーション
  shop?: Shop
}

/** 保留カードステータス */
export type PendingCardStatus = 'pending' | 'matched' | 'saved'

/** 保留カード */
export interface PendingCard {
  id: string
  pending_image_id?: string
  shop_id: string
  card_image?: string
  ocr_text?: string
  recognized_name?: string
  matched_card_id?: string
  price?: number
  condition?: string
  status: PendingCardStatus
  tweet_time?: string
  created_at?: string
  // リレーション
  matched_card?: Card
  shop?: Shop
}

// =============================================================================
// API関連
// =============================================================================

/** API共通レスポンス */
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  meta?: Record<string, any>
}

/** ページネーション */
export interface PaginationParams {
  page?: number
  limit?: number
  orderBy?: string
  ascending?: boolean
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// =============================================================================
// カテゴリ関連
// =============================================================================

export interface CategoryLarge {
  id: string
  name: string
  icon?: string
  sort_order?: number
}

export interface CategoryMedium {
  id: string
  large_id: string
  name: string
  sort_order?: number
}

export interface CategorySmall {
  id: string
  medium_id: string
  name: string
  sort_order?: number
}

export interface CategoryDetail {
  id: string
  small_id: string
  name: string
  sort_order?: number
}

export interface Rarity {
  id: string
  large_id: string
  name: string
  sort_order?: number
}

// =============================================================================
// X自動監視システム関連
// =============================================================================

/** 取得済みツイート */
export interface FetchedTweet {
  id: string
  tweet_id: string
  shop_id: string
  is_purchase_related: boolean
  fetched_at: string
  created_at: string
}

/** 店舗監視設定 */
export interface ShopMonitorSetting {
  shop_id: string
  is_active: boolean
  last_checked_at?: string
  last_tweet_id?: string
  created_at: string
  updated_at: string
  // リレーション
  shop?: Shop
}
