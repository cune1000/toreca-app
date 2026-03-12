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

/**
 * Supabaseの1000行制限を回避するページネーション取得
 * queryBuilder は .range() で消費されるため、毎回新しいクエリを生成する関数を渡す
 */
export async function fetchAllPaginated<T = any>(
  buildQuery: () => any,
  pageSize = 1000
): Promise<T[]> {
  const allData: T[] = []
  let offset = 0
  while (true) {
    const { data: page, error } = await buildQuery().range(offset, offset + pageSize - 1)
    if (error) {
      console.error('fetchAllPaginated error:', error.message)
      break
    }
    if (!page || page.length === 0) break
    allData.push(...page)
    if (page.length < pageSize) break
    offset += pageSize
  }
  return allData
}

// NOTE: query(), batchInsert(), upsertRecord() ヘルパーは未使用のため削除済み (2026-03-09)
// 必要になった場合は git history から復元可能

export default supabase
