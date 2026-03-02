// ============================================================================
// 紐づけページ共通型定義
// ============================================================================

/** 外部商品（3ソース共通） */
export interface ExternalItem {
  /** ソース側の一意ID */
  id: string
  /** 商品名 */
  name: string
  /** 型番（card_number照合用） */
  modelno: string | null
  /** 画像URL */
  imageUrl: string | null
  /** 価格（円） */
  price: number | null
  /** ソース固有の追加情報 */
  meta: Record<string, unknown>
  /** 紐づけ済みカードID（null=未紐づけ） */
  linkedCardId: string | null
  /** 紐づけ済みカード名 */
  linkedCardName: string | null
}

/** スニダン商品（ExternalItem拡張） */
export interface SnkrdunkItem extends ExternalItem {
  meta: {
    apparelId: number
    productNumber: string
    totalListingCount: number
    releasedAt: string | null
  }
}

/** シンソク商品（ExternalItem拡張） */
export interface ShinsokuItem extends ExternalItem {
  meta: {
    itemId: string
    brand: string
    rarity: string | null
    type: string
    priceS: number | null
    priceA: number | null
    priceAm: number | null
    priceB: number | null
    priceC: number | null
  }
}

/** ラウンジ商品（ExternalItem拡張） */
export interface LoungeItem extends ExternalItem {
  meta: {
    productId: string
    cardKey: string
    rarity: string
    grade: string
    productFormat: string
  }
}

/** DBカード検索結果 */
export interface LinkableCard {
  id: string
  name: string
  nameEn: string | null
  cardNumber: string | null
  expansion: string | null
  setCode: string | null
  imageUrl: string | null
  rarity: string | null
}

/** 自動マッチング候補 */
export interface MatchCandidate {
  card: LinkableCard
  score: number
  matchType: 'exact' | 'name' | 'partial' | 'modelno'
}

/** ソース設定 */
export interface SourceConfig {
  /** ソースキー */
  key: 'snkrdunk' | 'shinsoku' | 'lounge'
  /** 表示名 */
  label: string
  /** API商品一覧エンドポイント */
  itemsEndpoint: string
  /** 紐づけ先テーブル */
  linkTable: 'card_sale_urls' | 'card_purchase_links'
  /** 外部キーカラム名 */
  externalKeyColumn: string
  /** アクセントカラー */
  accentColor: string
  /** アクセントカラー（薄） */
  accentColorLight: string
}

/** ページネーション情報 */
export interface PaginationInfo {
  page: number
  perPage: number
  total: number
  totalPages: number
}

/** 紐づけ状態フィルタ */
export type LinkFilter = 'all' | 'linked' | 'unlinked'

/** ソート設定 */
export interface SortConfig {
  field: 'name' | 'price' | 'linked'
  order: 'asc' | 'desc'
}

/** 一括紐づけ進捗 */
export interface BulkLinkProgress {
  total: number
  processed: number
  linked: number
  skipped: number
  errors: number
  running: boolean
}

/** API商品一覧レスポンス */
export interface ItemsResponse {
  items: ExternalItem[]
  pagination: PaginationInfo
}
