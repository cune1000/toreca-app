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
    { slug: 'onepiece', name: 'ワンピース' },
    { slug: 'yugioh', name: '遊戯王' },
    { slug: 'mtg', name: 'MTG' },
    { slug: 'duelma', name: 'デュエマ' },
]

// カテゴリスラグ → DBカテゴリ名マッピング
export const CATEGORY_SLUG_MAP: Record<string, string> = {
    pokemon: 'ポケモン',
    onepiece: 'ワンピース',
    yugioh: '遊戯王',
    mtg: 'MTG',
    duelma: 'デュエルマスターズ',
}
