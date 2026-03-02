import type { SourceConfig } from './types'

// ============================================================================
// 3ソース設定
// ============================================================================

export const SOURCE_CONFIGS: Record<string, SourceConfig> = {
  snkrdunk: {
    key: 'snkrdunk',
    label: 'スニダン',
    itemsEndpoint: '/api/linking/snkrdunk/items',
    linkTable: 'card_sale_urls',
    externalKeyColumn: 'apparel_id',
    accentColor: '#10b981',      // green (スニダンカラー)
    accentColorLight: '#d1fae5',
  },
  shinsoku: {
    key: 'shinsoku',
    label: 'シンソク',
    itemsEndpoint: '/api/linking/shinsoku/items',
    linkTable: 'card_purchase_links',
    externalKeyColumn: 'external_key',
    accentColor: '#3b82f6',      // blue
    accentColorLight: '#dbeafe',
  },
  lounge: {
    key: 'lounge',
    label: 'トレカラウンジ',
    itemsEndpoint: '/api/linking/lounge/items',
    linkTable: 'card_purchase_links',
    externalKeyColumn: 'external_key',
    accentColor: '#8b5cf6',      // purple
    accentColorLight: '#ede9fe',
  },
}

// ============================================================================
// 紐づけ状態フィルタ
// ============================================================================

export const LINK_FILTER_OPTIONS = [
  { key: 'all' as const, label: 'すべて' },
  { key: 'unlinked' as const, label: '未紐づけ' },
  { key: 'linked' as const, label: '紐づけ済み' },
]

// ============================================================================
// ソート
// ============================================================================

export const SORT_OPTIONS = [
  { field: 'name' as const, label: '名前' },
  { field: 'price' as const, label: '価格' },
  { field: 'linked' as const, label: '紐づけ状態' },
]

// ============================================================================
// ページネーション
// ============================================================================

export const DEFAULT_PER_PAGE = 100

// ============================================================================
// 自動マッチング
// ============================================================================

/** 一括紐づけ閾値（このスコア以上で自動紐づけ） */
export const AUTO_LINK_THRESHOLD = 90

/** マッチングスコア定義 */
export const MATCH_SCORES = {
  /** 名前+型番完全一致 */
  EXACT: 100,
  /** 名前完全一致（型番なし） */
  NAME_EXACT: 85,
  /** 型番一致（名前なし） */
  MODELNO_ONLY: 70,
  /** 部分一致の最低スコア */
  PARTIAL_MIN: 60,
  /** 部分一致の最高スコア */
  PARTIAL_MAX: 80,
}
