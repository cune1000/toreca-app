'use client'

import Link from 'next/link'
import { ChartCard } from '@/lib/chart/types'
import { formatPrice, formatChange, formatUsd } from '@/lib/chart/format'

interface Props {
    card: ChartCard
    rank: number
    color: string
}

export default function RankingCard({ card, rank, color }: Props) {
    const change = card.price_change_30d
    const isUp = change > 0

    return (
        <Link
            href={`/chart/card/${card.id}`}
            className="flex-shrink-0 w-[160px] bg-white rounded-xl border border-gray-100 overflow-hidden
        hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group"
        >
            {/* ランク番号 */}
            <div className="relative">
                <div
                    className="absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-white text-xs font-bold z-10"
                    style={{ backgroundColor: rank <= 3 ? color : '#9ca3af' }}
                >
                    {rank}
                </div>

                {/* カード画像 */}
                <div className="w-full h-[120px] bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center overflow-hidden">
                    {card.image_url ? (
                        <img
                            src={card.image_url}
                            alt={card.name}
                            className="h-full object-contain group-hover:scale-105 transition-transform duration-200"
                            loading="lazy"
                        />
                    ) : (
                        <span className="text-3xl text-gray-300">🃏</span>
                    )}
                </div>
            </div>

            {/* 情報 */}
            <div className="p-2.5">
                <p className="text-xs font-medium text-gray-800 leading-tight line-clamp-2 min-h-[2rem]">
                    {card.name}
                </p>
                <div className="flex items-center gap-1 mt-1">
                    {card.rarity && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded font-medium">
                            {card.rarity}
                        </span>
                    )}
                </div>
                <p className="text-sm font-bold text-gray-900 mt-1.5">
                    {formatPrice(card.display_price)}
                </p>
                {card.display_price_usd > 0 && (
                    <p className="text-[10px] text-gray-400">
                        {formatUsd(card.display_price_usd)}
                    </p>
                )}
                {change !== 0 && (
                    <p className={`text-xs font-bold mt-0.5 ${isUp ? 'text-red-500' : 'text-blue-500'}`}>
                        {isUp ? '▲' : '▼'} {formatChange(Math.abs(change))}
                    </p>
                )}
            </div>
        </Link>
    )
}
