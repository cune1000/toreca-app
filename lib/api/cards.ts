import { supabase, TABLES } from '../supabase'
import { buildKanaSearchFilter, toKatakana, containsHiragana } from '../utils/kana'
import type {
  Card,
  CardWithRelations,
  PurchasePrice,
  SalePrice,
  CardCandidate,
  PaginationParams,
  PaginatedResponse
} from '../types'

// =============================================================================
// Cards CRUD
// =============================================================================

/** カード一覧を取得 */
export async function getCards(options?: {
  search?: string
  categoryLargeId?: string
  rarityId?: string
  limit?: number
}): Promise<CardWithRelations[]> {
  let query = supabase
    .from(TABLES.CARDS)
    .select(`
      *,
      category_large:category_large_id(name, icon),
      category_detail:category_detail_id(name),
      rarities:rarity_id(name)
    `)
    .order('created_at', { ascending: false })

  if (options?.search) {
    query = query.or(buildKanaSearchFilter(options.search, ['name', 'card_number']))
  }

  if (options?.categoryLargeId) {
    query = query.eq('category_large_id', options.categoryLargeId)
  }

  if (options?.rarityId) {
    query = query.eq('rarity_id', options.rarityId)
  }

  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query

  if (error) {
    console.error('Error fetching cards:', error)
    return []
  }

  return data || []
}

/** カード一覧を取得（ページネーション付き） */
export async function getCardsPaginated(
  params: PaginationParams & {
    search?: string
    categoryLargeId?: string
    rarityId?: string
  }
): Promise<PaginatedResponse<CardWithRelations>> {
  const { page = 1, limit = 20, search, categoryLargeId, rarityId } = params
  const offset = (page - 1) * limit

  let query = supabase
    .from(TABLES.CARDS)
    .select(`
      *,
      category_large:category_large_id(name, icon),
      rarities:rarity_id(name)
    `, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (search) {
    query = query.or(buildKanaSearchFilter(search, ['name', 'card_number']))
  }

  if (categoryLargeId) {
    query = query.eq('category_large_id', categoryLargeId)
  }

  if (rarityId) {
    query = query.eq('rarity_id', rarityId)
  }

  const { data, error, count } = await query

  if (error) {
    console.error('Error fetching cards paginated:', error)
    return { data: [], total: 0, page, limit, totalPages: 0 }
  }

  const total = count || 0

  return {
    data: data || [],
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit)
  }
}

/** カード1件取得 */
export async function getCard(id: string): Promise<CardWithRelations | null> {
  const { data, error } = await supabase
    .from(TABLES.CARDS)
    .select(`
      *,
      category_large:category_large_id(name, icon),
      category_medium:category_medium_id(name),
      category_small:category_small_id(name),
      category_detail:category_detail_id(name),
      rarities:rarity_id(name)
    `)
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching card:', error)
    return null
  }

  return data
}

/** カード追加 */
export async function addCard(card: Omit<Card, 'id' | 'created_at' | 'updated_at'>): Promise<{ data: Card | null; error: string | null }> {
  const { data, error } = await supabase
    .from(TABLES.CARDS)
    .insert([card])
    .select()
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  return { data, error: null }
}

/** カード更新 */
export async function updateCard(
  id: string,
  updates: Partial<Card>
): Promise<{ data: Card | null; error: string | null }> {
  const { data, error } = await supabase
    .from(TABLES.CARDS)
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  return { data, error: null }
}

/** カード削除 */
export async function deleteCard(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from(TABLES.CARDS)
    .delete()
    .eq('id', id)

  if (error) {
    return { error: error.message }
  }

  return { error: null }
}

// =============================================================================
// Card Search (マッチング用)
// =============================================================================

/** カード名で検索（あいまい検索） */
export async function searchCards(query: string, limit: number = 20): Promise<CardCandidate[]> {
  if (!query || query.length < 2) {
    return []
  }

  // 1. 通常検索（元のクエリで検索）
  const { data: exactData, error: exactError } = await supabase
    .from(TABLES.CARDS)
    .select('id, name, image_url, card_number, rarity, expansion')
    .or(buildKanaSearchFilter(query, ['name', 'card_number']))
    .limit(limit)

  if (exactError) {
    console.error('Error searching cards:', exactError)
    return []
  }

  // 2. 接尾辞を除外した検索（GX/ex/V/VMAX/VSTAR/VUNION等を除外）
  const baseName = query
    .replace(/\s*(GX|ex|EX|V|VMAX|VSTAR|VUNION|SA|SR|UR|HR|RR|RRR|AR|SAR)\s*$/i, '')
    .trim()

  let additionalData: any[] = []

  // 基本名が元のクエリと異なる場合のみ追加検索
  if (baseName && baseName.toLowerCase() !== query.toLowerCase()) {
    const { data: baseData, error: baseError } = await supabase
      .from(TABLES.CARDS)
      .select('id, name, image_url, card_number, rarity, expansion')
      .ilike('name', `%${baseName}%`)
      .limit(limit)

    if (!baseError && baseData) {
      additionalData = baseData
    }
  }

  // 結果をマージ（重複を除外）
  const allData = [...(exactData || []), ...additionalData]
  const uniqueData = Array.from(
    new Map(allData.map(item => [item.id, item])).values()
  )

  return uniqueData.slice(0, limit).map(c => ({
    id: c.id,
    name: c.name,
    cardNumber: c.card_number,
    imageUrl: c.image_url,
    rarity: c.rarity,
    expansion: c.expansion,
    similarity: 100, // 検索結果なので100%
    isExactMatch: c.name.toLowerCase() === query.toLowerCase()
  }))
}

/** 型番で検索（完全一致優先） */
export async function searchByCardNumber(cardNumber: string): Promise<CardCandidate[]> {
  const { data, error } = await supabase
    .from(TABLES.CARDS)
    .select('id, name, image_url, card_number, rarity, expansion')
    .ilike('card_number', `%${cardNumber}%`)
    .limit(10)

  if (error) {
    console.error('Error searching by card number:', error)
    return []
  }

  return (data || []).map(c => ({
    id: c.id,
    name: c.name,
    cardNumber: c.card_number,
    imageUrl: c.image_url,
    rarity: c.rarity,
    expansion: c.expansion,
    similarity: c.card_number === cardNumber ? 100 : 90,
    isExactMatch: c.card_number === cardNumber
  }))
}

/** 画像URLで存在確認 */
export async function checkCardExistsByImageUrl(imageUrl: string): Promise<boolean> {
  const { data, error } = await supabase
    .from(TABLES.CARDS)
    .select('id')
    .eq('image_url', imageUrl)
    .limit(1)

  return (data && data.length > 0) || false
}

// =============================================================================
// Purchase Prices (買取価格)
// =============================================================================

/** カードの買取価格一覧を取得 */
export async function getPurchasePrices(cardId: string): Promise<PurchasePrice[]> {
  const { data, error } = await supabase
    .from(TABLES.PURCHASE_PRICES)
    .select(`
      *,
      shop:shop_id(name, icon)
    `)
    .eq('card_id', cardId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching purchase prices:', error)
    return []
  }

  return data || []
}

/** 買取価格を追加 */
export async function addPurchasePrice(price: Omit<PurchasePrice, 'id' | 'created_at'>): Promise<{ data: PurchasePrice | null; error: string | null }> {
  const { data, error } = await supabase
    .from(TABLES.PURCHASE_PRICES)
    .insert([price])
    .select()
    .single()

  if (error) {
    return { data: null, error: error.message }
  }

  return { data, error: null }
}

/** 買取価格を一括追加 */
export async function addPurchasePrices(
  prices: Omit<PurchasePrice, 'id' | 'created_at'>[]
): Promise<{ success: number; failed: number }> {
  const { error } = await supabase
    .from(TABLES.PURCHASE_PRICES)
    .insert(prices)

  if (error) {
    console.error('Error adding purchase prices:', error)
    return { success: 0, failed: prices.length }
  }

  return { success: prices.length, failed: 0 }
}

// =============================================================================
// Sale Prices (販売価格)
// =============================================================================

/** カードの販売価格一覧を取得 */
export async function getSalePrices(cardId: string): Promise<SalePrice[]> {
  const { data, error } = await supabase
    .from(TABLES.SALE_PRICES)
    .select(`
      *,
      site:site_id(name, icon, url)
    `)
    .eq('card_id', cardId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching sale prices:', error)
    return []
  }

  return data || []
}

// =============================================================================
// Card Sale URLs
// =============================================================================

/** カードの販売URL一覧を取得 */
export async function getCardSaleUrls(cardId: string) {
  const { data, error } = await supabase
    .from(TABLES.CARD_SALE_URLS)
    .select(`
      *,
      site:site_id(name, icon, url)
    `)
    .eq('card_id', cardId)

  if (error) {
    console.error('Error fetching card sale URLs:', error)
    return []
  }

  return data || []
}

/** 販売URL追加/更新 */
export async function upsertCardSaleUrl(
  cardId: string,
  siteId: string,
  productUrl: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from(TABLES.CARD_SALE_URLS)
    .upsert({
      card_id: cardId,
      site_id: siteId,
      product_url: productUrl
    }, {
      onConflict: 'card_id,site_id'
    })

  if (error) {
    return { error: error.message }
  }

  return { error: null }
}
