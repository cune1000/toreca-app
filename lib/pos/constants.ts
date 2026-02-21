// =============================================================================
// POS 定数
// =============================================================================

export const CONDITIONS = [
    { code: 'PSA10', color: '#8b5cf6' },
    { code: 'PSA9', color: '#a855f7' },
    { code: '未開封', color: '#0ea5e9' },
    { code: 'A', color: '#22c55e' },
    { code: 'B', color: '#3b82f6' },
    { code: 'C', color: '#f59e0b' },
    { code: 'D', color: '#ef4444' },
] as const

export type ConditionCode = typeof CONDITIONS[number]['code']

const DEFAULT_CONDITION = { code: '', color: '#6b7280' } as const

export function getCondition(code: string) {
    return CONDITIONS.find(c => c.code === code) ?? { ...DEFAULT_CONDITION, code }
}

export function formatPrice(n: number | null | undefined): string {
    if (n == null) return '-'
    return `¥${n.toLocaleString()}`
}

// 仕入先タイプ
export const SOURCE_TYPES = [
    { code: 'wholesale', label: '問屋', color: '#22c55e' },
    { code: 'individual', label: '個人', color: '#f59e0b' },
    { code: 'event', label: 'イベント', color: '#8b5cf6' },
    { code: 'other', label: 'その他', color: '#6b7280' },
] as const

export type SourceTypeCode = typeof SOURCE_TYPES[number]['code']

export function getSourceType(code: string) {
    return SOURCE_TYPES.find(s => s.code === code) ?? { code, label: code, color: '#6b7280' }
}

// 信頼度
export const TRUST_LEVELS = [
    { code: 'trusted', label: '信頼済', color: '#22c55e' },
    { code: 'unverified', label: '未検証', color: '#ef4444' },
] as const

export function getTrustLevel(code: string) {
    return TRUST_LEVELS.find(t => t.code === code) ?? { code, label: code, color: '#6b7280' }
}

// ナビゲーション項目
export const NAV_ITEMS = [
    { key: 'dashboard', icon: '📊', label: 'ダッシュボード', href: '/pos' },
    { key: 'catalog', icon: '📋', label: 'カタログ・在庫', href: '/pos/catalog' },
    { key: 'sale', icon: '🛒', label: '販売', href: '/pos/sale' },
    { key: 'sources', icon: '🏢', label: '仕入先', href: '/pos/sources' },
    { key: 'history', icon: '📜', label: '履歴', href: '/pos/history' },
] as const
