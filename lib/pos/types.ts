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
    tracking_mode: 'lot' | 'average'
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
    avg_expense_per_unit: number
    total_expenses: number
    market_price: number | null
    predicted_price: number | null
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
    expenses: number
    profit: number | null
    profit_rate: number | null
    transaction_date: string
    notes: string | null
    is_checkout: boolean
    lot_id: string | null
    source_id: string | null
    created_at: string
    // JOIN時
    inventory?: PosInventory & { catalog?: PosCatalog }
    lot?: PosLot
    source?: PosSource
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
    predictedSaleTotal: number
    predictedProfit: number
    totalPurchaseAmount: number
    totalExpenses: number
    todayPurchase: number
    todaySale: number
    todayProfit: number
    todayExpenses: number
}

// =============================================================================
// 持ち出し（チェックアウト）
// =============================================================================

export interface PosCheckoutFolder {
    id: string
    name: string
    description: string | null
    status: 'open' | 'closed'
    created_at: string
    updated_at: string
    closed_at: string | null
    // 集計（API側で付与）
    item_count?: number
    pending_count?: number
    locked_amount?: number
}

export interface PosCheckoutItem {
    id: string
    folder_id: string
    inventory_id: string
    quantity: number
    unit_cost: number
    unit_expense: number
    status: 'pending' | 'returned' | 'sold' | 'converted'
    resolved_at: string | null
    resolution_notes: string | null
    sale_unit_price: number | null
    sale_expenses: number | null
    sale_profit: number | null
    converted_condition: string | null
    converted_expenses: number | null
    lot_id: string | null
    created_at: string
    updated_at: string
    // JOIN時
    inventory?: PosInventory & { catalog?: PosCatalog }
    lot?: PosLot
}

export interface PosCheckoutFolderDetail extends PosCheckoutFolder {
    items: PosCheckoutItem[]
}

export interface PosCheckoutStats {
    lockedAmount: number
    lockedExpenses: number
    totalLockedValue: number
    pendingItems: number
    openFolders: number
}

// =============================================================================
// 仕入先・ロット
// =============================================================================

export interface PosSource {
    id: string
    name: string
    type: 'wholesale' | 'individual' | 'event' | 'other'
    trust_level: 'trusted' | 'unverified'
    contact_info: string | null
    notes: string | null
    is_active: boolean
    created_at: string
    updated_at: string
}

export interface PosLot {
    id: string
    lot_number: string
    source_id: string | null
    inventory_id: string
    quantity: number
    remaining_qty: number
    unit_cost: number
    expenses: number
    unit_expense: number
    purchase_date: string
    transaction_id: string | null
    notes: string | null
    created_at: string
    // JOIN時
    source?: PosSource
    inventory?: PosInventory & { catalog?: PosCatalog }
}
