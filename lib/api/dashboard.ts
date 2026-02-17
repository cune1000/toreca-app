import { supabase, TABLES } from '../supabase'
import { buildKanaSearchFilter } from '../utils/kana'

// =============================================================================
// Dashboard Stats (ダッシュボード統計)
// =============================================================================

export interface DashboardStats {
  cards: number
  shops: number
  sites: number
  pending: number
}

export interface CronStats {
  success: number
  errors: number
  changes: number
}

export interface PriceChange {
  card_sale_url_id?: string
  card_name: string
  site_name: string
  old_price: number | null
  new_price: number | null
  executed_at: string
}

export interface RecentCard {
  id: string
  name: string
  card_number?: string
  created_at: string
}

/** ダッシュボード統計を取得 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const [cardResult, shopResult, siteResult, pendingResult] = await Promise.all([
    supabase.from(TABLES.CARDS).select('*', { count: 'exact', head: true }),
    supabase.from(TABLES.PURCHASE_SHOPS).select('*', { count: 'exact', head: true }),
    supabase.from(TABLES.SALE_SITES).select('*', { count: 'exact', head: true }),
    supabase.from(TABLES.PENDING_IMAGES).select('*', { count: 'exact', head: true }).eq('status', 'pending')
  ])

  return {
    cards: cardResult.count || 0,
    shops: shopResult.count || 0,
    sites: siteResult.count || 0,
    pending: pendingResult.count || 0
  }
}

/** 最近登録されたカードを取得 */
export async function getRecentCards(limit: number = 50): Promise<RecentCard[]> {
  const { data, error } = await supabase
    .from(TABLES.CARDS)
    .select('id, name, card_number, created_at')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching recent cards:', error)
    return []
  }

  return data || []
}

/** 価格変動履歴を取得（指定時間内） */
export async function getPriceChanges(hours: number = 24, limit: number = 10): Promise<PriceChange[]> {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('cron_logs')
    .select('card_sale_url_id, card_name, site_name, old_price, new_price, executed_at')
    .eq('price_changed', true)
    .gte('executed_at', cutoff)
    .order('executed_at', { ascending: false })
    .limit(limit)

  if (error) {
    console.error('Error fetching price changes:', error)
    return []
  }

  return data || []
}

/** Cron統計を取得（指定時間内） */
export async function getCronStats(hours: number = 24): Promise<CronStats> {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('cron_logs')
    .select('status, price_changed')
    .gte('executed_at', cutoff)

  if (error) {
    console.error('Error fetching cron stats:', error)
    return { success: 0, errors: 0, changes: 0 }
  }

  const logs = data || []
  return {
    success: logs.filter(l => l.status === 'success').length,
    errors: logs.filter(l => l.status === 'error').length,
    changes: logs.filter(l => l.price_changed).length
  }
}

/** カード検索（Aランク・PSA10価格付き） */
export async function searchCardsForDashboard(
  query: string,
  limit: number = 10
): Promise<Array<{
  id: string
  name: string
  card_number?: string
  image_url?: string
  price_a?: number
  price_a_date?: string
  price_psa10?: number
  price_psa10_date?: string
}>> {
  if (!query || query.length < 2) return []

  const { data, error } = await supabase
    .from(TABLES.CARDS)
    .select('id, name, card_number, image_url')
    .or(buildKanaSearchFilter(query, ['name', 'card_number']))
    .limit(limit)

  if (error) {
    console.error('Error searching cards:', error)
    return []
  }

  if (!data || data.length === 0) return []

  // 各カードの最新スニダン価格を取得（Aランク・PSA10それぞれ）
  const cardIds = data.map(c => c.id)
  const { data: salesData } = await supabase
    .from('snkrdunk_sales_history')
    .select('card_id, price, grade, sold_at')
    .in('card_id', cardIds)
    .order('sold_at', { ascending: false })

  // カードごとにAランク・PSA10の最新価格を取得
  const pricesByCard: Record<string, {
    a?: { price: number; date: string }
    psa10?: { price: number; date: string }
  }> = {}

  for (const sale of (salesData || [])) {
    if (!pricesByCard[sale.card_id]) {
      pricesByCard[sale.card_id] = {}
    }
    const gradeUpper = (sale.grade || '').toUpperCase()
    if (gradeUpper === 'A' && !pricesByCard[sale.card_id].a) {
      pricesByCard[sale.card_id].a = { price: sale.price, date: sale.sold_at }
    }
    if (gradeUpper === 'PSA10' && !pricesByCard[sale.card_id].psa10) {
      pricesByCard[sale.card_id].psa10 = { price: sale.price, date: sale.sold_at }
    }
  }

  return data.map(card => ({
    ...card,
    price_a: pricesByCard[card.id]?.a?.price,
    price_a_date: pricesByCard[card.id]?.a?.date,
    price_psa10: pricesByCard[card.id]?.psa10?.price,
    price_psa10_date: pricesByCard[card.id]?.psa10?.date
  }))
}

// =============================================================================
// Categories for Dashboard
// =============================================================================

export interface CategoryLarge {
  id: string
  name: string
  icon?: string
  sort_order: number
}

/** 大カテゴリを取得 */
export async function getLargeCategories(): Promise<CategoryLarge[]> {
  const { data, error } = await supabase
    .from('category_large')
    .select('*')
    .order('sort_order')

  if (error) {
    console.error('Error fetching large categories:', error)
    return []
  }

  return data || []
}

/** 販売サイト一覧を取得 */
export async function getAllSaleSites(): Promise<Array<{ id: string; name: string; icon?: string; url?: string }>> {
  const { data, error } = await supabase
    .from(TABLES.SALE_SITES)
    .select('*')

  if (error) {
    console.error('Error fetching sale sites:', error)
    return []
  }

  return data || []
}
