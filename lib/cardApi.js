import { supabase } from './supabase'

// カード一覧取得
export async function getCards() {
  const { data, error } = await supabase
    .from('cards')
    .select(`
      *,
      category_large:category_large_id(name, icon),
      category_detail:category_detail_id(name),
      rarity:rarity_id(name)
    `)
    .order('created_at', { ascending: false })
  return data || []
}

// カード1件取得
export async function getCard(id) {
  const { data, error } = await supabase
    .from('cards')
    .select(`
      *,
      category_large:category_large_id(name, icon),
      category_medium:category_medium_id(name),
      category_small:category_small_id(name),
      category_detail:category_detail_id(name),
      rarity:rarity_id(name)
    `)
    .eq('id', id)
    .single()
  return data
}

// カード追加
export async function addCard(card) {
  const { data, error } = await supabase
    .from('cards')
    .insert([card])
    .select()
  return { data, error }
}

// カード更新
export async function updateCard(id, updates) {
  const { data, error } = await supabase
    .from('cards')
    .update(updates)
    .eq('id', id)
    .select()
  return { data, error }
}

// カード削除
export async function deleteCard(id) {
  const { error } = await supabase
    .from('cards')
    .delete()
    .eq('id', id)
  return { error }
}

// 買取価格取得（カード別）
export async function getPurchasePrices(cardId) {
  const { data, error } = await supabase
    .from('purchase_prices')
    .select(`
      *,
      shop:shop_id(name, icon)
    `)
    .eq('card_id', cardId)
    .order('created_at', { ascending: false })
  return data || []
}

// 販売価格取得（カード別）
export async function getSalePrices(cardId) {
  const { data, error } = await supabase
    .from('sale_prices')
    .select(`
      *,
      site:site_id(name, icon, url)
    `)
    .eq('card_id', cardId)
    .order('created_at', { ascending: false })
  return data || []
}

// 販売URL取得（カード別）
export async function getCardSaleUrls(cardId) {
  const { data, error } = await supabase
    .from('card_sale_urls')
    .select(`
      *,
      site:site_id(name, icon, url)
    `)
    .eq('card_id', cardId)
  return data || []
}

// 販売URL追加/更新
export async function upsertCardSaleUrl(cardId, siteId, productUrl) {
  const { data, error } = await supabase
    .from('card_sale_urls')
    .upsert({
      card_id: cardId,
      site_id: siteId,
      product_url: productUrl
    }, {
      onConflict: 'card_id,site_id'
    })
    .select()
  return { data, error }
}