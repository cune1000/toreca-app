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

    // ランク別メダルスタイル (クリーン化)
    const rankStyle = rank === 1
        ? 'bg-gradient-to-br from-yellow-300 to-amber-400 text-amber-900 border border-yellow-200'
        : rank === 2
            ? 'bg-gradient-to-br from-slate-100 to-slate-300 text-slate-800 border border-slate-200'
            : rank === 3
                ? 'bg-gradient-to-br from-orange-400 to-amber-600 text-white border border-orange-300/50'
                : 'bg-white text-gray-500 border border-gray-200/80 font-bold'

    return (
        <Link
            href={`/chart/card/${card.id}`}
            className="flex-shrink-0 w-[140px] sm:w-[150px] md:w-[160px] bg-white rounded-xl border border-gray-200/50 overflow-hidden
                shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-1
                transition-all duration-300 group relative flex flex-col h-full"
        >
            {/* ランク番号 + 変動率バッジ */}
            <div
                className={`absolute top-2 left-2 w-7 h-7 rounded-lg flex items-center justify-center text-[13px] font-black z-20 shadow-[0_2px_8px_rgba(0,0,0,0.12)] ${rankStyle}`}
            >
                {rank}
            </div>

            {/* 変動率バッジ(右上) */}
            {change !== 0 && (
                <div className={`absolute top-2 right-2 z-20 px-1.5 py-0.5 rounded text-[10px] font-bold shadow-sm
                    ${isUp ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-rose-50 text-rose-600 border border-rose-200'}`}
                >
                    {isUp ? '+' : ''}{change.toFixed(1)}%
                </div>
            )}

            {/* カード画像エリア (クリーンなスタイル) */}
            <div className="relative w-full h-[140px] sm:h-[150px] bg-[#f8fafc] flex items-center justify-center overflow-hidden border-b border-gray-100">
                {card.image_url ? (
                    <img
                        src={card.image_url}
                        alt={card.name}
                        className="h-[125px] sm:h-[135px] object-contain relative z-10 group-hover:scale-105 transition-transform duration-300 drop-shadow-sm"
                        loading="lazy"
                    />
                ) : (
                    <span className="text-4xl text-gray-200 relative z-10">🃏</span>
                )}
            </div>

            {/* 情報エリア */}
            <div className="px-2.5 pb-2.5 pt-2 flex flex-col flex-1 justify-between gap-1 bg-white relative z-10">
                <div>
                    <div className="flex items-center gap-1 mb-1 flex-wrap">
                        {card.rarity && (
                            <span className="text-[9px] px-1 py-0.5 bg-gray-100 text-gray-500 rounded font-bold border border-gray-200/50">
                                {card.rarity}
                            </span>
                        )}
                    </div>
                    <p className="text-[12px] sm:text-[13px] font-bold text-gray-800 leading-tight line-clamp-2">
                        {card.name}
                    </p>
                </div>

                <div className="mt-auto pt-1.5 border-t border-gray-50">
                    <div className="flex items-baseline gap-1">
                        <p className="text-[15px] font-black text-gray-900 tabular-nums tracking-tight leading-none">
                            {formatPrice(card.display_price)}
                        </p>
                    </div>
                    {card.display_price_usd > 0 && (
                        <p className="text-[10px] font-semibold text-gray-400 tabular-nums mt-0.5">
                            {formatUsd(card.display_price_usd)}
                        </p>
                    )}
                </div>
            </div>
        </Link>
    )
}
