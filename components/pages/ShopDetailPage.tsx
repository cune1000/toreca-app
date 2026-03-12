'use client'

import { useState, useEffect, useCallback } from 'react'
import { getRarityDisplayName } from '@/lib/rarity-mapping'
import {
    ArrowLeft, Store, RefreshCw,
    ExternalLink,
    TrendingUp, Search, XCircle, ChevronLeft, ChevronRight
} from 'lucide-react'
import { supabase, fetchAllPaginated } from '@/lib/supabase'
import { buildKanaSearchFilter } from '@/lib/utils/kana'
import type { Shop, CategoryLarge } from '@/lib/types'

interface Props {
    shop: Shop
    onBack: () => void
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

export default function ShopDetailPage({ shop, onBack }: Props) {
    const [loading, setLoading] = useState(true)
    const [purchases, setPurchases] = useState<PurchaseRow[]>([])

    // 買取価格タブ用: カテゴリ・ページネーション
    const [purchaseSearchQuery, setPurchaseSearchQuery] = useState('')
    const [purchaseFilterLarge, setPurchaseFilterLarge] = useState('')
    const [purchaseFilterRarity, setPurchaseFilterRarity] = useState('')
    const [purchasePage, setPurchasePage] = useState(1)
    const [purchaseTotalCount, setPurchaseTotalCount] = useState(0)
    const [purchaseLoading, setPurchaseLoading] = useState(false)

    // カテゴリデータ
    const [categories, setCategories] = useState<CategoryLarge[]>([])
    const [rarityTexts, setRarityTexts] = useState<string[]>([])

    useEffect(() => {
        setLoading(false)
        loadCategories()
    }, [shop.id])

    // カテゴリ・レアリティ取得（初回のみ）
    const loadCategories = async () => {
        const catRes = await supabase.from('category_large').select('id, name, icon').order('sort_order')
        setCategories(catRes.data || [])

        // レアリティ: Supabase max_rows=1000制限を回避するためページネーション
        const allRarityRows = await fetchAllPaginated<{ rarity: string }>(
            () => supabase.from('cards').select('rarity').not('rarity', 'is', null)
        )
        const unique = [...new Set(allRarityRows.map(d => d.rarity).filter(Boolean))] as string[]
        unique.sort()
        setRarityTexts(unique)
    }

    // フィルタ変更時 → 1ページ目に戻る
    useEffect(() => {
        setPurchasePage(1)
    }, [purchaseSearchQuery, purchaseFilterLarge, purchaseFilterRarity])

    // 買取価格データ取得（2ステップ: カード絞り込み → 買取価格取得）
    const fetchPurchases = useCallback(async () => {
        setPurchaseLoading(true)

        const hasCardFilter = purchaseFilterLarge || purchaseFilterRarity || purchaseSearchQuery.length >= 2

        let cardIds: string[] | null = null

        // Step 1: カードフィルタがある場合、先にカードIDリストを取得
        if (hasCardFilter) {
            let cardQuery = supabase.from('cards').select('id')

            if (purchaseFilterLarge === UNSET) {
                cardQuery = cardQuery.is('category_large_id', null)
            } else if (purchaseFilterLarge) {
                cardQuery = cardQuery.eq('category_large_id', purchaseFilterLarge)
            }
            if (purchaseFilterRarity === UNSET) {
                cardQuery = cardQuery.is('rarity', null)
            } else if (purchaseFilterRarity) {
                cardQuery = cardQuery.eq('rarity', purchaseFilterRarity)
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
    }, [shop.id, purchaseSearchQuery, purchaseFilterLarge, purchaseFilterRarity, purchasePage])

    // 買取価格: フィルタ変更時にデータ再取得
    useEffect(() => {
        const timer = setTimeout(fetchPurchases, 300)
        return () => clearTimeout(timer)
    }, [fetchPurchases])

    // フィルタ用レアリティ
    const filteredRarities = rarityTexts

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
            </div>

            {/* 買取価格 */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="p-4 border-b border-gray-100 flex items-center gap-2">
                    <TrendingUp size={18} className="text-green-500" />
                    <h2 className="font-bold text-gray-800">買取価格 ({purchaseTotalCount}件)</h2>
                </div>

                {/* 検索 + カテゴリフィルタ */}
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
                            <option value="">全ゲーム</option>
                            <option value={UNSET}>未設定</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                            ))}
                        </select>
                        <select
                            value={purchaseFilterRarity}
                            onChange={(e) => setPurchaseFilterRarity(e.target.value)}
                            className="px-3 py-1.5 border rounded-lg text-sm"
                        >
                            <option value="">全レアリティ</option>
                            <option value={UNSET}>未設定</option>
                            {filteredRarities.map(r => (
                                <option key={r} value={r}>{getRarityDisplayName(r)}</option>
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
        </div>
    )
}
