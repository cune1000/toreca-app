import { JUSTTCG_API_KEY } from '@/lib/config'

const BASE_URL = 'https://api.justtcg.com/v1'

// === 型定義 ===

export interface JustTcgSet {
  id: string
  name: string
  cards_count: number
  release_date: string | null
}

export interface JustTcgVariant {
  id: string
  condition: string
  printing: string
  language: string
  price: number | null
  lastUpdated: number | null
  priceChange7d: number | null
  priceChange30d: number | null
  avgPrice: number | null
  priceHistory?: Array<{ p: number; t: number }>
}

export interface JustTcgCard {
  id: string
  name: string
  number: string
  set: string
  set_name: string
  rarity: string
  variants: JustTcgVariant[]
}

export interface JustTcgUsage {
  dailyUsed: number
  dailyLimit: number
  dailyRemaining: number
  monthlyUsed: number
  monthlyLimit: number
  monthlyRemaining: number
}

interface JustTcgMeta {
  total: number
  limit: number
  offset: number
  hasMore: boolean
}

interface JustTcgMetadata {
  apiRequestLimit: number
  apiRequestsUsed: number
  apiRequestsRemaining: number
  apiDailyLimit: number
  apiDailyRequestsUsed: number
  apiDailyRequestsRemaining: number
  apiPlan: string
}

// === API クライアント ===

async function fetchJustTcg<T>(path: string, params?: Record<string, string>): Promise<{
  data: T
  meta: JustTcgMeta
  usage: JustTcgUsage
}> {
  if (!JUSTTCG_API_KEY) {
    throw new Error('JUSTTCG_API_KEY が設定されていません')
  }

  const url = new URL(`${BASE_URL}${path}`)
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)
  try {
    const res = await fetch(url.toString(), {
      headers: { 'x-api-key': JUSTTCG_API_KEY },
      signal: controller.signal,
    })

    if (!res.ok) {
      throw new Error(`JustTCG API error: ${res.status} ${res.statusText}`)
    }

    const json = await res.json()
    if (json.error) {
      throw new Error(`JustTCG API error: ${json.error} (${json.code})`)
    }

    const md: JustTcgMetadata = json._metadata || {}
    return {
      data: json.data,
      meta: json.meta || { total: 0, limit: 0, offset: 0, hasMore: false },
      usage: {
        dailyUsed: md.apiDailyRequestsUsed ?? 0,
        dailyLimit: md.apiDailyLimit ?? 100,
        dailyRemaining: md.apiDailyRequestsRemaining ?? 0,
        monthlyUsed: md.apiRequestsUsed ?? 0,
        monthlyLimit: md.apiRequestLimit ?? 1000,
        monthlyRemaining: md.apiRequestsRemaining ?? 0,
      },
    }
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * 指定ゲームのセット一覧を取得
 */
export async function getSets(game: string = 'pokemon-japan') {
  return fetchJustTcg<JustTcgSet[]>('/sets', {
    game,
    orderBy: 'release_date',
    order: 'desc',
  })
}

/**
 * 指定セットのカード一覧を取得
 */
export async function getCards(setId: string, opts?: { offset?: number; limit?: number; game?: string }) {
  const params: Record<string, string> = {
    game: opts?.game || 'pokemon-japan',
    set: setId,
    orderBy: 'price',
    order: 'desc',
  }
  if (opts?.offset != null) params.offset = String(opts.offset)
  if (opts?.limit) params.limit = String(opts.limit)

  return fetchJustTcg<JustTcgCard[]>('/cards', params)
}
