import { TCG_API_KEY } from '@/lib/config'

const BASE_URL = 'https://api.tcgapi.dev/v1'

// === 型定義 ===

export interface TcgApiSet {
  id: number
  name: string
  slug: string
  card_count: number
  release_date: string | null
  abbreviation: string | null
  image_url: string | null
}

export interface TcgApiCard {
  id: number              // TCG API 内部ID
  tcgplayer_id: number    // TCGPlayer ID（3ソース共通キー）
  name: string
  clean_name: string
  number: string | null
  rarity: string
  image_url: string | null
  market_price: number | null
  low_price: number | null
  median_price: number | null
  total_listings: number
  foil_only: boolean
  printing: string
}

interface TcgApiResponse<T> {
  data: T
  meta: { total: number; page: number; per_page: number; has_more: boolean }
  rate_limit?: { daily_limit: number; daily_remaining: number; daily_reset: string }
}

// === API クライアント ===

async function fetchTcgApi<T>(path: string, params?: Record<string, string>): Promise<TcgApiResponse<T>> {
  if (!TCG_API_KEY) {
    throw new Error('TCG_API_KEY が設定されていません')
  }

  const url = new URL(`${BASE_URL}${path}`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(url.toString(), {
      headers: { 'X-API-Key': TCG_API_KEY },
      signal: controller.signal,
    })

    if (!res.ok) {
      throw new Error(`TCG API error: ${res.status} ${res.statusText}`)
    }

    const ct = res.headers.get('content-type') || ''
    if (!ct.includes('application/json')) {
      throw new Error(`TCG API: unexpected content-type: ${ct}`)
    }

    return await res.json()
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * 指定ゲームのセット一覧を取得（全ページ）
 */
export async function getSets(game: string = 'pokemon-japan'): Promise<{ sets: TcgApiSet[]; rateLimit?: any }> {
  const allSets: TcgApiSet[] = []
  let page = 1
  let rateLimit: any = null

  while (page <= 10) { // 安全ガード: 最大10ページ（1000セット）
    const res = await fetchTcgApi<any[]>(`/sets`, {
      game,
      per_page: '100',
      page: String(page),
    })

    rateLimit = res.rate_limit || null
    const items = res.data || []
    if (items.length === 0) break

    for (const s of items) {
      allSets.push({
        id: s.id,
        name: s.name || '',
        slug: s.slug || '',
        card_count: s.card_count ?? 0,
        release_date: s.release_date ?? null,
        abbreviation: s.abbreviation ?? null,
        image_url: s.image_url ?? null,
      })
    }

    if (!res.meta?.has_more) break
    page++
  }

  return { sets: allSets, rateLimit }
}

/**
 * 指定セットのカード一覧を取得（1ページ分）
 */
export async function getCards(
  setId: number,
  opts?: { page?: number; perPage?: number },
): Promise<{ cards: TcgApiCard[]; total: number; hasMore: boolean; rateLimit?: any }> {
  const params: Record<string, string> = {
    per_page: String(opts?.perPage || 100),
  }
  if (opts?.page != null) params.page = String(opts.page)

  const res = await fetchTcgApi<any[]>(`/sets/${setId}/cards`, params)
  const items = res.data || []

  const cards: TcgApiCard[] = items.map((p: any) => ({
    id: p.id,
    tcgplayer_id: p.tcgplayer_id,
    name: p.clean_name ?? p.name ?? '',
    clean_name: p.clean_name ?? '',
    number: p.number ?? null,
    rarity: p.rarity ?? '',
    image_url: p.image_url ?? null,
    market_price: p.market_price ?? null,
    low_price: p.low_price ?? null,
    median_price: p.median_price ?? null,
    total_listings: p.total_listings ?? 0,
    foil_only: p.foil_only === 1 || p.foil_only === true,
    printing: p.printing ?? 'Normal',
  }))

  return {
    cards,
    total: res.meta?.total ?? items.length,
    hasMore: res.meta?.has_more ?? false,
    rateLimit: res.rate_limit || null,
  }
}
