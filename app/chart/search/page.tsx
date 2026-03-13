'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import ChartLayoutComponent from '@/components/chart/ChartLayout'
import SearchBox from '@/components/chart/SearchBox'
import { searchCards, getSearchFilters } from '@/lib/chart/queries'
import { formatPrice, formatUsd } from '@/lib/chart/format'
import { ChartCard } from '@/lib/chart/types'
import PriceChangeIndicator from '@/components/chart/PriceChangeIndicator'

function SearchContent() {
    const searchParams = useSearchParams()
    const q = searchParams.get('q') || ''
    const [results, setResults] = useState<ChartCard[]>([])
    const [loading, setLoading] = useState(false)
    const [rarity, setRarity] = useState('')
    const [expansion, setExpansion] = useState('')
    const [rarities, setRarities] = useState<string[]>([])
    const [expansions, setExpansions] = useState<string[]>([])

    // フィルター選択肢を取得
    useEffect(() => {
        getSearchFilters().then(data => {
            setRarities(data.rarities)
            setExpansions(data.expansions)
        })
    }, [])

    // 検索実行
    useEffect(() => {
        if (!q && !rarity && !expansion) {
            setResults([])
            return
        }
        setLoading(true)
        searchCards(q, {
            rarity: rarity || undefined,
            expansion: expansion || undefined,
        })
            .then(setResults)
            .finally(() => setLoading(false))
    }, [q, rarity, expansion])

    const selectClass = "w-full px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400/30 focus:border-red-400 shadow-sm appearance-none cursor-pointer"

    return (
        <ChartLayoutComponent>
            <div className="px-4 py-4">
                <SearchBox initialQuery={q} />

                {/* フィルター */}
                <div className="flex gap-2 mt-3">
                    <div className="flex-1">
                        <select
                            value={rarity}
                            onChange={(e) => setRarity(e.target.value)}
                            className={selectClass}
                        >
                            <option value="">レアリティ</option>
                            {rarities.map(r => (
                                <option key={r} value={r}>{r}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex-1">
                        <select
                            value={expansion}
                            onChange={(e) => setExpansion(e.target.value)}
                            className={selectClass}
                        >
                            <option value="">収録弾</option>
                            {expansions.map(e => (
                                <option key={e} value={e}>{e}</option>
                            ))}
                        </select>
                    </div>
                    {(rarity || expansion) && (
                        <button
                            onClick={() => { setRarity(''); setExpansion('') }}
                            className="px-3 py-2.5 text-xs text-gray-500 bg-gray-100 border border-gray-200 rounded-xl hover:bg-gray-200 transition-colors shrink-0"
                        >
                            クリア
                        </button>
                    )}
                </div>

                {/* 検索結果 */}
                <div className="mt-4">
                    {loading ? (
                        <div className="py-12 text-center">
                            <div className="inline-block w-8 h-8 border-2 border-gray-200 border-t-red-400 rounded-full animate-spin" />
                            <p className="text-sm text-gray-400 mt-3">検索中...</p>
                        </div>
                    ) : (q || rarity || expansion) && results.length === 0 ? (
                        <div className="py-12 text-center text-gray-400">
                            <p className="text-lg">検索結果なし</p>
                            <p className="text-sm mt-1">条件に一致するカードが見つかりませんでした</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {results.length > 0 && (
                                <p className="text-xs text-gray-400 mb-2">{results.length}件</p>
                            )}
                            {results.map(card => (
                                <Link
                                    key={card.id}
                                    href={`/chart/card/${card.id}`}
                                    className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-3.5
                                        hover:shadow-md transition-all min-h-[64px] active:scale-[0.99]"
                                >
                                    <div className="w-12 h-16 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                                        {card.image_url ? (
                                            <img src={card.image_url} alt={card.name} className="h-full object-contain" loading="lazy" />
                                        ) : (
                                            <span className="text-xl text-gray-200">🃏</span>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-semibold text-gray-800 truncate">{card.name}</p>
                                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                                            {card.rarity && (
                                                <span className="text-xs px-2 py-0.5 bg-amber-50 text-amber-600 rounded-md font-medium">
                                                    {card.rarity}
                                                </span>
                                            )}
                                            {card.expansion && (
                                                <span className="text-xs text-gray-500 truncate max-w-[140px]">{card.expansion}</span>
                                            )}
                                            {card.set_code && (
                                                <span className="text-xs px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded font-mono">{card.set_code}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-sm font-black text-gray-900 tabular-nums">
                                            {card.display_price > 0 ? formatPrice(card.display_price) : '-'}
                                        </p>
                                        {card.display_price_usd > 0 && (
                                            <p className="text-xs text-gray-400 tabular-nums">
                                                {formatUsd(card.display_price_usd)}
                                            </p>
                                        )}
                                        {card.price_change_24h !== 0 && (
                                            <PriceChangeIndicator value={card.price_change_24h} />
                                        )}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </ChartLayoutComponent>
    )
}

export default function SearchPage() {
    return (
        <Suspense fallback={
            <div className="py-20 text-center">
                <div className="inline-block w-8 h-8 border-2 border-gray-200 border-t-red-400 rounded-full animate-spin" />
            </div>
        }>
            <SearchContent />
        </Suspense>
    )
}
