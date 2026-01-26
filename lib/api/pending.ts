import { supabase, TABLES } from '../supabase'
import type { 
  PendingImage, 
  PendingCard, 
  PendingImageStatus, 
  PendingCardStatus,
  RecognizedCard,
  Shop
} from '../types'

// =============================================================================
// Pending Images (保留画像)
// =============================================================================

/** 保留画像一覧を取得 */
export async function getPendingImages(status?: PendingImageStatus): Promise<PendingImage[]> {
  let query = supabase
    .from(TABLES.PENDING_IMAGES)
    .select(`
      *,
      shop:shop_id(id, name, icon, x_account)
    `)
    .order('created_at', { ascending: false })
  
  if (status) {
    query = query.eq('status', status)
  }
  
  const { data, error } = await query
  
  if (error) {
    console.error('Error fetching pending images:', error)
    return []
  }
  
  return data || []
}

/** 保留画像を追加 */
export async function addPendingImage(params: {
  shop_id: string
  image_url?: string
  image_base64?: string
  tweet_url?: string
  tweet_time?: string
}): Promise<{ data: PendingImage | null; error: string | null }> {
  const { data, error } = await supabase
    .from(TABLES.PENDING_IMAGES)
    .insert({
      ...params,
      status: 'pending' as PendingImageStatus
    })
    .select()
    .single()
  
  if (error) {
    console.error('Error adding pending image:', error)
    return { data: null, error: error.message }
  }
  
  return { data, error: null }
}

/** 保留画像のステータスを更新 */
export async function updatePendingImageStatus(
  id: string, 
  status: PendingImageStatus
): Promise<boolean> {
  const { error } = await supabase
    .from(TABLES.PENDING_IMAGES)
    .update({ status })
    .eq('id', id)
  
  if (error) {
    console.error('Error updating pending image status:', error)
    return false
  }
  
  return true
}

/** 保留画像を削除 */
export async function deletePendingImage(id: string): Promise<boolean> {
  const { error } = await supabase
    .from(TABLES.PENDING_IMAGES)
    .delete()
    .eq('id', id)
  
  if (error) {
    console.error('Error deleting pending image:', error)
    return false
  }
  
  return true
}

// =============================================================================
// Pending Cards (保留カード)
// =============================================================================

/** 保留カード一覧を取得 */
export async function getPendingCards(status?: PendingCardStatus): Promise<PendingCard[]> {
  let query = supabase
    .from(TABLES.PENDING_CARDS)
    .select(`
      *,
      matched_card:matched_card_id(id, name, image_url, card_number, rarity),
      shop:shop_id(id, name)
    `)
    .order('created_at', { ascending: false })
  
  if (status) {
    query = query.eq('status', status)
  }
  
  const { data, error } = await query
  
  if (error) {
    console.error('Error fetching pending cards:', error)
    return []
  }
  
  return data || []
}

/** 保留カードを追加（単体） */
export async function addPendingCard(params: {
  pending_image_id?: string
  shop_id: string
  card_image?: string
  ocr_text?: string
  recognized_name?: string
  price?: number
  condition?: string
  tweet_time?: string
}): Promise<{ data: PendingCard | null; error: string | null }> {
  const { data, error } = await supabase
    .from(TABLES.PENDING_CARDS)
    .insert({
      ...params,
      status: 'pending' as PendingCardStatus
    })
    .select()
    .single()
  
  if (error) {
    console.error('Error adding pending card:', error)
    return { data: null, error: error.message }
  }
  
  return { data, error: null }
}

/** 保留カードを一括追加（認識結果から） */
export async function addPendingCardsFromRecognition(params: {
  pending_image_id?: string
  shop_id: string
  cards: RecognizedCard[]
  tweet_time?: string
}): Promise<{ success: number; failed: number }> {
  const { pending_image_id, shop_id, cards, tweet_time } = params
  
  const records = cards
    .filter(card => !card.excluded && !card.matchedCard) // マッチしてないカードのみ
    .map(card => ({
      pending_image_id,
      shop_id,
      recognized_name: card.name,
      ocr_text: card.ocrText,
      price: card.price,
      condition: card.condition,
      tweet_time,
      status: 'pending' as PendingCardStatus
    }))
  
  if (records.length === 0) {
    return { success: 0, failed: 0 }
  }
  
  const { error } = await supabase
    .from(TABLES.PENDING_CARDS)
    .insert(records)
  
  if (error) {
    console.error('Error adding pending cards:', error)
    return { success: 0, failed: records.length }
  }
  
  return { success: records.length, failed: 0 }
}

/** 保留カードをマッチング */
export async function matchPendingCard(
  pendingCardId: string, 
  cardId: string
): Promise<boolean> {
  const { error } = await supabase
    .from(TABLES.PENDING_CARDS)
    .update({ 
      matched_card_id: cardId, 
      status: 'matched' as PendingCardStatus 
    })
    .eq('id', pendingCardId)
  
  if (error) {
    console.error('Error matching pending card:', error)
    return false
  }
  
  return true
}

/** 保留カードの価格を更新 */
export async function updatePendingCardPrice(
  id: string, 
  price: number
): Promise<boolean> {
  const { error } = await supabase
    .from(TABLES.PENDING_CARDS)
    .update({ price })
    .eq('id', id)
  
  if (error) {
    console.error('Error updating pending card price:', error)
    return false
  }
  
  return true
}

/** 保留カードを削除 */
export async function deletePendingCard(id: string): Promise<boolean> {
  const { error } = await supabase
    .from(TABLES.PENDING_CARDS)
    .delete()
    .eq('id', id)
  
  if (error) {
    console.error('Error deleting pending card:', error)
    return false
  }
  
  return true
}

/** マッチ済み保留カードを買取価格として保存 */
export async function savePendingCardsToPurchasePrices(
  cardIds: string[]
): Promise<{ success: number; failed: number }> {
  // マッチ済みカードを取得
  const { data: pendingCards, error: fetchError } = await supabase
    .from(TABLES.PENDING_CARDS)
    .select('*')
    .in('id', cardIds)
    .eq('status', 'matched')
  
  if (fetchError || !pendingCards) {
    console.error('Error fetching pending cards for save:', fetchError)
    return { success: 0, failed: cardIds.length }
  }
  
  // 価格があるカードのみ抽出
  const validCards = pendingCards.filter(c => c.matched_card_id && c.price)
  
  if (validCards.length === 0) {
    return { success: 0, failed: 0 }
  }
  
  // 買取価格レコード作成
  const purchaseRecords = validCards.map(card => ({
    card_id: card.matched_card_id,
    shop_id: card.shop_id,
    price: card.price,
    condition: card.condition || 'normal',
    is_psa: card.condition === 'psa',
    psa_grade: card.condition === 'psa' ? 10 : null,
    recorded_at: new Date().toISOString(),
    tweet_time: card.tweet_time
  }))
  
  // 買取価格に挿入
  const { error: insertError } = await supabase
    .from(TABLES.PURCHASE_PRICES)
    .insert(purchaseRecords)
  
  if (insertError) {
    console.error('Error inserting purchase prices:', insertError)
    return { success: 0, failed: validCards.length }
  }
  
  // 保存済みカードを削除
  const { error: deleteError } = await supabase
    .from(TABLES.PENDING_CARDS)
    .delete()
    .in('id', validCards.map(c => c.id))
  
  if (deleteError) {
    console.error('Error deleting saved pending cards:', deleteError)
    // 挿入は成功してるのでsuccessを返す
  }
  
  return { success: validCards.length, failed: 0 }
}

// =============================================================================
// Combined Operations
// =============================================================================

/** 保留の統計情報を取得 */
export async function getPendingStats(): Promise<{
  images: { pending: number; processing: number }
  cards: { pending: number; matched: number }
}> {
  const [imagesResult, cardsResult] = await Promise.all([
    supabase
      .from(TABLES.PENDING_IMAGES)
      .select('status', { count: 'exact' }),
    supabase
      .from(TABLES.PENDING_CARDS)
      .select('status', { count: 'exact' })
  ])
  
  const images = imagesResult.data || []
  const cards = cardsResult.data || []
  
  return {
    images: {
      pending: images.filter(i => i.status === 'pending').length,
      processing: images.filter(i => i.status === 'processing').length
    },
    cards: {
      pending: cards.filter(c => c.status === 'pending').length,
      matched: cards.filter(c => c.status === 'matched').length
    }
  }
}
