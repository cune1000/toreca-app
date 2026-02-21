// =============================================================================
// POS API クライアント
// =============================================================================

import type { PosCatalog, PosInventory, PosTransaction, PosHistory, PosApiResponse, PosStats, PosCheckoutFolder, PosCheckoutFolderDetail, PosCheckoutStats, PosSource, PosLot } from './types'

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

export async function searchCatalogFromAPI(keyword: string, params?: { limit?: number; offset?: number }) {
    const sp = new URLSearchParams({ q: keyword })
    if (params?.limit) sp.set('limit', String(params.limit))
    if (params?.offset) sp.set('offset', String(params.offset))
    return request<{ success: true; data: any[]; total: number; limit: number; offset: number }>(`${BASE}/catalog/search-api?${sp.toString()}`)
}

// =============================================================================
// 在庫
// =============================================================================

export async function getInventory(params?: { category?: string; sort?: string; catalog_id?: string }) {
    const sp = new URLSearchParams()
    if (params?.category) sp.set('category', params.category)
    if (params?.sort) sp.set('sort', params.sort)
    if (params?.catalog_id) sp.set('catalog_id', params.catalog_id)
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
    expenses?: number
    transaction_date?: string
    notes?: string
    source_id?: string
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
    lot_id?: string
}) {
    return request<PosApiResponse>(`${BASE}/transactions/sale`, {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

export async function getTransaction(id: string) {
    return request<{ success: true; data: PosTransaction }>(`${BASE}/transactions/${id}`)
}

export async function updateTransaction(id: string, data: {
    quantity?: number
    unit_price?: number
    expenses?: number
    notes?: string
    transaction_date?: string
    reason?: string
}) {
    return request<PosApiResponse>(`${BASE}/transactions/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    })
}

export async function deleteTransaction(id: string, reason?: string) {
    return request<PosApiResponse>(`${BASE}/transactions/${id}`, {
        method: 'DELETE',
        body: JSON.stringify({ reason }),
    })
}

export async function getTransactions(params?: { type?: string; limit?: number; catalog_id?: string }) {
    const sp = new URLSearchParams()
    if (params?.type) sp.set('type', params.type)
    if (params?.limit) sp.set('limit', String(params.limit))
    if (params?.catalog_id) sp.set('catalog_id', params.catalog_id)
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
// 相場・予測価格
// =============================================================================

export async function refreshMarketPrices() {
    return request<PosApiResponse<{ updated: number; skipped: number }>>(`${BASE}/market-prices/refresh`, {
        method: 'POST',
    })
}

export async function updateInventoryPrice(inventoryId: string, predictedPrice: number | null) {
    return request<{ success: true; data: PosInventory }>(`${BASE}/inventory/${inventoryId}`, {
        method: 'PATCH',
        body: JSON.stringify({ predicted_price: predictedPrice }),
    })
}

// =============================================================================
// 統計
// =============================================================================

export async function getStats() {
    return request<{ success: true; data: PosStats }>(`${BASE}/stats`)
}

// =============================================================================
// 持ち出し（チェックアウト）
// =============================================================================

export async function getCheckoutFolders(params?: { status?: string }) {
    const sp = new URLSearchParams()
    if (params?.status) sp.set('status', params.status)
    const q = sp.toString()
    return request<{ success: true; data: PosCheckoutFolder[] }>(`${BASE}/checkout/folders${q ? `?${q}` : ''}`)
}

export async function getCheckoutFolder(id: string) {
    return request<{ success: true; data: PosCheckoutFolderDetail }>(`${BASE}/checkout/folders/${id}`)
}

export async function createCheckoutFolder(data: { name: string; description?: string }) {
    return request<{ success: true; data: PosCheckoutFolder }>(`${BASE}/checkout/folders`, {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

export async function updateCheckoutFolder(id: string, data: { name?: string; description?: string; status?: string }) {
    return request<{ success: true; data: PosCheckoutFolder }>(`${BASE}/checkout/folders/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    })
}

export async function deleteCheckoutFolder(id: string) {
    return request<{ success: true }>(`${BASE}/checkout/folders/${id}`, { method: 'DELETE' })
}

export async function checkoutItem(data: { folder_id: string; inventory_id: string; quantity: number; lot_id?: string }) {
    return request<PosApiResponse>(`${BASE}/checkout/items`, {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

export async function returnCheckoutItem(itemId: string, data?: { notes?: string; resolve_quantity?: number }) {
    return request<PosApiResponse>(`${BASE}/checkout/items/${itemId}/return`, {
        method: 'POST',
        body: JSON.stringify(data || {}),
    })
}

export async function sellCheckoutItem(itemId: string, data: { unit_price: number; sale_expenses?: number; notes?: string; resolve_quantity?: number }) {
    return request<PosApiResponse>(`${BASE}/checkout/items/${itemId}/sell`, {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

export async function convertCheckoutItem(itemId: string, data: { new_condition: string; expenses?: number; notes?: string; resolve_quantity?: number }) {
    return request<PosApiResponse>(`${BASE}/checkout/items/${itemId}/convert`, {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

export async function cancelCheckoutItem(itemId: string) {
    return request<PosApiResponse>(`${BASE}/checkout/items/${itemId}`, {
        method: 'DELETE',
    })
}

export async function undoCheckoutItem(itemId: string) {
    return request<PosApiResponse>(`${BASE}/checkout/items/${itemId}/undo`, {
        method: 'POST',
        body: JSON.stringify({}),
    })
}

export async function getCheckoutStats() {
    return request<{ success: true; data: PosCheckoutStats }>(`${BASE}/checkout/stats`)
}

// =============================================================================
// 仕入先
// =============================================================================

export async function getSources(params?: { active?: boolean; type?: string }) {
    const sp = new URLSearchParams()
    if (params?.active !== undefined) sp.set('active', String(params.active))
    if (params?.type) sp.set('type', params.type)
    const q = sp.toString()
    return request<{ success: true; data: PosSource[] }>(`${BASE}/sources${q ? `?${q}` : ''}`)
}

export async function getSource(id: string) {
    return request<{ success: true; data: PosSource }>(`${BASE}/sources/${id}`)
}

export async function createSource(data: { name: string; type?: string; trust_level?: string; contact_info?: string; notes?: string }) {
    return request<{ success: true; data: PosSource }>(`${BASE}/sources`, {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

export async function updateSource(id: string, data: Partial<PosSource>) {
    return request<{ success: true; data: PosSource }>(`${BASE}/sources/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    })
}

export async function deleteSource(id: string) {
    return request<PosApiResponse>(`${BASE}/sources/${id}`, { method: 'DELETE' })
}

// =============================================================================
// ロット
// =============================================================================

export async function getLots(params?: { inventory_id?: string; has_remaining?: boolean; catalog_id?: string }) {
    const sp = new URLSearchParams()
    if (params?.inventory_id) sp.set('inventory_id', params.inventory_id)
    if (params?.has_remaining !== undefined) sp.set('has_remaining', String(params.has_remaining))
    if (params?.catalog_id) sp.set('catalog_id', params.catalog_id)
    const q = sp.toString()
    return request<{ success: true; data: PosLot[] }>(`${BASE}/lots${q ? `?${q}` : ''}`)
}

export async function getLot(id: string) {
    return request<{ success: true; data: PosLot }>(`${BASE}/lots/${id}`)
}
