// =============================================================================
// POS 型定義
// =============================================================================

export interface PosCatalog {
    id: string
    name: string
    image_url: string | null
    category: string | null
    subcategory: string | null
    card_number: string | null
    rarity: string | null
    jan_code: string | null
    source_type: 'api' | 'original'
    api_card_id: string | null
    api_linked_at: string | null
    fixed_price: number | null
    is_active: boolean
    created_at: string
    updated_at: string
}

export interface PosInventory {
    id: string
    catalog_id: string
    condition: string
    quantity: number
    avg_purchase_price: number
    total_purchase_cost: number
    total_purchased: number
    created_at: string
    updated_at: string
    // JOIN時
    catalog?: PosCatalog
}

export interface PosTransaction {
    id: string
    inventory_id: string
    type: 'purchase' | 'sale'
    quantity: number
    unit_price: number
    total_price: number
    profit: number | null
    profit_rate: number | null
    transaction_date: string
    notes: string | null
    created_at: string
    // JOIN時
    inventory?: PosInventory & { catalog?: PosCatalog }
}

export interface PosHistory {
    id: string
    inventory_id: string
    action_type: 'purchase' | 'sale' | 'adjustment' | 'dispose' | 'return'
    quantity_change: number
    quantity_before: number
    quantity_after: number
    transaction_id: string | null
    reason: string | null
    notes: string | null
    is_modified: boolean
    modified_at: string | null
    modified_reason: string | null
    created_at: string
}

// API レスポンス共通
export interface PosApiResponse<T = any> {
    success: boolean
    data?: T
    error?: string
}

// 統計
export interface PosStats {
    totalItems: number
    totalKinds: number
    totalCost: number
    estimatedValue: number
    estimatedProfit: number
    todayPurchase: number
    todaySale: number
    todayProfit: number
}
