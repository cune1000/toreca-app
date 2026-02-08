'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import ChartLayoutComponent from '@/components/chart/ChartLayout'
import SearchBox from '@/components/chart/SearchBox'
import CategoryTabs from '@/components/chart/CategoryTabs'
import { searchCards } from '@/lib/chart/queries'
import { formatPrice } from '@/lib/chart/format'
import { ChartCard } from '@/lib/chart/types'
import PriceChangeIndicator from '@/components/chart/PriceChangeIndicator'

function SearchContent() {
    const searchParams = useSearchParams()
    const q = searchParams.get('q') || ''
    const [results, setResults] = useState<ChartCard[]>([])
    const [loading, setLoading] = useState(false)
    const [category, setCategory] = useState('all')

    useEffect(() => {
        if (!q) return
        setLoading(true)
        searchCards(q, { category: category !== 'all' ? category : undefined })
            .then(setResults)
            .finally(() => setLoading(false))
    }, [q, category])

    return (
        <ChartLayoutComponent>
            <div className="px-4 py-4">
                <SearchBox initialQuery={q} />

                <div className="mt-4">
                    <CategoryTabs selected={category} onChange={setCategory} />
                </div>

                {/* 検索結果 */}
                <div className="mt-4">
                    {loading ? (
                        <div className="py-12 text-center">
                            <div className="inline-block w-8 h-8 border-2 border-gray-200 border-t-red-400 rounded-full animate-spin" />
                            <p className="text-sm text-gray-400 mt-3">検索中...</p>
                        </div>
                    ) : q && results.length === 0 ? (
                        <div className="py-12 text-center text-gray-400">
                            <p className="text-lg">検索結果なし</p>
                            <p className="text-sm mt-1">「{q}」に一致するカードが見つかりませんでした</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {results.map(card => (
                                <Link
                                    key={card.id}
                                    href={`/chart/card/${card.id}`}
                                    className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 p-3
                    hover:shadow-md transition-all"
                                >
                                    <div className="w-12 h-16 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                                        {card.image_url ? (
                                            <img src={card.image_url} alt={card.name} className="h-full object-contain" loading="lazy" />
                                        ) : (
                                            <span className="text-xl text-gray-300">🃏</span>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-800 truncate">{card.name}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {card.rarity && (
                                                <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded font-medium">
                                                    {card.rarity}
                                                </span>
                                            )}
                                            <span className="text-[10px] text-gray-400">{card.category}</span>
                                        </div>
                                    </div>
                                    <div className="text-right shrink-0">
                                        <p className="text-sm font-bold text-gray-900">
                                            {card.avg_price > 0 ? formatPrice(card.avg_price) : '-'}
                                        </p>
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
