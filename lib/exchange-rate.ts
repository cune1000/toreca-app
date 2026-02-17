const FRANKFURTER_API = 'https://api.frankfurter.dev/v1'

interface FrankfurterResponse {
  base: string
  date: string
  rates: Record<string, number>
}

/**
 * Frankfurter APIからUSD→JPYの為替レートを取得
 * ECB（欧州中央銀行）のレートを使用。完全無料、APIキー不要。
 * @returns USD/JPY レート（例: 149.50）
 */
export async function getUsdJpyRate(): Promise<number> {
  const url = `${FRANKFURTER_API}/latest?base=USD&symbols=JPY`
  const res = await fetch(url)

  if (!res.ok) {
    throw new Error(`Frankfurter API error: ${res.status} ${res.statusText}`)
  }

  const data: FrankfurterResponse = await res.json()
  const rate = data.rates.JPY

  if (!rate) {
    throw new Error('JPYレートが取得できませんでした')
  }

  return rate
}
