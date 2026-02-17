import { PriceChartingProduct } from '@/lib/types'
import { PRICECHARTING_TOKEN } from '@/lib/config'

const BASE_URL = 'https://www.pricecharting.com/api'

/**
 * PriceCharting APIから単体商品を取得
 * @param id PriceCharting固有ID
 */
export async function getProduct(id: string): Promise<PriceChartingProduct> {
  if (!PRICECHARTING_TOKEN) {
    throw new Error('PRICECHARTING_TOKEN が設定されていません')
  }

  const url = `${BASE_URL}/product?t=${PRICECHARTING_TOKEN}&id=${encodeURIComponent(id)}`
  const res = await fetch(url)

  if (!res.ok) {
    throw new Error(`PriceCharting API error: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()
  if (data.status === 'error') {
    throw new Error(`PriceCharting API error: ${data.message || 'Unknown error'}`)
  }

  return data
}

/**
 * PriceCharting APIでテキスト検索（紐付け時の候補検索用）
 * @param query 検索テキスト（例: "charizard pokemon"）
 * @returns 最大20件の候補
 */
export async function searchProducts(query: string): Promise<PriceChartingProduct[]> {
  if (!PRICECHARTING_TOKEN) {
    throw new Error('PRICECHARTING_TOKEN が設定されていません')
  }

  const url = `${BASE_URL}/products?t=${PRICECHARTING_TOKEN}&q=${encodeURIComponent(query)}`
  const res = await fetch(url)

  if (!res.ok) {
    throw new Error(`PriceCharting API error: ${res.status} ${res.statusText}`)
  }

  const data = await res.json()
  if (data.status === 'error') {
    throw new Error(`PriceCharting API error: ${data.message || 'Unknown error'}`)
  }

  return data.products || []
}

/**
 * ペニー単位の価格をドル単位に変換
 * @param pennies ペニー単位の価格（例: 1732）
 * @returns ドル単位の価格（例: 17.32）
 */
export function penniesToDollars(pennies: number): number {
  return pennies / 100
}

/**
 * ペニー単位の価格を日本円に変換
 * @param pennies ペニー単位の価格
 * @param exchangeRate USD/JPY レート
 * @returns 日本円（整数）
 */
export function penniesToJpy(pennies: number, exchangeRate: number): number {
  return Math.round((pennies / 100) * exchangeRate)
}
