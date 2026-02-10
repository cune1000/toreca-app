'use client'

import { useState, useEffect } from 'react'

interface LoungeResult {
    productId: string
    name: string
    modelno: string
    rarity: string
    grade: string
    productFormat: string
    price: number
    key: string
    imageUrl: string
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

const LABEL_OPTIONS = ['素体', 'PSA10', '未開封', '開封済み']

export default function LoungeLink({ cardId, cardName, shopName = 'トレカラウンジ（郵送買取）', links, onLinksChanged }: Props) {
    const [query, setQuery] = useState(cardName || '')
    const [results, setResults] = useState<LoungeResult[]>([])
    const [searching, setSearching] = useState(false)
    const [linking, setLinking] = useState(false)
    const [error, setError] = useState('')
    const [total, setTotal] = useState(0)
    const [allCount, setAllCount] = useState(0)
    const [autoSearched, setAutoSearched] = useState(false)
    const [selectedLabel, setSelectedLabel] = useState('素体')
    const [showManualInput, setShowManualInput] = useState(false)
    const [manualName, setManualName] = useState('')
    const [manualModelno, setManualModelno] = useState('')

    const formatPrice = (p: number) => `¥${p.toLocaleString()}`

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
            const res = await fetch(`/api/toreca-lounge/search?q=${encodeURIComponent(searchQuery)}`)
            const json = await res.json()
            if (!json.success) throw new Error(json.error)
            setResults(json.data.items)
            setTotal(json.data.total)
            setAllCount(json.data.allCount)
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

    const addLink = async (externalKey: string, label: string) => {
        setLinking(true)
        try {
            const res = await fetch('/api/purchase-links', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    card_id: cardId,
                    shop_name: shopName,
                    external_key: externalKey,
                    label,
                    condition: label,
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

    const isLinked = (key: string) => links.some(l => l.external_key === key)

    return (
        <div className="space-y-3">
            {/* 紐付け済みリスト */}
            {links.length > 0 && (
                <div className="space-y-2">
                    {links.map(link => (
                        <div key={link.id} className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5 flex items-center justify-between">
                            <p className="text-xs text-orange-600 font-medium">
                                🏪 {link.label} — {link.external_key}
                            </p>
                            <button
                                onClick={() => removeLink(link.id)}
                                disabled={linking}
                                className="text-xs px-3 py-1.5 bg-white border border-orange-200 text-orange-600 rounded-lg hover:bg-orange-50 disabled:opacity-50"
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
                    placeholder="トレカラウンジで検索..."
                    className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-100 focus:border-orange-300"
                />
                <button
                    onClick={() => search()}
                    disabled={searching}
                    className="px-4 py-2.5 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 whitespace-nowrap"
                >
                    {searching ? '検索中...' : '🔍 検索'}
                </button>
            </div>

            {error && <p className="text-xs text-red-500">{error}</p>}

            {/* ラベル選択 */}
            <div className="flex gap-1.5 items-center">
                <span className="text-xs text-gray-500">ラベル:</span>
                <select
                    value={selectedLabel}
                    onChange={e => setSelectedLabel(e.target.value)}
                    className="px-2 py-1.5 border border-gray-200 rounded-lg text-xs"
                >
                    {LABEL_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
            </div>

            {/* 手動キー入力 */}
            <div>
                <button
                    onClick={() => setShowManualInput(!showManualInput)}
                    className="text-xs text-gray-400 hover:text-orange-500 underline"
                >
                    {showManualInput ? '▲ 手動入力を閉じる' : '▼ 手動でキーを入力'}
                </button>
                {showManualInput && (
                    <div className="mt-2 bg-gray-50 border border-gray-200 rounded-xl p-3">
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={manualName}
                                onChange={e => setManualName(e.target.value)}
                                placeholder="カード名"
                                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                            />
                            <input
                                type="text"
                                value={manualModelno}
                                onChange={e => setManualModelno(e.target.value)}
                                placeholder="型番"
                                className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                            />
                            <button
                                onClick={() => {
                                    if (manualName && manualModelno) addLink(`${manualName}::${manualModelno}`, selectedLabel)
                                }}
                                disabled={!manualName || !manualModelno || linking}
                                className="px-3 py-2 bg-orange-600 text-white rounded-lg text-xs font-medium hover:bg-orange-700 disabled:opacity-50 whitespace-nowrap"
                            >
                                追加
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* 検索結果 */}
            {results.length > 0 && (
                <div>
                    <p className="text-xs text-gray-400 mb-2">{total}件の候補（全{allCount}件中）</p>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {results.map(item => (
                            <div
                                key={item.key}
                                className={`border rounded-xl p-3 ${isLinked(item.key)
                                    ? 'border-orange-300 bg-orange-50'
                                    : 'border-gray-200 bg-white hover:border-gray-300'
                                    }`}
                            >
                                <div className="flex gap-3">
                                    {item.imageUrl ? (
                                        <img src={item.imageUrl} alt="" className="w-14 h-20 object-cover rounded-lg flex-shrink-0 bg-gray-100" />
                                    ) : (
                                        <div className="w-14 h-20 bg-gray-100 rounded-lg flex items-center justify-center text-2xl flex-shrink-0">🃏</div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-gray-900 truncate">{item.name}</p>
                                        <div className="flex flex-wrap gap-1 mt-1">
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">{item.modelno}</span>
                                            {item.grade && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">{item.grade}</span>}
                                            {item.productFormat && item.productFormat !== 'NORMAL' && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700">{item.productFormat}</span>
                                            )}
                                        </div>
                                        <div className="mt-2">
                                            <span className="text-sm font-bold text-orange-600">{formatPrice(item.price)}</span>
                                        </div>
                                    </div>
                                    <div className="flex-shrink-0 flex items-center">
                                        {isLinked(item.key) ? (
                                            <span className="text-xs text-orange-600 font-medium px-3 py-2">🏪 紐付済</span>
                                        ) : (
                                            <button
                                                onClick={() => addLink(item.key, selectedLabel)}
                                                disabled={linking}
                                                className="px-3 py-2 bg-orange-600 text-white rounded-lg text-xs font-medium hover:bg-orange-700 disabled:opacity-50"
                                            >
                                                紐付ける
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {searching && (
                <div className="py-4 text-center">
                    <div className="inline-block w-5 h-5 border-2 border-gray-200 border-t-orange-600 rounded-full animate-spin" />
                    <p className="text-xs text-gray-400 mt-2">全ページ取得中...</p>
                </div>
            )}
        </div>
    )
}
