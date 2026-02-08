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
            <div className="mb-6">
                <div className="flex items-center gap-2 mb-3 px-4">
                    <span className="text-lg">{ranking.icon}</span>
                    <h3 className="text-sm font-bold text-gray-800">{ranking.label}</h3>
                    <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-400 rounded-full font-medium">
                        Coming Soon
                    </span>
                </div>
                <div className="px-4">
                    <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-400 text-sm border border-dashed border-gray-200">
                        データ準備中...
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="mb-6 group/row">
            {/* ヘッダー */}
            <div className="flex items-center gap-2 mb-3 px-4">
                <span className="text-lg">{ranking.icon}</span>
                <h3 className="text-sm font-bold text-gray-800">{ranking.label}</h3>
                <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: ranking.color }}
                />
            </div>

            {/* 横スクロールエリア */}
            <div className="relative">
                {/* 左矢印 */}
                {showLeft && (
                    <button
                        onClick={() => scroll('left')}
                        className="absolute left-1 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/90 shadow-md
              rounded-full flex items-center justify-center opacity-0 group-hover/row:opacity-100
              transition-opacity hover:bg-white"
                    >
                        <ChevronLeft size={18} className="text-gray-600" />
                    </button>
                )}

                {/* 右矢印 */}
                {showRight && cards.length > 0 && (
                    <button
                        onClick={() => scroll('right')}
                        className="absolute right-1 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-white/90 shadow-md
              rounded-full flex items-center justify-center opacity-0 group-hover/row:opacity-100
              transition-opacity hover:bg-white"
                    >
                        <ChevronRight size={18} className="text-gray-600" />
                    </button>
                )}

                {/* カードリスト */}
                <div
                    ref={scrollRef}
                    onScroll={handleScroll}
                    className="flex gap-3 overflow-x-auto px-4 pb-2"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    {cards.length > 0 ? (
                        cards.map((card, i) => (
                            <RankingCardComponent
                                key={card.id}
                                card={card}
                                rank={i + 1}
                                color={ranking.color}
                            />
                        ))
                    ) : (
                        <div className="w-full py-8 text-center text-gray-400 text-sm">
                            データがありません
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
