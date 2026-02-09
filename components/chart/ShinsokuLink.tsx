'use client'

import { useState, useEffect } from 'react'

interface ShinsokuResult {
    item_id: string
    name: string
    type: string
    brand: string
    tags: { slug: string; label: string }[]
    modelno?: string
    rarity?: string
    image_url: string
    is_full_amount: boolean
    prices: {
        s: number | null
        a: number | null
        am: number | null
        b: number | null
        c: number | null
    }
}

const CONDITIONS = [
    { value: 'S', label: 'S', priceKey: 's' },
    { value: 'A', label: 'A', priceKey: 'a' },
    { value: 'A-', label: 'A-', priceKey: 'am' },
    { value: 'B', label: 'B', priceKey: 'b' },
    { value: 'C', label: 'C', priceKey: 'c' },
]

interface Props {
    cardId: string
    cardName: string
    linkedItemId?: string | null
    condition?: string
    onLinked?: (itemId: string, condition: string) => void
    onUnlinked?: () => void
    onConditionChanged?: (condition: string) => void
}

export default function ShinsokuLink({ cardId, cardName, linkedItemId, condition = 'S', onLinked, onUnlinked, onConditionChanged }: Props) {
    const [query, setQuery] = useState(cardName || '')
    const [results, setResults] = useState<ShinsokuResult[]>([])
    const [searching, setSearching] = useState(false)
    const [linking, setLinking] = useState(false)
    const [error, setError] = useState('')
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [total, setTotal] = useState(0)
    const [autoSearched, setAutoSearched] = useState(false)
    const [selectedCondition, setSelectedCondition] = useState(condition)

    const formatPrice = (p: number | null) => p != null ? `¥${p.toLocaleString()}` : '-'

    const search = async (q?: string) => {
        const searchQuery = q || query
        if (searchQuery.length < 2) {
            setError('2文字以上入力してください')
            return
        }
        setSearching(true)
        setError('')
        setResults([])
        try {
            const res = await fetch(`/api/shinsoku/search?q=${encodeURIComponent(searchQuery)}`)
            const json = await res.json()
            if (!json.success) throw new Error(json.error)
            setResults(json.data.items)
            setTotal(json.data.total)
            if (json.data.cache_empty) {
                setError('キャッシュが空です。管理者にshinsoku-syncの実行を依頼してください。')
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setSearching(false)
        }
    }

    // マウント時に自動検索（未紐付けの場合のみ）
    useEffect(() => {
        if (!autoSearched && cardName && cardName.length >= 2 && !linkedItemId) {
            setAutoSearched(true)
            search(cardName)
        }
    }, [cardName, linkedItemId])

    const link = async (itemId: string) => {
        setLinking(true)
        try {
            const res = await fetch('/api/shinsoku/link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    card_id: cardId,
                    shinsoku_item_id: itemId,
                    shinsoku_condition: selectedCondition,
                }),
            })
            const json = await res.json()
            if (!json.success) throw new Error(json.error)
            onLinked?.(itemId, selectedCondition)
            setSelectedId(itemId)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLinking(false)
        }
    }

    const unlink = async () => {
        setLinking(true)
        try {
            const res = await fetch(`/api/shinsoku/link?card_id=${cardId}`, { method: 'DELETE' })
            const json = await res.json()
            if (!json.success) throw new Error(json.error)
            onUnlinked?.()
            setSelectedId(null)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLinking(false)
        }
    }

    // 状態変更を保存
    const changeCondition = async (newCondition: string) => {
        setSelectedCondition(newCondition)
        if (currentLinked) {
            try {
                const res = await fetch('/api/shinsoku/link', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        card_id: cardId,
                        shinsoku_item_id: currentLinked,
                        shinsoku_condition: newCondition,
                    }),
                })
                const json = await res.json()
                if (json.success) {
                    onConditionChanged?.(newCondition)
                }
            } catch { }
        }
    }

    const currentLinked = selectedId || linkedItemId

    // 選択中のランクの価格キーを取得
    const getSelectedPriceKey = () => {
        return CONDITIONS.find(c => c.value === selectedCondition)?.priceKey || 's'
    }

    return (
        <div className="space-y-3">
            {/* 紐付け済み表示 */}
            {currentLinked && (
                <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-green-600 font-medium">✅ シンソク紐付け済み</p>
                            <p className="text-xs text-green-500 mt-0.5">ID: {currentLinked}</p>
                        </div>
                        <button
                            onClick={unlink}
                            disabled={linking}
                            className="text-xs px-3 py-1.5 bg-white border border-green-200 text-green-600 rounded-lg hover:bg-green-50 disabled:opacity-50"
                        >
                            紐付け解除
                        </button>
                    </div>
                    {/* ランク選択 */}
                    <div className="mt-2 flex items-center gap-2">
                        <span className="text-xs text-gray-500">追跡ランク:</span>
                        <div className="flex gap-1">
                            {CONDITIONS.map(c => (
                                <button
                                    key={c.value}
                                    onClick={() => changeCondition(c.value)}
                                    className={`px-2 py-1 text-xs rounded-md font-medium transition-colors ${selectedCondition === c.value
                                            ? 'bg-green-600 text-white'
                                            : 'bg-white border border-gray-200 text-gray-500 hover:border-green-300 hover:text-green-600'
                                        }`}
                                >
                                    {c.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* 検索フォーム */}
            <div className="flex gap-2">
                <input
                    type="text"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && search()}
                    placeholder="シンソクで検索..."
                    className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
                />
                <button
                    onClick={() => search()}
                    disabled={searching}
                    className="px-4 py-2.5 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-50 whitespace-nowrap"
                >
                    {searching ? '検索中...' : '🔍 検索'}
                </button>
            </div>

            {error && (
                <p className="text-xs text-red-500">{error}</p>
            )}

            {/* ランク選択（未紐付け時） */}
            {!currentLinked && results.length > 0 && (
                <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">紐付けランク:</span>
                    <div className="flex gap-1">
                        {CONDITIONS.map(c => (
                            <button
                                key={c.value}
                                onClick={() => setSelectedCondition(c.value)}
                                className={`px-2 py-1 text-xs rounded-md font-medium transition-colors ${selectedCondition === c.value
                                        ? 'bg-blue-600 text-white'
                                        : 'bg-white border border-gray-200 text-gray-500 hover:border-blue-300'
                                    }`}
                            >
                                {c.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* 検索結果 */}
            {results.length > 0 && (
                <div>
                    <p className="text-xs text-gray-400 mb-2">{total}件の候補</p>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {results.map(item => {
                            const priceKey = getSelectedPriceKey()
                            const selectedPrice = item.prices[priceKey as keyof typeof item.prices]
                            return (
                                <div
                                    key={item.item_id}
                                    className={`border rounded-xl p-3 transition-colors ${currentLinked === item.item_id
                                        ? 'border-green-300 bg-green-50'
                                        : 'border-gray-200 bg-white hover:border-gray-300'
                                        }`}
                                >
                                    <div className="flex gap-3">
                                        {/* 画像 */}
                                        {item.image_url ? (
                                            <img
                                                src={item.image_url}
                                                alt=""
                                                className="w-14 h-20 object-cover rounded-lg flex-shrink-0 bg-gray-100"
                                            />
                                        ) : (
                                            <div className="w-14 h-20 bg-gray-100 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">
                                                🃏
                                            </div>
                                        )}

                                        {/* 情報 */}
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-gray-900 truncate">{item.name}</p>
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${item.type === 'PSA' ? 'bg-purple-100 text-purple-700' :
                                                    item.type === 'BOX' ? 'bg-amber-100 text-amber-700' :
                                                        'bg-gray-100 text-gray-600'
                                                    }`}>
                                                    {item.type}
                                                </span>
                                                {item.tags?.map(tag => (
                                                    <span key={tag.slug} className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">
                                                        {tag.label}
                                                    </span>
                                                ))}
                                                {item.modelno && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                                                        {item.modelno}
                                                    </span>
                                                )}
                                                {item.is_full_amount && (
                                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-600">
                                                        減額なし
                                                    </span>
                                                )}
                                            </div>

                                            {/* 価格表示 - 選択ランクをハイライト */}
                                            <div className="flex items-center gap-3 mt-2">
                                                {CONDITIONS.map(c => {
                                                    const price = item.prices[c.priceKey as keyof typeof item.prices]
                                                    if (price == null) return null
                                                    const isSelected = c.value === selectedCondition
                                                    return (
                                                        <div key={c.value}>
                                                            <span className={`text-[10px] ${isSelected ? 'text-blue-600 font-bold' : 'text-gray-400'}`}>{c.label}</span>
                                                            <span className={`ml-1 ${isSelected ? 'text-sm font-bold text-blue-700' : 'text-xs text-gray-600'}`}>
                                                                {formatPrice(price)}
                                                            </span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        {/* 紐付けボタン */}
                                        <div className="flex-shrink-0 flex flex-col items-center justify-center gap-1">
                                            {currentLinked === item.item_id ? (
                                                <span className="text-xs text-green-600 font-medium px-3 py-2">✅ 紐付け済</span>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={() => link(item.item_id)}
                                                        disabled={linking}
                                                        className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                                                    >
                                                        紐付ける
                                                    </button>
                                                    {selectedPrice != null && (
                                                        <span className="text-[10px] text-gray-400">{selectedCondition}ランク</span>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    <p className="text-[10px] text-gray-300 mt-1">{item.item_id}</p>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* 検索中 */}
            {searching && (
                <div className="py-4 text-center">
                    <div className="inline-block w-5 h-5 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
                    <p className="text-xs text-gray-400 mt-2">候補を検索中...</p>
                </div>
            )}

            {/* 候補なし */}
            {autoSearched && !searching && results.length === 0 && !error && !currentLinked && (
                <p className="text-xs text-gray-400 text-center py-2">候補が見つかりませんでした。キーワードを変えて検索してください。</p>
            )}
        </div>
    )
}
