// チャートサイト用クエリレイヤー
// API Route経由で海外相場（overseas_prices）データを取得

import { ChartCard, CardDetail, PricePoint } from './types'

const BASE_URL = typeof window !== 'undefined' ? '' : (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000')

// ============================================================================
// ランキング取得
// ============================================================================

export async function getRanking(params: {
    type: string
    category?: string
    limit?: number
}): Promise<ChartCard[]> {
    const searchParams = new URLSearchParams({
        type: params.type,
        ...(params.category && { category: params.category }),
        ...(params.limit && { limit: String(params.limit) }),
    })

    const res = await fetch(`${BASE_URL}/api/chart/rankings?${searchParams}`)
    if (!res.ok) return []
    return res.json()
}

// ============================================================================
// カード詳細
// ============================================================================

export async function getCardDetail(id: string): Promise<CardDetail | null> {
    const res = await fetch(`${BASE_URL}/api/chart/card/${id}`)
    if (!res.ok) return null
    return res.json()
}

// ============================================================================
// 価格履歴
// ============================================================================

export async function getPriceHistory(
    cardId: string,
    period: '7d' | '30d' | '90d' | '1y' | 'all'
): Promise<PricePoint[]> {
    const res = await fetch(`${BASE_URL}/api/chart/card/${cardId}/history?period=${period}`)
    if (!res.ok) return []
    return res.json()
}

// ============================================================================
// カード検索
// ============================================================================

export async function searchCards(query: string, filters?: {
    category?: string
}): Promise<ChartCard[]> {
    const searchParams = new URLSearchParams({
        q: query,
        ...(filters?.category && { category: filters.category }),
    })

    const res = await fetch(`${BASE_URL}/api/chart/search?${searchParams}`)
    if (!res.ok) return []
    return res.json()
}
