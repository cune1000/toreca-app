import { createClient, SupabaseClient } from '@supabase/supabase-js'

// =============================================================================
// Supabase Client
// =============================================================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
}

/** Supabaseクライアント（シングルトン） */
export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey)

/** サービスロールキー用クライアント（サーバーサイドのみ） */
export function createServiceClient(): SupabaseClient {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    console.error('[CRITICAL] SUPABASE_SERVICE_ROLE_KEY not set — falling back to anon key. RLS-enabled tables will fail!')
    return supabase
  }
  return createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

// =============================================================================
// Helper Functions
// =============================================================================

/** エラーハンドリング付きクエリ実行 */
export async function query<T>(
  queryFn: () => Promise<{ data: T | null; error: any }>
): Promise<{ data: T | null; error: string | null }> {
  try {
    const { data, error } = await queryFn()
    if (error) {
      console.error('Supabase query error:', error)
      return { data: null, error: error.message }
    }
    return { data, error: null }
  } catch (err: any) {
    console.error('Supabase query exception:', err)
    return { data: null, error: err.message || 'Unknown error' }
  }
}

/** バッチ挿入（大量データ用） */
export async function batchInsert<T extends Record<string, any>>(
  table: string,
  records: T[],
  batchSize: number = 100
): Promise<{ success: number; failed: number; errors: string[] }> {
  const result = { success: 0, failed: 0, errors: [] as string[] }

  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize)
    const { error } = await supabase.from(table).insert(batch)

    if (error) {
      result.failed += batch.length
      result.errors.push(`Batch ${i / batchSize + 1}: ${error.message}`)
    } else {
      result.success += batch.length
    }
  }

  return result
}

/** Upsert（存在すれば更新、なければ挿入） */
export async function upsertRecord<T extends Record<string, any>>(
  table: string,
  record: T,
  conflictColumns: string | string[]
): Promise<{ data: T | null; error: string | null }> {
  const columns = Array.isArray(conflictColumns) ? conflictColumns.join(',') : conflictColumns

  const { data, error } = await supabase
    .from(table)
    .upsert(record, { onConflict: columns })
    .select()
    .single()

  if (error) {
    return { data: null, error: error.message }
  }
  return { data: data as T, error: null }
}

// =============================================================================
// Table Names (typo防止)
// =============================================================================

export const TABLES = {
  // カード関連
  CARDS: 'cards',
  PURCHASE_PRICES: 'purchase_prices',
  SALE_PRICES: 'sale_prices',
  CARD_SALE_URLS: 'card_sale_urls',

  // 店舗・サイト
  PURCHASE_SHOPS: 'purchase_shops',
  SALE_SITES: 'sale_sites',

  // 保留
  PENDING_IMAGES: 'pending_images',
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
