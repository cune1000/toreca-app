'use client'

import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ChartCard } from '@/lib/chart/types'
import { RankingDef } from '@/lib/chart/types'
import RankingCardComponent from './RankingCard'

interface Props {
    ranking: RankingDef
    cards: ChartCard[]
}

export default function RankingRow({ ranking, cards }: Props) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const [showLeft, setShowLeft] = useState(false)
    const [showRight, setShowRight] = useState(true)

    const scroll = (direction: 'left' | 'right') => {
        if (!scrollRef.current) return
        const amount = 340
        scrollRef.current.scrollBy({
            left: direction === 'left' ? -amount : amount,
            behavior: 'smooth',
        })
    }

    const handleScroll = () => {
        if (!scrollRef.current) return
        const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
        setShowLeft(scrollLeft > 10)
        setShowRight(scrollLeft < scrollWidth - clientWidth - 10)
    }

    if (ranking.comingSoon) {
        return (
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-4 px-4 sm:px-6">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-sm border border-gray-100 bg-white">
                        {ranking.icon}
                    </div>
                    <h3 className="text-lg font-black text-gray-800 tracking-tight">{ranking.label}</h3>
                    <span className="text-[10px] px-2 py-1 bg-gray-100 text-gray-500 rounded-full font-bold ml-2">
                        Coming Soon
                    </span>
                </div>
                <div className="px-4 sm:px-6">
                    <div className="bg-white/50 rounded-2xl p-12 text-center text-gray-400 text-sm border border-dashed border-gray-200 shadow-sm">
                        <div className="inline-block p-3 bg-gray-50 rounded-full mb-3">⏳</div>
                        <p className="font-medium">データ準備中...</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="mb-8 group/row relative">
            {/* ヘッダー */}
            <div className="flex items-center gap-3 mb-4 px-4 sm:px-6">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shadow-sm border border-gray-100"
                    style={{ background: `linear-gradient(135deg, white, ${ranking.color}15)` }}>
                    {ranking.icon}
                </div>
                <h3 className="text-lg font-black text-gray-800 tracking-tight">{ranking.label}</h3>
                <div
                    className="w-2.5 h-2.5 rounded-full animate-pulse ml-1"
                    style={{ backgroundColor: ranking.color, boxShadow: `0 0 10px ${ranking.color}80` }}
                />
                <span className="text-xs font-semibold text-gray-400 ml-auto bg-gray-100/80 px-2.5 py-1 rounded-full border border-gray-200/50">
                    {cards.length}枚
                </span>
            </div>

            {/* 横スクロールエリア */}
            <div className="relative">
                {/* 左グラデーションマスク */}
                {showLeft && <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#F8FAFC] to-transparent z-10 pointer-events-none" />}

                {/* 左矢印 */}
                {showLeft && (
                    <button
                        onClick={() => scroll('left')}
                        className="hidden sm:flex absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white/95 backdrop-blur shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100
                            rounded-full items-center justify-center
                            opacity-0 group-hover/row:opacity-100
                            transition-all duration-300 hover:bg-white hover:scale-110 active:scale-95"
                    >
                        <ChevronLeft size={20} className="text-gray-700" />
                    </button>
                )}

                {/* 右グラデーションマスク */}
                {showRight && cards.length > 0 && <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#F8FAFC] to-transparent z-10 pointer-events-none" />}

                {/* 右矢印 */}
                {showRight && cards.length > 0 && (
                    <button
                        onClick={() => scroll('right')}
                        className="hidden sm:flex absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 bg-white/95 backdrop-blur shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-gray-100
                            rounded-full items-center justify-center
                            opacity-0 group-hover/row:opacity-100
                            transition-all duration-300 hover:bg-white hover:scale-110 active:scale-95"
                    >
                        <ChevronRight size={20} className="text-gray-700" />
                    </button>
                )}

                {/* カードリスト */}
                <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    className="flex gap-2.5 sm:gap-4 overflow-x-auto px-4 sm:px-6 pb-6 pt-2 snap-x snap-mandatory"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch' }}
                >
                    {cards.length > 0 ? (
                        cards.map((card, i) => (
                            <div key={card.id} className="snap-start flex self-stretch shrink-0">
                                <RankingCardComponent
                                    card={card}
                                    rank={i + 1}
                                    color={ranking.color}
                                />
                            </div>
                        ))
                    ) : (
                        <div className="w-full py-12 text-center text-gray-400 text-sm bg-white/50 rounded-2xl border border-dashed border-gray-200 mx-4 sm:mx-6">
                            データがありません
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
