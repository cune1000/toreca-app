'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import {
    ArrowLeft, Store, Radio, Power, RefreshCw, Twitter,
    Image, Clock, CheckCircle, AlertCircle, ExternalLink,
    TrendingUp, Package, Moon, Search, XCircle, ChevronLeft, ChevronRight
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { buildKanaSearchFilter } from '@/lib/utils/kana'
import type { Shop, CategoryLarge, CategoryMedium, CategorySmall, Rarity } from '@/lib/types'

interface Props {
    shop: Shop
    onBack: () => void
    onOpenTwitterFeed: () => void
}

interface MonitorSetting {
    shop_id: string
    is_active: boolean
    quiet_start: number
    quiet_end: number
    last_checked_at: string | null
    last_tweet_id: string | null
}

interface FetchedTweet {
    id: string
    tweet_id: string
    is_purchase_related: boolean
    is_pinned: boolean
    fetched_at: string
}

interface PendingImageRow {
    id: string
    image_url: string
    tweet_url: string
    tweet_time: string
    status: string
    created_at: string
}

interface PurchaseRow {
    id: string
    shop_id: string
    price: number
    created_at: string
    card: any
}

const UNSET = '__UNSET__'
const PURCHASES_PER_PAGE = 50

export default function ShopDetailPage({ shop, onBack, onOpenTwitterFeed }: Props) {
    const [loading, setLoading] = useState(true)
    const [monitor, setMonitor] = useState<MonitorSetting | null>(null)
    const [tweets, setTweets] = useState<FetchedTweet[]>([])
    const [pendingImages, setPendingImages] = useState<PendingImageRow[]>([])
    const [purchases, setPurchases] = useState<PurchaseRow[]>([])
    const [toggling, setToggling] = useState(false)
    const [activeTab, setActiveTab] = useState<'overview' | 'tweets' | 'pending' | 'purchases'>('overview')
    const [searchQuery, setSearchQuery] = useState('')
    const [tweetFilter, setTweetFilter] = useState<'all' | 'purchase' | 'pinned' | 'normal'>('all')
    const [pendingFilter, setPendingFilter] = useState<'all' | 'pending' | 'processing' | 'processed' | 'error'>('all')

    // 買取価格タブ用: カテゴリ・ページネーション
    const [purchaseSearchQuery, setPurchaseSearchQuery] = useState('')
    const [purchaseFilterLarge, setPurchaseFilterLarge] = useState('')
    const [purchaseFilterMedium, setPurchaseFilterMedium] = useState('')
    const [purchaseFilterSmall, setPurchaseFilterSmall] = useState('')
    const [purchaseFilterRarity, setPurchaseFilterRarity] = useState('')
    const [purchasePage, setPurchasePage] = useState(1)
    const [purchaseTotalCount, setPurchaseTotalCount] = useState(0)
    const [purchaseLoading, setPurchaseLoading] = useState(false)

    // カテゴリデータ
    const [categories, setCategories] = useState<CategoryLarge[]>([])
    const [mediumCategories, setMediumCategories] = useState<CategoryMedium[]>([])
    const [smallCategories, setSmallCategories] = useState<CategorySmall[]>([])
    const [rarities, setRarities] = useState<Rarity[]>([])

    useEffect(() => {
        loadData()
        loadCategories()
    }, [shop.id])

    // カテゴリ・レアリティ取得（初回のみ）
    const loadCategories = async () => {
        const [catRes, rarRes] = await Promise.all([
            supabase.from('category_large').select('id, name, icon').order('sort_order'),
            supabase.from('rarities').select('id, name, large_id').order('sort_order'),
        ])
        setCategories(catRes.data || [])
        setRarities(rarRes.data || [])
    }

    // 大カテゴリ変更 → 中カテゴリ取得
    useEffect(() => {
        if (purchaseFilterLarge && purchaseFilterLarge !== UNSET) {
            const fetchMedium = async () => {
                const { data } = await supabase
                    .from('category_medium').select('id, name, large_id')
                    .eq('large_id', purchaseFilterLarge).order('sort_order')
                setMediumCategories(data || [])
            }
            fetchMedium()
        } else {
            setMediumCategories([])
        }
        setPurchaseFilterMedium('')
        setPurchaseFilterSmall('')
    }, [purchaseFilterLarge])

    // 中カテゴリ変更 → 小カテゴリ取得
    useEffect(() => {
        if (purchaseFilterMedium && purchaseFilterMedium !== UNSET) {
            const fetchSmall = async () => {
                const { data } = await supabase
                    .from('category_small').select('id, name, medium_id')
                    .eq('medium_id', purchaseFilterMedium).order('sort_order')
                setSmallCategories(data || [])
            }
            fetchSmall()
        } else {
            setSmallCategories([])
        }
        setPurchaseFilterSmall('')
    }, [purchaseFilterMedium])

    // フィルタ変更時 → 1ページ目に戻る
    useEffect(() => {
        setPurchasePage(1)
    }, [purchaseSearchQuery, purchaseFilterLarge, purchaseFilterMedium, purchaseFilterSmall, purchaseFilterRarity])

    // 買取価格データ取得（2ステップ: カード絞り込み → 買取価格取得）
    const fetchPurchases = useCallback(async () => {
        setPurchaseLoading(true)

        const hasCardFilter = purchaseFilterLarge || purchaseFilterMedium || purchaseFilterSmall || purchaseFilterRarity || purchaseSearchQuery.length >= 2

        let cardIds: string[] | null = null

        // Step 1: カードフィルタがある場合、先にカードIDリストを取得
        if (hasCardFilter) {
            let cardQuery = supabase.from('cards').select('id')

            if (purchaseFilterLarge === UNSET) {
                cardQuery = cardQuery.is('category_large_id', null)
            } else if (purchaseFilterLarge) {
                cardQuery = cardQuery.eq('category_large_id', purchaseFilterLarge)
            }
            if (purchaseFilterMedium === UNSET) {
                cardQuery = cardQuery.is('category_medium_id', null)
            } else if (purchaseFilterMedium) {
                cardQuery = cardQuery.eq('category_medium_id', purchaseFilterMedium)
            }
            if (purchaseFilterSmall === UNSET) {
                cardQuery = cardQuery.is('category_small_id', null)
            } else if (purchaseFilterSmall) {
                cardQuery = cardQuery.eq('category_small_id', purchaseFilterSmall)
            }
            if (purchaseFilterRarity === UNSET) {
                cardQuery = cardQuery.is('rarity_id', null)
            } else if (purchaseFilterRarity) {
                cardQuery = cardQuery.eq('rarity_id', purchaseFilterRarity)
            }
            if (purchaseSearchQuery.length >= 2) {
                cardQuery = cardQuery.or(buildKanaSearchFilter(purchaseSearchQuery, ['name', 'card_number']))
            }

            const { data: cardData } = await cardQuery
            cardIds = (cardData || []).map(c => c.id)

            // マッチするカードがなければ空結果
            if (cardIds.length === 0) {
                setPurchases([])
                setPurchaseTotalCount(0)
                setPurchaseLoading(false)
                return
            }
        }

        // Step 2: purchase_prices取得
        let query = supabase
            .from('purchase_prices')
            .select('id, price, created_at, card:card_id(id, name, image_url)', { count: 'exact' })
            .eq('shop_id', shop.id)

        if (cardIds) {
            query = query.in('card_id', cardIds)
        }

        // ページネーション
        const from = (purchasePage - 1) * PURCHASES_PER_PAGE
        const to = from + PURCHASES_PER_PAGE - 1

        const { data, count, error } = await query
            .order('created_at', { ascending: false })
            .range(from, to)

        if (!error) {
            setPurchases((data || []) as any)
            setPurchaseTotalCount(count || 0)
        }
        setPurchaseLoading(false)
    }, [shop.id, purchaseSearchQuery, purchaseFilterLarge, purchaseFilterMedium, purchaseFilterSmall, purchaseFilterRarity, purchasePage])

    // 買取価格タブ: フィルタ変更時にデータ再取得
    useEffect(() => {
        if (activeTab === 'purchases') {
            const timer = setTimeout(fetchPurchases, 300)
            return () => clearTimeout(timer)
        }
    }, [activeTab, fetchPurchases])

    const loadData = async () => {
        setLoading(true)

        // 並列取得（買取価格はfetchPurchasesで別途取得）
        const [monitorRes, tweetsRes, pendingRes] = await Promise.all([
            supabase.from('shop_monitor_settings').select('*').eq('shop_id', shop.id).single(),
            supabase.from('fetched_tweets').select('*').eq('shop_id', shop.id).order('fetched_at', { ascending: false }).limit(50),
            supabase.from('pending_images').select('*').eq('shop_id', shop.id).order('created_at', { ascending: false }).limit(50),
        ])

        setMonitor(monitorRes.data || null)
        setTweets(tweetsRes.data || [])
        setPendingImages(pendingRes.data || [])
        setLoading(false)
    }

    const toggleMonitor = async () => {
        setToggling(true)
        if (!monitor) {
            // 新規作成
            const { data } = await supabase.from('shop_monitor_settings').insert({
                shop_id: shop.id,
                is_active: true
            }).select().single()
            setMonitor(data)
        } else {
            await supabase.from('shop_monitor_settings')
                .update({ is_active: !monitor.is_active, updated_at: new Date().toISOString() })
                .eq('shop_id', shop.id)
            setMonitor({ ...monitor, is_active: !monitor.is_active })
        }
        setToggling(false)
    }

    const updateQuietHours = async (start: number, end: number) => {
        if (!monitor) return
        await supabase.from('shop_monitor_settings')
            .update({ quiet_start: start, quiet_end: end, updated_at: new Date().toISOString() })
            .eq('shop_id', shop.id)
        setMonitor({ ...monitor, quiet_start: start, quiet_end: end })
    }

    const purchaseCount = tweets.filter(t => t.is_purchase_related).length
    const pinnedCount = tweets.filter(t => t.is_pinned).length

    // フィルタされたデータ
    const filteredTweets = useMemo(() => {
        let result = tweets
        if (tweetFilter === 'purchase') result = result.filter(t => t.is_purchase_related)
        else if (tweetFilter === 'pinned') result = result.filter(t => t.is_pinned)
        else if (tweetFilter === 'normal') result = result.filter(t => !t.is_purchase_related && !t.is_pinned)
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            result = result.filter(t => t.tweet_id.toLowerCase().includes(q))
        }
        return result
    }, [tweets, tweetFilter, searchQuery])

    const filteredPending = useMemo(() => {
        let result = pendingImages
        if (pendingFilter !== 'all') result = result.filter(img => img.status === pendingFilter)
        if (searchQuery) {
            const q = searchQuery.toLowerCase()
            result = result.filter(img => img.tweet_url?.toLowerCase().includes(q) || img.status.toLowerCase().includes(q))
        }
        return result
    }, [pendingImages, pendingFilter, searchQuery])

    // フィルタ用レアリティ（カテゴリで絞り込み）
    const filteredRarities = purchaseFilterLarge && purchaseFilterLarge !== UNSET
        ? rarities.filter(r => (r as any).large_id === purchaseFilterLarge)
        : rarities

    const purchaseTotalPages = Math.ceil(purchaseTotalCount / PURCHASES_PER_PAGE)

    if (loading) {
        return (
            <div className="p-6 flex items-center justify-center min-h-[400px]">
                <RefreshCw size={32} className="animate-spin text-blue-500" />
            </div>
        )
    }

    return (
        <div className="p-6 max-w-6xl mx-auto">
            {/* ヘッダー */}
            <div className="flex items-center gap-4 mb-6">
                <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg">
                    <ArrowLeft size={20} className="text-gray-600" />
                </button>
                <div className="flex items-center gap-4 flex-1">
                    {shop.icon ? (
                        <img src={shop.icon} alt={shop.name} className="w-16 h-16 rounded-full object-cover border-2 border-gray-200" />
                    ) : shop.x_account ? (
                        <img src={`https://unavatar.io/twitter/${shop.x_account}`} alt={shop.name} className="w-16 h-16 rounded-full object-cover" />
                    ) : (
                        <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
                            <Store size={32} className="text-gray-400" />
                        </div>
                    )}
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">{shop.name}</h1>
                        {shop.x_account && (
                            <a href={`https://x.com/${shop.x_account}`} target="_blank" rel="noopener noreferrer"
                                className="text-blue-500 text-sm hover:underline flex items-center gap-1">
                                @{shop.x_account} <ExternalLink size={12} />
                            </a>
                        )}
                    </div>
                </div>

                {/* 監視トグル */}
                {shop.x_account && (
                    <button
                        onClick={toggleMonitor}
                        disabled={toggling}
                        className={`px-5 py-2.5 rounded-lg flex items-center gap-2 font-medium transition-all ${monitor?.is_active
                            ? 'bg-green-100 text-green-700 hover:bg-green-200 border-2 border-green-300'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200 border-2 border-gray-300'
                            }`}
                    >
                        {monitor?.is_active ? <Radio size={18} /> : <Power size={18} />}
                        {monitor?.is_active ? '監視中' : '監視OFF'}
                    </button>
                )}
            </div>

            {/* ステータスカード */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                    <p className="text-xs text-gray-500 mb-1">取得ツイート</p>
                    <p className="text-2xl font-bold text-gray-800">{tweets.length}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                    <p className="text-xs text-gray-500 mb-1">買取表検出</p>
                    <p className="text-2xl font-bold text-purple-600">{purchaseCount}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                    <p className="text-xs text-gray-500 mb-1">保留画像</p>
                    <p className="text-2xl font-bold text-blue-600">{pendingImages.length}</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                    <p className="text-xs text-gray-500 mb-1">買取価格</p>
                    <p className="text-2xl font-bold text-green-600">{purchases.length}</p>
                </div>
            </div>

            {/* 監視設定エリア */}
            {monitor && shop.x_account && (
                <div className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm mb-6">
                    <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                        <Moon size={18} className="text-indigo-500" />
                        監視設定
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">休止開始（JST）</label>
                            <select
                                value={monitor.quiet_start}
                                onChange={(e) => updateQuietHours(Number(e.target.value), monitor.quiet_end)}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                            >
                                {Array.from({ length: 24 }, (_, i) => (
                                    <option key={i} value={i}>{i}時</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">休止終了（JST）</label>
                            <select
                                value={monitor.quiet_end}
                                onChange={(e) => updateQuietHours(monitor.quiet_start, Number(e.target.value))}
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                            >
                                {Array.from({ length: 24 }, (_, i) => (
                                    <option key={i} value={i}>{i}時</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs text-gray-500 mb-1">最終チェック</label>
                            <p className="px-3 py-2 text-sm text-gray-700">
                                {monitor.last_checked_at
                                    ? new Date(monitor.last_checked_at).toLocaleString('ja-JP')
                                    : 'まだチェックされていません'}
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* タブ */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
                {[
                    { key: 'overview' as const, label: '概要', icon: Store },
                    { key: 'tweets' as const, label: `ツイート (${tweets.length})`, icon: Twitter },
                    { key: 'pending' as const, label: `保留画像 (${pendingImages.length})`, icon: Image },
                    { key: 'purchases' as const, label: `買取価格 (${purchaseTotalCount})`, icon: TrendingUp },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-colors ${activeTab === tab.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        <tab.icon size={14} />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* 検索バー（概要タブ以外・purchasesタブ以外で表示） */}
            {activeTab !== 'overview' && activeTab !== 'purchases' && (
                <div className="flex items-center gap-3 mb-4">
                    <div className="relative flex-1">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            placeholder={
                                activeTab === 'tweets' ? 'ツイートIDで検索...'
                                    : 'URLで検索...'
                            }
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-10 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <XCircle size={14} />
                            </button>
                        )}
                    </div>

                    {/* タブごとのフィルタ */}
                    {activeTab === 'tweets' && (
                        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                            {[
                                { key: 'all' as const, label: '全て' },
                                { key: 'purchase' as const, label: '買取表' },
                                { key: 'pinned' as const, label: '固定' },
                                { key: 'normal' as const, label: '通常' },
                            ].map(f => (
                                <button
                                    key={f.key}
                                    onClick={() => setTweetFilter(f.key)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tweetFilter === f.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    )}
                    {activeTab === 'pending' && (
                        <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5">
                            {[
                                { key: 'all' as const, label: '全て' },
                                { key: 'pending' as const, label: '保留中' },
                                { key: 'processing' as const, label: '解析中' },
                                { key: 'processed' as const, label: '解析済' },
                                { key: 'error' as const, label: 'エラー' },
                            ].map(f => (
                                <button
                                    key={f.key}
                                    onClick={() => setPendingFilter(f.key)}
                                    className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${pendingFilter === f.key ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* タブコンテンツ */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                {activeTab === 'overview' && (
                    <div className="p-6 space-y-4">
                        <div className="flex items-center gap-3">
                            <Store size={20} className="text-gray-400" />
                            <div>
                                <p className="text-sm text-gray-500">店舗名</p>
                                <p className="font-medium text-gray-800">{shop.name}</p>
                            </div>
                        </div>
                        {shop.x_account && (
                            <div className="flex items-center gap-3">
                                <Twitter size={20} className="text-blue-400" />
                                <div>
                                    <p className="text-sm text-gray-500">Xアカウント</p>
                                    <p className="font-medium text-blue-600">@{shop.x_account}</p>
                                </div>
                            </div>
                        )}
                        <div className="flex items-center gap-3">
                            <Package size={20} className="text-gray-400" />
                            <div>
                                <p className="text-sm text-gray-500">固定ツイート（スキップ済み）</p>
                                <p className="font-medium text-gray-800">{pinnedCount}件</p>
                            </div>
                        </div>

                        {shop.x_account && (
                            <button
                                onClick={onOpenTwitterFeed}
                                className="mt-4 px-5 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
                            >
                                <Twitter size={18} />
                                Xフィードを開く
                            </button>
                        )}
                    </div>
                )}

                {activeTab === 'tweets' && (
                    <div className="divide-y divide-gray-50">
                        {filteredTweets.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                <Twitter size={40} className="mx-auto mb-3 text-gray-300" />
                                <p>{searchQuery || tweetFilter !== 'all' ? '条件に一致するツイートがありません' : '取得済みのツイートはありません'}</p>
                            </div>
                        ) : (
                            filteredTweets.map(tweet => (
                                <div key={tweet.id} className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        {tweet.is_pinned ? (
                                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs font-medium">固定</span>
                                        ) : tweet.is_purchase_related ? (
                                            <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">買取表</span>
                                        ) : (
                                            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-xs">通常</span>
                                        )}
                                        <span className="text-sm text-gray-600 font-mono">{tweet.tweet_id}</span>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-gray-400">
                                            {new Date(tweet.fetched_at).toLocaleString('ja-JP')}
                                        </span>
                                        <a
                                            href={`https://x.com/${shop.x_account}/status/${tweet.tweet_id}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-500 hover:text-blue-700"
                                        >
                                            <ExternalLink size={14} />
                                        </a>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'pending' && (
                    <div className="divide-y divide-gray-50">
                        {filteredPending.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">
                                <Image size={40} className="mx-auto mb-3 text-gray-300" />
                                <p>{searchQuery || pendingFilter !== 'all' ? '条件に一致する画像がありません' : '保留画像はありません'}</p>
                            </div>
                        ) : (
                            filteredPending.map(img => (
                                <div key={img.id} className="p-4 flex items-center gap-4">
                                    {img.image_url && (
                                        <img src={img.image_url} alt="" className="w-20 h-20 object-cover rounded-lg border" />
                                    )}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            {img.status === 'processed' ? (
                                                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-medium flex items-center gap-1">
                                                    <CheckCircle size={12} /> 解析済
                                                </span>
                                            ) : img.status === 'processing' ? (
                                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium flex items-center gap-1">
                                                    <RefreshCw size={12} className="animate-spin" /> 解析中
                                                </span>
                                            ) : img.status === 'error' ? (
                                                <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium flex items-center gap-1">
                                                    <AlertCircle size={12} /> エラー
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded text-xs font-medium flex items-center gap-1">
                                                    <Clock size={12} /> 保留中
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-400">
                                            {new Date(img.created_at).toLocaleString('ja-JP')}
                                        </p>
                                    </div>
                                    {img.tweet_url && (
                                        <a href={img.tweet_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:text-blue-700">
                                            <ExternalLink size={14} />
                                        </a>
                                    )}
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'purchases' && (
                    <div>
                        {/* 買取価格専用: 検索 + カテゴリフィルタ */}
                        <div className="p-4 border-b border-gray-100">
                            <div className="flex gap-3 items-center mb-3">
                                <div className="relative flex-1 max-w-md">
                                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                    <input
                                        type="text"
                                        value={purchaseSearchQuery}
                                        onChange={(e) => setPurchaseSearchQuery(e.target.value)}
                                        placeholder="カード名で検索（2文字以上・ひらがなOK）"
                                        className="w-full pl-10 pr-10 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    {purchaseSearchQuery && (
                                        <button
                                            onClick={() => setPurchaseSearchQuery('')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            <XCircle size={14} />
                                        </button>
                                    )}
                                </div>
                                <span className="text-sm text-gray-500 whitespace-nowrap">
                                    {purchaseTotalCount}件中 {purchaseTotalCount > 0 ? Math.min((purchasePage - 1) * PURCHASES_PER_PAGE + 1, purchaseTotalCount) : 0}-{Math.min(purchasePage * PURCHASES_PER_PAGE, purchaseTotalCount)}件
                                </span>
                            </div>
                            <div className="flex gap-2 flex-wrap items-center">
                                <select
                                    value={purchaseFilterLarge}
                                    onChange={(e) => setPurchaseFilterLarge(e.target.value)}
                                    className="px-3 py-1.5 border rounded-lg text-sm"
                                >
                                    <option value="">全カテゴリ</option>
                                    <option value={UNSET}>⚠️ 未設定</option>
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                                    ))}
                                </select>
                                <select
                                    value={purchaseFilterMedium}
                                    onChange={(e) => setPurchaseFilterMedium(e.target.value)}
                                    className="px-3 py-1.5 border rounded-lg text-sm"
                                    disabled={!purchaseFilterLarge || purchaseFilterLarge === UNSET}
                                >
                                    <option value="">全世代</option>
                                    <option value={UNSET}>⚠️ 未設定</option>
                                    {mediumCategories.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                                <select
                                    value={purchaseFilterSmall}
                                    onChange={(e) => setPurchaseFilterSmall(e.target.value)}
                                    className="px-3 py-1.5 border rounded-lg text-sm"
                                    disabled={!purchaseFilterMedium || purchaseFilterMedium === UNSET}
                                >
                                    <option value="">全パック</option>
                                    <option value={UNSET}>⚠️ 未設定</option>
                                    {smallCategories.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                                <select
                                    value={purchaseFilterRarity}
                                    onChange={(e) => setPurchaseFilterRarity(e.target.value)}
                                    className="px-3 py-1.5 border rounded-lg text-sm"
                                >
                                    <option value="">全レアリティ</option>
                                    <option value={UNSET}>⚠️ 未設定</option>
                                    {filteredRarities.map(r => (
                                        <option key={r.id} value={r.id}>{r.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* 買取価格リスト */}
                        <div className="divide-y divide-gray-50">
                            {purchaseLoading ? (
                                <div className="p-8 text-center">
                                    <RefreshCw size={32} className="animate-spin mx-auto text-gray-400" />
                                </div>
                            ) : purchases.length === 0 ? (
                                <div className="p-8 text-center text-gray-500">
                                    <TrendingUp size={40} className="mx-auto mb-3 text-gray-300" />
                                    <p>{purchaseSearchQuery || purchaseFilterLarge || purchaseFilterRarity ? '条件に一致する買取データがありません' : '買取価格データはありません'}</p>
                                </div>
                            ) : (
                                purchases.map(p => (
                                    <div key={p.id} className="p-4 flex items-center gap-4">
                                        {p.card?.image_url && (
                                            <img src={p.card.image_url} alt="" className="w-12 h-12 object-cover rounded-lg border" />
                                        )}
                                        <div className="flex-1">
                                            <p className="font-medium text-gray-800">{p.card?.name || '不明'}</p>
                                            <p className="text-xs text-gray-400">
                                                {new Date(p.created_at).toLocaleString('ja-JP')}
                                            </p>
                                        </div>
                                        <p className="text-lg font-bold text-green-600">¥{p.price.toLocaleString()}</p>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* ページネーション */}
                        {purchaseTotalPages > 1 && (
                            <div className="p-4 border-t flex items-center justify-center gap-2">
                                <button
                                    onClick={() => setPurchasePage(p => Math.max(1, p - 1))}
                                    disabled={purchasePage === 1}
                                    className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1 text-sm"
                                >
                                    <ChevronLeft size={14} /> 前
                                </button>
                                {Array.from({ length: Math.min(5, purchaseTotalPages) }, (_, i) => {
                                    let page = i + 1
                                    if (purchaseTotalPages > 5) {
                                        if (purchasePage > 3) page = purchasePage - 2 + i
                                        if (purchasePage > purchaseTotalPages - 2) page = purchaseTotalPages - 4 + i
                                    }
                                    return (
                                        <button
                                            key={page}
                                            onClick={() => setPurchasePage(page)}
                                            className={`px-3 py-1 rounded text-sm ${purchasePage === page ? 'bg-blue-500 text-white' : 'border hover:bg-gray-50'}`}
                                        >
                                            {page}
                                        </button>
                                    )
                                })}
                                <button
                                    onClick={() => setPurchasePage(p => Math.min(purchaseTotalPages, p + 1))}
                                    disabled={purchasePage === purchaseTotalPages}
                                    className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1 text-sm"
                                >
                                    次 <ChevronRight size={14} />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}
