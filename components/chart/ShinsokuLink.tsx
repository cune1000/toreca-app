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

interface PurchaseLink {
    id: string
    external_key: string
    label: string
    condition: string
    shop: { id: string; name: string }
}

interface Props {
    cardId: string
    cardName: string
    shopName?: string
    links: PurchaseLink[]
    onLinksChanged?: () => void
}

const LABEL_OPTIONS = [
    { value: '素体', label: '素体' },
    { value: 'PSA10', label: 'PSA10' },
    { value: '未開封', label: '未開封' },
    { value: '開封済み', label: '開封済み' },
]

const CONDITION_OPTIONS = [
    { value: 'S', label: 'S (美品)' },
    { value: 'A', label: 'A' },
    { value: 'A-', label: 'A-' },
    { value: 'B', label: 'B' },
    { value: 'C', label: 'C' },
]

export default function ShinsokuLink({ cardId, cardName, shopName = 'シンソク（郵送買取）', links, onLinksChanged }: Props) {
    const [query, setQuery] = useState(cardName || '')
    const [results, setResults] = useState<ShinsokuResult[]>([])
    const [searching, setSearching] = useState(false)
    const [linking, setLinking] = useState(false)
    const [error, setError] = useState('')
    const [selectedCondition, setSelectedCondition] = useState('S')
    const [selectedLabel, setSelectedLabel] = useState('素体')
    const [autoSearched, setAutoSearched] = useState(false)
    const [showManualInput, setShowManualInput] = useState(false)
    const [manualId, setManualId] = useState('')
    const [manualLabel, setManualLabel] = useState('素体')

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
            setResults(json.data?.items || json.data || [])
        } catch (err: any) {
            setError(err.message)
        } finally {
            setSearching(false)
        }
    }

    useEffect(() => {
        if (!autoSearched && cardName && cardName.length >= 2 && links.length === 0) {
            setAutoSearched(true)
            search(cardName)
        }
    }, [cardName, links.length])

    const addLink = async (externalKey: string, label: string, condition: string) => {
        setLinking(true)
        try {
            const res = await fetch('/api/purchase-links', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    card_id: cardId,
                    shop_name: shopName,
                    external_key: externalKey,
                    label: label,
                    condition,
                }),
            })
            const json = await res.json()
            if (!json.success) throw new Error(json.error)
            onLinksChanged?.()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLinking(false)
        }
    }

    const removeLink = async (linkId: string) => {
        setLinking(true)
        try {
            const res = await fetch(`/api/purchase-links?link_id=${linkId}`, { method: 'DELETE' })
            const json = await res.json()
            if (!json.success) throw new Error(json.error)
            onLinksChanged?.()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLinking(false)
        }
    }

    const isLinked = (itemId: string) => links.some(l => l.external_key === itemId)

    return (
        <div className="space-y-3">
            {/* 紐付け済みリスト */}
            {links.length > 0 && (
                <div className="space-y-2">
                    {links.map(link => (
                        <div key={link.id} className="bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 flex items-center justify-between">
                            <div>
                                <p className="text-xs text-green-600 font-medium">
                                    🔗 {link.label || link.condition} — {link.external_key}
                                </p>
                            </div>
                            <button
                                onClick={() => removeLink(link.id)}
                                disabled={linking}
                                className="text-xs px-3 py-1.5 bg-white border border-green-200 text-green-600 rounded-lg hover:bg-green-50 disabled:opacity-50"
                            >
                                解除
                            </button>
                        </div>
                    ))}
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
                    className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-100 focus:border-green-300"
                />
                <button
                    onClick={() => search()}
                    disabled={searching}
                    className="px-4 py-2.5 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-50 whitespace-nowrap"
                >
                    {searching ? '検索中...' : '🔍 検索'}
                </button>
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            {/* ラベル + 状態選択（ドロップダウン） */}
            <div className="flex gap-3 items-center">
                <div className="flex gap-1.5 items-center">
                    <span className="text-xs text-gray-500">ラベル:</span>
                    <select
                        value={selectedLabel}
                        onChange={e => setSelectedLabel(e.target.value)}
                        className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs"
                    >
                        {LABEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </div>
                <div className="flex gap-1.5 items-center">
                    <span className="text-xs text-gray-500">状態:</span>
                    <select
                        value={selectedCondition}
                        onChange={e => setSelectedCondition(e.target.value)}
                        className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs"
                    >
                        {CONDITION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                </div>
            </div>

            {/* 手動ID入力 */}
            <div>
                <button
                    onClick={() => setShowManualInput(!showManualInput)}
                    className="text-xs text-gray-400 hover:text-green-500 underline"
                >
                    {showManualInput ? '▲ 手動入力を閉じる' : '▼ 手動でitem_idを入力'}
                </button>
                {showManualInput && (
                    <div className="mt-2 bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={manualId}
                                onChange={e => setManualId(e.target.value)}
                                placeholder="item_id (例: IAP2500002298)"
                                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                            />
                            <select
                                value={manualLabel}
                                onChange={e => setManualLabel(e.target.value)}
                                className="px-2 py-2 border border-gray-200 rounded-lg text-sm"
                            >
                                {LABEL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            <button
                                onClick={() => {
                                    if (manualId) addLink(manualId, manualLabel, selectedCondition)
                                }}
                                disabled={!manualId || linking}
                                className="px-3 py-2 bg-gray-800 text-white rounded-lg text-xs font-medium hover:bg-gray-900 disabled:opacity-50 whitespace-nowrap"
                            >
                                追加
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* 検索結果 */}
            {results.length > 0 && (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {results.map(item => (
                        <div
                            key={item.item_id}
                            className={`border rounded-xl p-3 ${isLinked(item.item_id)
                                ? 'border-green-300 bg-green-50'
                                : 'border-gray-200 bg-white hover:border-gray-300'
                                }`}
                        >
                            <div className="flex gap-3">
                                <img src={item.image_url} alt="" className="w-14 h-20 object-cover rounded-lg flex-shrink-0 bg-gray-100" />
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-gray-900 truncate">{item.name}</p>
                                    <div className="flex flex-wrap gap-1 mt-1">
                                        {item.modelno && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">{item.modelno}</span>}
                                        {item.rarity && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">{item.rarity}</span>}
                                        {item.type && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-50 text-purple-600">{item.type}</span>}
                                    </div>
                                    <div className="flex gap-2 mt-1.5 text-[10px] text-gray-500">
                                        <span>S: {formatPrice(item.prices?.s)}</span>
                                        <span>A: {formatPrice(item.prices?.a)}</span>
                                        <span>B: {formatPrice(item.prices?.b)}</span>
                                    </div>
                                </div>
                                <div className="flex-shrink-0 flex items-center">
                                    {isLinked(item.item_id) ? (
                                        <span className="text-xs text-green-600 font-medium px-3 py-2">✅ 紐付済</span>
                                    ) : (
                                        <button
                                            onClick={() => addLink(item.item_id, selectedLabel, selectedCondition)}
                                            disabled={linking}
                                            className="px-3 py-2 bg-gray-800 text-white rounded-lg text-xs font-medium hover:bg-gray-900 disabled:opacity-50"
                                        >
                                            紐付ける
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {searching && (
                <div className="py-4 text-center">
                    <div className="inline-block w-5 h-5 border-2 border-gray-200 border-t-green-600 rounded-full animate-spin" />
                    <p className="text-xs text-gray-400 mt-2">検索中...</p>
                </div>
            )}
        </div>
    )
}
