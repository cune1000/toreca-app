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

/** 販売サイト */
export interface SaleSite {
  id: string
  name: string
  icon?: string
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
// 認識関連
// =============================================================================

/** カード状態 */
export type CardCondition = 'normal' | 'psa' | 'sealed' | 'opened'

export const CONDITION_OPTIONS = [
  { value: 'normal' as const, label: '素体', color: 'bg-gray-100 text-gray-700' },
  { value: 'psa' as const, label: 'PSA', color: 'bg-purple-100 text-purple-700' },
  { value: 'sealed' as const, label: '未開封', color: 'bg-blue-100 text-blue-700' },
  { value: 'opened' as const, label: '開封済み', color: 'bg-orange-100 text-orange-700' },
] as const

/** Grounding情報（Google検索連携結果） */
export interface GroundingInfo {
  official_name?: string
  card_number?: string
  expansion?: string
  rarity?: string
  confidence?: 'high' | 'medium' | 'low'
  notes?: string
  search_queries?: string[]
  sources?: { url: string; title: string }[]
}

/** カード候補（DB検索結果） */
export interface CardCandidate {
  id: string
  name: string
  cardNumber?: string
  imageUrl?: string
  rarity?: string
  expansion?: string
  similarity: number
  isExactMatch: boolean
}

/** 認識結果カード（BulkRecognition用） */
export interface RecognizedCard {
  index: number
  price?: number
  quantity?: number
  name?: string
  ocrText?: string
  matchedCard: CardCandidate | null
  candidates: CardCandidate[]
  needsReview: boolean
  excluded?: boolean
  condition: CardCondition
  grounding?: GroundingInfo | null
}

/** Gemini認識APIレスポンス */
export interface GeminiRecognitionResult {
  cards: Array<{
    index: number
    name: string
    quantity?: number
    price: number
    bounding_box?: {
      x: number
      y: number
      width: number
      height: number
    }
    raw_text?: string
    grounding?: GroundingInfo
  }>
  layout?: {
    type: string
    rows: number
    cols: number
    total_detected: number
  }
  shop_info?: {
    name?: string
    date?: string
  }
  is_psa: boolean
  psa_info?: {
    detected: boolean
    grades_found: string[]
  }
  grounding_stats?: {
    total: number
    high_confidence: number
    success_rate: number
  }
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
