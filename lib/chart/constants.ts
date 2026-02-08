import { RankingDef, Category } from './types'

export const ALL_RANKINGS: RankingDef[] = [
    {
        id: 'sale_up_pct',
        label: '販売価格 上昇率',
        icon: '📈',
        category: '販売',
        color: '#ef4444',
        dataSource: 'sale',
        sortBy: 'change_pct_desc'
    },
    {
        id: 'sale_down_pct',
        label: '販売価格 下落率',
        icon: '📉',
        category: '販売',
        color: '#3b82f6',
        dataSource: 'sale',
        sortBy: 'change_pct_asc'
    },
    {
        id: 'sale_up_yen',
        label: '販売価格 上昇金額',
        icon: '💹',
        category: '販売',
        color: '#f97316',
        dataSource: 'sale',
        sortBy: 'change_yen_desc'
    },
    {
        id: 'sale_down_yen',
        label: '販売価格 下落金額',
        icon: '💸',
        category: '販売',
        color: '#6366f1',
        dataSource: 'sale',
        sortBy: 'change_yen_asc'
    },
    {
        id: 'purchase_up_pct',
        label: '買取価格 上昇率',
        icon: '🔥',
        category: '買取',
        color: '#dc2626',
        dataSource: 'purchase',
        sortBy: 'change_pct_desc'
    },
    {
        id: 'purchase_down_pct',
        label: '買取価格 下落率',
        icon: '❄️',
        category: '買取',
        color: '#2563eb',
        dataSource: 'purchase',
        sortBy: 'change_pct_asc'
    },
    {
        id: 'psa_up_pct',
        label: 'PSA鑑定品 上昇率',
        icon: '⭐',
        category: 'PSA',
        color: '#eab308',
        dataSource: 'psa',
        sortBy: 'change_pct_desc',
        comingSoon: true
    },
    {
        id: 'psa_down_pct',
        label: 'PSA鑑定品 下落率',
        icon: '🌙',
        category: 'PSA',
        color: '#a855f7',
        dataSource: 'psa',
        sortBy: 'change_pct_asc',
        comingSoon: true
    },
    {
        id: 'box_up_pct',
        label: 'BOX 上昇率',
        icon: '📦',
        category: 'BOX',
        color: '#22c55e',
        dataSource: 'box',
        sortBy: 'change_pct_desc',
        comingSoon: true
    },
    {
        id: 'box_down_pct',
        label: 'BOX 下落率',
        icon: '📭',
        category: 'BOX',
        color: '#14b8a6',
        dataSource: 'box',
        sortBy: 'change_pct_asc',
        comingSoon: true
    },
    {
        id: 'condition_a_up',
        label: '美品(A) 上昇率',
        icon: '✨',
        category: '状態別',
        color: '#ec4899',
        dataSource: 'condition_a',
        sortBy: 'change_pct_desc',
        comingSoon: true
    },
    {
        id: 'high_price',
        label: '高額ランキング',
        icon: '👑',
        category: 'その他',
        color: '#f59e0b',
        dataSource: 'sale',
        sortBy: 'price_desc'
    },
]

export const DEFAULT_VISIBLE_RANKINGS = [
    'sale_up_pct',
    'sale_down_pct',
    'purchase_up_pct',
    'purchase_down_pct',
    'high_price',
]

export const RANKING_STORAGE_KEY = 'chart_rankings_v1'

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
