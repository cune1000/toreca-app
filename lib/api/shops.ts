import { supabase, TABLES } from '../supabase'
import type { Shop, SaleSite } from '../types'

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

// =============================================================================
// Sale Sites (販売サイト)
// =============================================================================

/** 販売サイト一覧を取得 */
export async function getSaleSites(): Promise<SaleSite[]> {
  const { data, error } = await supabase
    .from(TABLES.SALE_SITES)
    .select('*')
    .order('name')
  
  if (error) {
    console.error('Error fetching sale sites:', error)
    return []
  }
  
  return data || []
}

/** 販売サイトを取得（ID指定） */
export async function getSaleSite(id: string): Promise<SaleSite | null> {
  const { data, error } = await supabase
    .from(TABLES.SALE_SITES)
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) {
    console.error('Error fetching sale site:', error)
    return null
  }
  
  return data
}

/** 販売サイトを追加 */
export async function addSaleSite(site: Omit<SaleSite, 'id' | 'created_at'>): Promise<{ data: SaleSite | null; error: string | null }> {
  const { data, error } = await supabase
    .from(TABLES.SALE_SITES)
    .insert([site])
    .select()
    .single()
  
  if (error) {
    return { data: null, error: error.message }
  }
  
  return { data, error: null }
}

/** 販売サイトを更新 */
export async function updateSaleSite(
  id: string, 
  updates: Partial<SaleSite>
): Promise<{ data: SaleSite | null; error: string | null }> {
  const { data, error } = await supabase
    .from(TABLES.SALE_SITES)
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  
  if (error) {
    return { data: null, error: error.message }
  }
  
  return { data, error: null }
}

/** 販売サイトを削除 */
export async function deleteSaleSite(id: string): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from(TABLES.SALE_SITES)
    .delete()
    .eq('id', id)
  
  if (error) {
    return { error: error.message }
  }
  
  return { error: null }
}
