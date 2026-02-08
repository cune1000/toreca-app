// =============================================================================
// POS API クライアント
// =============================================================================

import type { PosCatalog, PosInventory, PosTransaction, PosHistory, PosApiResponse, PosStats } from './types'

const BASE = '/api/pos'

async function request<T>(url: string, options?: RequestInit): Promise<T> {
    const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    })
    const data = await res.json()
    if (!res.ok || data.success === false) {
        throw new Error(data.error || 'API Error')
    }
    return data
}

// =============================================================================
// カタログ
// =============================================================================

export async function getCatalogs(params?: { search?: string; category?: string }) {
    const sp = new URLSearchParams()
    if (params?.search) sp.set('search', params.search)
    if (params?.category) sp.set('category', params.category)
    const q = sp.toString()
    return request<{ success: true; data: PosCatalog[] }>(`${BASE}/catalog${q ? `?${q}` : ''}`)
}

export async function getCatalog(id: string) {
    return request<{ success: true; data: PosCatalog }>(`${BASE}/catalog/${id}`)
}

export async function createCatalog(data: Partial<PosCatalog>) {
    return request<{ success: true; data: PosCatalog }>(`${BASE}/catalog`, {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

export async function updateCatalog(id: string, data: Partial<PosCatalog>) {
    return request<{ success: true; data: PosCatalog }>(`${BASE}/catalog/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    })
}

export async function deleteCatalog(id: string) {
    return request<{ success: true }>(`${BASE}/catalog/${id}`, { method: 'DELETE' })
}

export async function searchCatalogFromAPI(keyword: string) {
    return request<{ success: true; data: any[] }>(`${BASE}/catalog/search-api?q=${encodeURIComponent(keyword)}`)
}

// =============================================================================
// 在庫
// =============================================================================

export async function getInventory(params?: { category?: string; sort?: string }) {
    const sp = new URLSearchParams()
    if (params?.category) sp.set('category', params.category)
    if (params?.sort) sp.set('sort', params.sort)
    const q = sp.toString()
    return request<{ success: true; data: PosInventory[] }>(`${BASE}/inventory${q ? `?${q}` : ''}`)
}

// =============================================================================
// 取引
// =============================================================================

export async function registerPurchase(data: {
    catalog_id: string
    condition: string
    quantity: number
    unit_price: number
    transaction_date?: string
    notes?: string
}) {
    return request<PosApiResponse>(`${BASE}/transactions/purchase`, {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

export async function registerSale(data: {
    inventory_id: string
    quantity: number
    unit_price: number
    transaction_date?: string
    notes?: string
}) {
    return request<PosApiResponse>(`${BASE}/transactions/sale`, {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

export async function getTransactions(params?: { type?: string; limit?: number }) {
    const sp = new URLSearchParams()
    if (params?.type) sp.set('type', params.type)
    if (params?.limit) sp.set('limit', String(params.limit))
    const q = sp.toString()
    return request<{ success: true; data: PosTransaction[] }>(`${BASE}/transactions${q ? `?${q}` : ''}`)
}

// =============================================================================
// 履歴
// =============================================================================

export async function getHistory(params?: { inventory_id?: string; limit?: number }) {
    const sp = new URLSearchParams()
    if (params?.inventory_id) sp.set('inventory_id', params.inventory_id)
    if (params?.limit) sp.set('limit', String(params.limit))
    const q = sp.toString()
    return request<{ success: true; data: PosHistory[] }>(`${BASE}/history${q ? `?${q}` : ''}`)
}

export async function adjustInventory(data: {
    inventory_id: string
    quantity_change: number
    reason: string
    notes?: string
}) {
    return request<PosApiResponse>(`${BASE}/history/adjust`, {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

// =============================================================================
// 統計
// =============================================================================

export async function getStats() {
    return request<{ success: true; data: PosStats }>(`${BASE}/stats`)
}
