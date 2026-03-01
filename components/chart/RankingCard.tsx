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

    // ランク別メダルスタイル
    const rankStyle = rank === 1
        ? 'bg-gradient-to-br from-yellow-400 to-amber-500 shadow-amber-300/40 shadow-md'
        : rank === 2
            ? 'bg-gradient-to-br from-gray-300 to-gray-400 shadow-gray-300/30 shadow-sm'
            : rank === 3
                ? 'bg-gradient-to-br from-amber-600 to-amber-700 shadow-amber-500/30 shadow-sm'
                : 'bg-gray-400'

    return (
        <Link
            href={`/chart/card/${card.id}`}
            className="flex-shrink-0 w-[168px] bg-white rounded-2xl border border-gray-100 overflow-hidden
                hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group"
        >
            {/* ランク番号 + 変動率バッジ */}
            <div className="relative">
                <div
                    className={`absolute top-2 left-2 w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-black z-10 ${rankStyle}`}
                >
                    {rank}
                </div>

                {/* 変動率バッジ(右上) */}
                {change !== 0 && (
                    <div className={`absolute top-2 right-2 z-10 px-1.5 py-0.5 rounded-md text-[11px] font-bold backdrop-blur-sm
                        ${isUp ? 'bg-red-500/90 text-white' : 'bg-blue-500/90 text-white'}`}
                    >
                        {isUp ? '+' : ''}{change.toFixed(1)}%
                    </div>
                )}

                {/* カード画像 */}
                <div className="w-full h-[140px] bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center overflow-hidden">
                    {card.image_url ? (
                        <img
                            src={card.image_url}
                            alt={card.name}
                            className="h-full object-contain group-hover:scale-110 transition-transform duration-300"
                            loading="lazy"
                        />
                    ) : (
                        <span className="text-4xl text-gray-200">🃏</span>
                    )}
                </div>
            </div>

            {/* 情報 */}
            <div className="p-3">
                <p className="text-sm font-semibold text-gray-800 leading-tight line-clamp-2 min-h-[2.5rem]">
                    {card.name}
                </p>
                <div className="flex items-center gap-1 mt-1.5">
                    {card.rarity && (
                        <span className="text-[11px] px-2 py-0.5 bg-amber-50 text-amber-700 rounded-md font-semibold">
                            {card.rarity}
                        </span>
                    )}
                </div>
                <p className="text-base font-black text-gray-900 mt-2 tabular-nums">
                    {formatPrice(card.display_price)}
                </p>
                {card.display_price_usd > 0 && (
                    <p className="text-xs text-gray-400 tabular-nums">
                        {formatUsd(card.display_price_usd)}
                    </p>
                )}
            </div>
        </Link>
    )
}
