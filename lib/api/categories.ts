import { supabase } from '../supabase'

// =============================================================================
// Types
// =============================================================================

export interface CategoryLarge {
  id: string
  name: string
  icon?: string
  sort_order: number
}

export interface CategoryMedium {
  id: string
  large_id: string
  name: string
  sort_order: number
}

export interface CategorySmall {
  id: string
  medium_id: string
  name: string
  sort_order: number
}

export interface Rarity {
  id: string
  large_id: string
  name: string
  sort_order: number
}

type CategoryType = 'large' | 'medium' | 'small' | 'rarity'

// =============================================================================
// Read Operations
// =============================================================================

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

/** 中カテゴリを取得 */
export async function getMediumCategories(largeId: string): Promise<CategoryMedium[]> {
  const { data, error } = await supabase
    .from('category_medium')
    .select('*')
    .eq('large_id', largeId)
    .order('sort_order')

  if (error) {
    console.error('Error fetching medium categories:', error)
    return []
  }

  return data || []
}

/** 小カテゴリを取得 */
export async function getSmallCategories(mediumId: string): Promise<CategorySmall[]> {
  const { data, error } = await supabase
    .from('category_small')
    .select('*')
    .eq('medium_id', mediumId)
    .order('sort_order')

  if (error) {
    console.error('Error fetching small categories:', error)
    return []
  }

  return data || []
}

/** レアリティを取得 */
export async function getRarities(largeId: string): Promise<Rarity[]> {
  const { data, error } = await supabase
    .from('rarities')
    .select('*')
    .eq('large_id', largeId)
    .order('sort_order')

  if (error) {
    console.error('Error fetching rarities:', error)
    return []
  }

  return data || []
}

// =============================================================================
// Write Operations
// =============================================================================

const TABLE_MAP: Record<CategoryType, string> = {
  large: 'category_large',
  medium: 'category_medium',
  small: 'category_small',
  rarity: 'rarities'
}

const PARENT_FIELD_MAP: Record<CategoryType, string | null> = {
  large: null,
  medium: 'large_id',
  small: 'medium_id',
  rarity: 'large_id'
}

/** カテゴリを追加 */
export async function addCategory(
  type: CategoryType,
  data: { name: string; icon?: string; parentId?: string; sortOrder?: number }
): Promise<{ success: boolean; error?: string }> {
  const table = TABLE_MAP[type]
  const parentField = PARENT_FIELD_MAP[type]
  
  const insertData: Record<string, any> = { name: data.name }
  
  if (type === 'large' && data.icon) {
    insertData.icon = data.icon
  }
  
  if (parentField && data.parentId) {
    insertData[parentField] = data.parentId
  }
  
  if (data.sortOrder !== undefined) {
    insertData.sort_order = data.sortOrder
  }

  const { error } = await supabase.from(table).insert([insertData])

  if (error) {
    console.error(`Error adding ${type} category:`, error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

/** カテゴリを更新 */
export async function updateCategory(
  type: CategoryType,
  id: string,
  data: { name?: string; icon?: string }
): Promise<{ success: boolean; error?: string }> {
  const table = TABLE_MAP[type]
  
  const updateData: Record<string, any> = {}
  if (data.name !== undefined) updateData.name = data.name
  if (type === 'large' && data.icon !== undefined) updateData.icon = data.icon

  const { error } = await supabase.from(table).update(updateData).eq('id', id)

  if (error) {
    console.error(`Error updating ${type} category:`, error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

/** カテゴリを削除 */
export async function deleteCategory(
  type: CategoryType,
  id: string
): Promise<{ success: boolean; error?: string }> {
  const table = TABLE_MAP[type]

  const { error } = await supabase.from(table).delete().eq('id', id)

  if (error) {
    console.error(`Error deleting ${type} category:`, error)
    return { success: false, error: error.message }
  }

  return { success: true }
}

/** カテゴリの並び順を更新 */
export async function reorderCategories(
  type: CategoryType,
  items: Array<{ id: string; sort_order: number }>
): Promise<{ success: boolean; error?: string }> {
  const table = TABLE_MAP[type]

  // Batch update sort orders
  for (const item of items) {
    const { error } = await supabase
      .from(table)
      .update({ sort_order: item.sort_order })
      .eq('id', item.id)

    if (error) {
      console.error(`Error reordering ${type} category:`, error)
      return { success: false, error: error.message }
    }
  }

  return { success: true }
}

// =============================================================================
// Combined Operations
// =============================================================================

/** 中カテゴリとレアリティを同時に取得 */
export async function getMediumAndRarities(largeId: string): Promise<{
  mediumCategories: CategoryMedium[]
  rarities: Rarity[]
}> {
  const [mediumResult, rarityResult] = await Promise.all([
    getMediumCategories(largeId),
    getRarities(largeId)
  ])

  return {
    mediumCategories: mediumResult,
    rarities: rarityResult
  }
}
