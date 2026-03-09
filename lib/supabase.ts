import { createClient, SupabaseClient } from '@supabase/supabase-js'

// =============================================================================
// Supabase Client
// =============================================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
}

// ダミーキーをフォールバックとして渡すことで、Vercelのビルド時（ENV未設定時）に
// `supabaseUrl is required` エラーでビルドが落ちるのを防ぐ
export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://dummy.supabase.co',
  supabaseAnonKey || 'dummy'
)

/** サービスロールキー用クライアント（サーバーサイドのみ） */
export function createServiceClient(): SupabaseClient {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    console.error('[CRITICAL] SUPABASE_SERVICE_ROLE_KEY not set — falling back to anon key. RLS-enabled tables will fail!')
    return supabase
  }
  return createClient(
    supabaseUrl || 'https://dummy.supabase.co',
    serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// =============================================================================
// Helper Functions
// =============================================================================

// NOTE: query(), batchInsert(), upsertRecord() ヘルパーは未使用のため削除済み (2026-03-09)
// 必要になった場合は git history から復元可能

// =============================================================================
// Table Names (typo防止)
// =============================================================================

export const TABLES = {
  // カード関連
  CARDS: 'cards',
  PURCHASE_PRICES: 'purchase_prices',
  SALE_PRICES: 'sale_prices',
  CARD_SALE_URLS: 'card_sale_urls',

  // 店舗
  PURCHASE_SHOPS: 'purchase_shops',

  // 保留
  PENDING_CARDS: 'pending_cards',

  // カテゴリ
  CATEGORY_LARGE: 'category_large',
  CATEGORY_MEDIUM: 'category_medium',
  CATEGORY_SMALL: 'category_small',
  CATEGORY_DETAIL: 'category_detail',
  RARITIES: 'rarities',

  // X自動監視システム
  FETCHED_TWEETS: 'fetched_tweets',
  SHOP_MONITOR_SETTINGS: 'shop_monitor_settings',

  // PriceCharting / 海外価格
  OVERSEAS_PRICES: 'overseas_prices',
  EXCHANGE_RATES: 'exchange_rates',
} as const

export type TableName = typeof TABLES[keyof typeof TABLES]

export default supabase
