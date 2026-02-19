// =============================================================================
// POS 定数
// =============================================================================

export const CONDITIONS = [
    { code: 'PSA10', color: '#8b5cf6' },
    { code: 'PSA9', color: '#a855f7' },
    { code: 'A', color: '#22c55e' },
    { code: 'B', color: '#3b82f6' },
    { code: 'C', color: '#f59e0b' },
    { code: 'D', color: '#ef4444' },
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
    { key: 'catalog', icon: '📋', label: 'カタログ・在庫', href: '/pos/catalog' },
    { key: 'purchase', icon: '💰', label: '仕入れ', href: '/pos/purchase' },
    { key: 'sale', icon: '🛒', label: '販売', href: '/pos/sale' },
    { key: 'history', icon: '📜', label: '履歴', href: '/pos/history' },
] as const
