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

interface Props {
    cardId: string
    cardName: string
    linkedKey?: string | null
    onLinked?: (key: string) => void
    onUnlinked?: () => void
}

export default function LoungeLink({ cardId, cardName, linkedKey, onLinked, onUnlinked }: Props) {
    const [query, setQuery] = useState(cardName || '')
    const [results, setResults] = useState<LoungeResult[]>([])
    const [searching, setSearching] = useState(false)
    const [linking, setLinking] = useState(false)
    const [error, setError] = useState('')
    const [selectedKey, setSelectedKey] = useState<string | null>(null)
    const [total, setTotal] = useState(0)
    const [autoSearched, setAutoSearched] = useState(false)
    const [showManualInput, setShowManualInput] = useState(false)
    const [manualKey, setManualKey] = useState('')
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
        } catch (err: any) {
            setError(err.message)
        } finally {
            setSearching(false)
        }
    }

    // マウント時に自動検索
    useEffect(() => {
        if (!autoSearched && cardName && cardName.length >= 2 && !linkedKey) {
            setAutoSearched(true)
            search(cardName)
        }
    }, [cardName, linkedKey])

    const link = async (key: string) => {
        setLinking(true)
        try {
            const res = await fetch('/api/toreca-lounge/link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    card_id: cardId,
                    lounge_card_key: key,
                }),
            })
            const json = await res.json()
            if (!json.success) throw new Error(json.error)
            onLinked?.(key)
            setSelectedKey(key)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLinking(false)
        }
    }

    const unlink = async () => {
        setLinking(true)
        try {
            const res = await fetch(`/api/toreca-lounge/link?card_id=${cardId}`, { method: 'DELETE' })
            const json = await res.json()
            if (!json.success) throw new Error(json.error)
            onUnlinked?.()
            setSelectedKey(null)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLinking(false)
        }
    }

    const currentLinked = selectedKey || linkedKey

    return (
        <div className="space-y-3">
            {/* 紐付け済み表示 */}
            {currentLinked && (
                <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-xs text-orange-600 font-medium">🏪 トレカラウンジ紐付け済み</p>
                            <p className="text-xs text-orange-500 mt-0.5">キー: {currentLinked}</p>
                        </div>
                        <button
                            onClick={unlink}
                            disabled={linking}
                            className="text-xs px-3 py-1.5 bg-white border border-orange-200 text-orange-600 rounded-lg hover:bg-orange-50 disabled:opacity-50"
                        >
                            紐付け解除
                        </button>
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

            {error && (
                <p className="text-xs text-red-500">{error}</p>
            )}

            {/* 手動キー入力 */}
            {!currentLinked && (
                <div>
                    <button
                        onClick={() => setShowManualInput(!showManualInput)}
                        className="text-xs text-gray-400 hover:text-orange-500 underline"
                    >
                        {showManualInput ? '▲ 手動入力を閉じる' : '▼ 検索で見つからない場合は手動でキーを入力'}
                    </button>
                    {showManualInput && (
                        <div className="mt-2 bg-gray-50 border border-gray-200 rounded-xl p-3 space-y-2">
                            <p className="text-[10px] text-gray-400">
                                カード名と型番を入力してください（例: カード名「リーリエ」型番「397/SM-P」→ キー「リーリエ::397/SM-P」）
                            </p>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={manualName}
                                    onChange={e => setManualName(e.target.value)}
                                    placeholder="カード名"
                                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-100"
                                />
                                <input
                                    type="text"
                                    value={manualModelno}
                                    onChange={e => setManualModelno(e.target.value)}
                                    placeholder="型番"
                                    className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-orange-100"
                                />
                                <button
                                    onClick={() => {
                                        if (manualName && manualModelno) {
                                            link(`${manualName}::${manualModelno}`)
                                        }
                                    }}
                                    disabled={!manualName || !manualModelno || linking}
                                    className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm font-medium hover:bg-orange-700 disabled:opacity-50 whitespace-nowrap"
                                >
                                    {linking ? '処理中...' : '紐付ける'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* 検索結果 */}
            {results.length > 0 && (
                <div>
                    <p className="text-xs text-gray-400 mb-2">{total}件の候補</p>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto">
                        {results.map(item => (
                            <div
                                key={item.key}
                                className={`border rounded-xl p-3 transition-colors ${currentLinked === item.key
                                    ? 'border-orange-300 bg-orange-50'
                                    : 'border-gray-200 bg-white hover:border-gray-300'
                                    }`}
                            >
                                <div className="flex gap-3">
                                    {/* 画像 */}
                                    {item.imageUrl ? (
                                        <img
                                            src={item.imageUrl}
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
                                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600">
                                                {item.modelno}
                                            </span>
                                            {item.grade && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">
                                                    {item.grade}
                                                </span>
                                            )}
                                            {item.productFormat && item.productFormat !== 'NORMAL' && (
                                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${item.productFormat === 'PSA' ? 'bg-purple-100 text-purple-700' :
                                                    item.productFormat === 'BOX' ? 'bg-amber-100 text-amber-700' :
                                                        'bg-gray-100 text-gray-600'
                                                    }`}>
                                                    {item.productFormat}
                                                </span>
                                            )}
                                            {item.rarity && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600">
                                                    {item.rarity}
                                                </span>
                                            )}
                                        </div>

                                        {/* 価格 */}
                                        <div className="mt-2">
                                            <span className="text-sm font-bold text-orange-600">{formatPrice(item.price)}</span>
                                        </div>
                                    </div>

                                    {/* 紐付けボタン */}
                                    <div className="flex-shrink-0 flex flex-col items-center justify-center gap-1">
                                        {currentLinked === item.key ? (
                                            <span className="text-xs text-orange-600 font-medium px-3 py-2">🏪 紐付け済</span>
                                        ) : (
                                            <button
                                                onClick={() => link(item.key)}
                                                disabled={linking}
                                                className="px-3 py-2 bg-orange-600 text-white rounded-lg text-xs font-medium hover:bg-orange-700 disabled:opacity-50"
                                            >
                                                紐付ける
                                            </button>
                                        )}
                                    </div>
                                </div>

                                <p className="text-[10px] text-gray-300 mt-1">{item.key}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 検索中 */}
            {searching && (
                <div className="py-4 text-center">
                    <div className="inline-block w-5 h-5 border-2 border-gray-200 border-t-orange-600 rounded-full animate-spin" />
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
