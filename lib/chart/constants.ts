import { RankingDef, Category } from './types'

export const ALL_RANKINGS: RankingDef[] = [
    {
        id: 'loose_up_pct',
        label: '素体 上昇率',
        icon: '📈',
        category: '素体',
        color: '#ef4444',
        priceType: 'loose',
        sortBy: 'change_pct_desc',
    },
    {
        id: 'loose_down_pct',
        label: '素体 下落率',
        icon: '📉',
        category: '素体',
        color: '#3b82f6',
        priceType: 'loose',
        sortBy: 'change_pct_asc',
    },
    {
        id: 'graded_up_pct',
        label: 'PSA10 上昇率',
        icon: '⭐',
        category: 'PSA10',
        color: '#eab308',
        priceType: 'graded',
        sortBy: 'change_pct_desc',
    },
    {
        id: 'graded_down_pct',
        label: 'PSA10 下落率',
        icon: '🌙',
        category: 'PSA10',
        color: '#a855f7',
        priceType: 'graded',
        sortBy: 'change_pct_asc',
    },
    {
        id: 'high_price_loose',
        label: '高額（素体）',
        icon: '👑',
        category: 'その他',
        color: '#f59e0b',
        priceType: 'loose',
        sortBy: 'price_desc',
    },
    {
        id: 'purchase_up_pct',
        label: '買取価格 上昇率',
        icon: '🔥',
        category: '買取',
        color: '#dc2626',
        priceType: 'loose',
        sortBy: 'change_pct_desc',
    },
    {
        id: 'purchase_down_pct',
        label: '買取価格 下落率',
        icon: '❄️',
        category: '買取',
        color: '#2563eb',
        priceType: 'loose',
        sortBy: 'change_pct_asc',
    },
    // Coming Soon
    {
        id: 'weekly_up_loose',
        label: '週間上昇率（素体）',
        icon: '💹',
        category: 'その他',
        color: '#22c55e',
        priceType: 'loose',
        sortBy: 'change_pct_desc',
        comingSoon: true,
    },
]

export const DEFAULT_VISIBLE_RANKINGS = [
    'loose_up_pct',
    'loose_down_pct',
    'graded_up_pct',
    'graded_down_pct',
    'high_price_loose',
    'purchase_up_pct',
    'purchase_down_pct',
]

export const RANKING_STORAGE_KEY = 'chart_rankings_v3'

export const CATEGORIES: Category[] = [
    { slug: 'all', name: '全体' },
    { slug: 'pokemon', name: 'ポケモン' },
]

// コンディション/グレードラベル（買取紐付け・チャート共通）
export const CONDITION_LABELS = ['素体', 'PSA10', '未開封', '開封済み'] as const
export type ConditionLabel = (typeof CONDITION_LABELS)[number]

// コンディション表示順（PurchasePriceTable等で使用）
export const CONDITION_SORT_ORDER = ['素体', 'PSA10', '未開封'] as const

// コンディション別スタイル
export const CONDITION_STYLES: Record<string, { bg: string; text: string }> = {
    '素体': { bg: 'bg-blue-50', text: 'text-blue-600' },
    'PSA10': { bg: 'bg-purple-50', text: 'text-purple-600' },
    '未開封': { bg: 'bg-cyan-50', text: 'text-cyan-600' },
}

// カテゴリスラグ → DBカテゴリ名マッピング
export const CATEGORY_SLUG_MAP: Record<string, string> = {
    pokemon: 'ポケモン',
}
