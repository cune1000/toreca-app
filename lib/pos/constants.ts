// =============================================================================
// POS 定数
// =============================================================================

export const CONDITIONS = [
    { code: 'S', name: '未開封', color: '#8b5cf6' },
    { code: 'A', name: '美品', color: '#22c55e' },
    { code: 'B', name: '良品', color: '#3b82f6' },
    { code: 'C', name: '並品', color: '#f59e0b' },
    { code: 'D', name: '傷あり', color: '#ef4444' },
    { code: 'J', name: 'ジャンク', color: '#6b7280' },
] as const

export type ConditionCode = typeof CONDITIONS[number]['code']

export function getCondition(code: string) {
    return CONDITIONS.find(c => c.code === code)
}

export function formatPrice(n: number | null | undefined): string {
    if (n == null) return '-'
    return `¥${n.toLocaleString()}`
}

// ナビゲーション項目
export const NAV_ITEMS = [
    { key: 'dashboard', icon: '📊', label: 'ダッシュボード', href: '/pos' },
    { key: 'catalog', icon: '📋', label: 'カタログ', href: '/pos/catalog' },
    { key: 'inventory', icon: '📦', label: '在庫', href: '/pos/inventory' },
    { key: 'purchase', icon: '💰', label: '仕入れ', href: '/pos/purchase' },
    { key: 'sale', icon: '🛒', label: '販売', href: '/pos/sale' },
    { key: 'history', icon: '📜', label: '履歴', href: '/pos/history' },
] as const
