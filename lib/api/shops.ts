import { supabase, TABLES } from '../supabase'
import type { Shop } from '../types'

// =============================================================================
// Purchase Shops (買取店舗)
// =============================================================================

/** 買取店舗一覧を取得 */
export async function getShops(): Promise<Shop[]> {
  const { data, error } = await supabase
    .from(TABLES.PURCHASE_SHOPS)
    .select('*')
    .order('name')
  
  if (error) {
    console.error('Error fetching shops:', error)
    return []
  }
  
  return data || []
}

/** 買取店舗を取得（ID指定） */
export async function getShop(id: string): Promise<Shop | null> {
  const { data, error } = await supabase
    .from(TABLES.PURCHASE_SHOPS)
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) {
    console.error('Error fetching shop:', error)
    return null
  }
  
  return data
}

/** 買取店舗を追加 */
export async function addShop(shop: Omit<Shop, 'id' | 'created_at'>): Promise<{ data: Shop | null; error: string | null }> {
  const { data, error } = await supabase
    .from(TABLES.PURCHASE_SHOPS)
    .insert([shop])
    .select()
    .single()
  
  if (error) {
    return { data: null, error: error.message }
  }
  
  return { data, error: null }
}

/** 買取店舗を更新 */
export async function updateShop(
  id: string, 
  updates: Partial<Shop>
): Promise<{ data: Shop | null; error: string | null }> {
  const { data, error } = await supabase
    .from(TABLES.PURCHASE_SHOPS)
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  
  if (error) {
    return { data: null, error: error.message }
  }
  
  return { data, error: null }
}

/** 買取店舗を削除 */
export async function deleteShop(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from(TABLES.PURCHASE_SHOPS)
    .delete()
    .eq('id', id)
  
  if (error) {
    return { error: error.message }
  }
  
  return { error: null }
}

