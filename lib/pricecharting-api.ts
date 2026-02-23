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
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000) // R13: 8秒タイムアウト
  try {
    const res = await fetch(url, { signal: controller.signal })

    if (!res.ok) {
      throw new Error(`PriceCharting API error: ${res.status} ${res.statusText}`)
    }

    // R13: Content-Type確認（HTML返却時のjsonパースエラー防止）
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('application/json')) {
      throw new Error(`PriceCharting API: unexpected content-type: ${ct}`)
    }

    const data = await res.json()
    if (data.status === 'error') {
      throw new Error(`PriceCharting API error: ${data.message || 'Unknown error'}`)
    }

    return data
  } finally {
    clearTimeout(timeout)
  }
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
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000) // R13: 8秒タイムアウト
  try {
    const res = await fetch(url, { signal: controller.signal })

    if (!res.ok) {
      throw new Error(`PriceCharting API error: ${res.status} ${res.statusText}`)
    }

    // R13: Content-Type確認
    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('application/json')) {
      throw new Error(`PriceCharting API: unexpected content-type: ${ct}`)
    }

    const data = await res.json()
    if (data.status === 'error') {
      throw new Error(`PriceCharting API error: ${data.message || 'Unknown error'}`)
    }

    // R13: Array.isArray ガード
    return Array.isArray(data.products) ? data.products : []
  } finally {
    clearTimeout(timeout)
  }
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
