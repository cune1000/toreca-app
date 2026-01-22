import { supabase } from './supabase'

// 大カテゴリ取得
export async function getCategoryLarge() {
  const { data, error } = await supabase
    .from('category_large')
    .select('*')
    .order('sort_order')
  return data || []
}

// 大カテゴリ追加
export async function addCategoryLarge(name, icon) {
  const { data, error } = await supabase
    .from('category_large')
    .insert([{ name, icon }])
    .select()
  return { data, error }
}

// レアリティ取得（大カテゴリID指定）
export async function getRarities(largeId) {
  const { data, error } = await supabase
    .from('rarities')
    .select('*')
    .eq('large_id', largeId)
    .order('sort_order')
  return data || []
}

// レアリティ追加
export async function addRarity(largeId, name) {
  const { data, error } = await supabase
    .from('rarities')
    .insert([{ large_id: largeId, name }])
    .select()
  return { data, error }
}

// レアリティ削除
export async function deleteRarity(id) {
  const { error } = await supabase
    .from('rarities')
    .delete()
    .eq('id', id)
  return { error }
}

// 中カテゴリ取得
export async function getCategoryMedium(largeId) {
  const { data, error } = await supabase
    .from('category_medium')
    .select('*')
    .eq('large_id', largeId)
    .order('sort_order')
  return data || []
}

// 中カテゴリ追加
export async function addCategoryMedium(largeId, name) {
  const { data, error } = await supabase
    .from('category_medium')
    .insert([{ large_id: largeId, name }])
    .select()
  return { data, error }
}