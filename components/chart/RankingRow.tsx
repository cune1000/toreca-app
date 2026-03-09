'use client'

import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Clock, Image as ImageIcon } from 'lucide-react'
import { ChartCard } from '@/lib/chart/types'
import { RankingDef } from '@/lib/chart/types'
import RankingCardComponent from './RankingCard'
import { useChartTheme } from './ChartThemeContext'

interface Props {
    ranking: RankingDef
    cards: ChartCard[]
}

export default function RankingRow({ ranking, cards }: Props) {
    const scrollRef = useRef<HTMLDivElement>(null)
    const [showLeft, setShowLeft] = useState(false)
    const [showRight, setShowRight] = useState(true)
    const { theme, layout } = useChartTheme()

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

    const getFadeClass = (direction: 'left' | 'right') => {
        const toTransparent = direction === 'left' ? 'to-transparent' : 'to-transparent'
        switch (theme) {
            case 'native': return `from-[#F5F6F8] ${toTransparent}`
            case 'dark': return `from-slate-950 ${toTransparent}`
            case 'neumorphism': return `from-[#e0e5ec] ${toTransparent}`
            case 'bento': return `from-white ${toTransparent}`
            case 'glass': return `from-white/50 backdrop-blur-[2px] ${toTransparent}`
            case 'neopop': return `from-white ${toTransparent}`
            case 'elegant': return `from-[#FAF8F5] ${toTransparent}`
            default: return `from-[#F8FAFC] ${toTransparent}`
        }
    }

    const getIconWrapperClass = () => {
        switch (theme) {
            case 'native': return 'bg-white border border-gray-200 shadow-sm'
            case 'dark': return 'border border-slate-700/50 shadow-none'
            case 'neumorphism': return 'border-transparent shadow-[3px_3px_6px_#c8d0e7,-3px_-3px_6px_#ffffff]'
            case 'bento': return 'border-2 border-black rounded-none shadow-[2px_2px_0_#000] bg-white'
            case 'glass': return 'bg-white/40 border border-white/60 shadow-sm backdrop-blur-sm text-sky-800'
            case 'neopop': return 'bg-yellow-300 border-[3px] border-black rounded-none shadow-[2px_2px_0_#000]'
            case 'elegant': return 'bg-white border border-[#D4C3A3] text-[#5C5446] shadow-sm'
            default: return 'shadow-sm border border-gray-100 bg-white'
        }
    }

    const getTitleClass = () => {
        switch (theme) {
            case 'native': return 'text-[#111827] font-bold'
            case 'dark': return 'text-slate-100'
            case 'neumorphism': return 'text-slate-700'
            case 'bento': return 'text-black tracking-tighter'
            case 'glass': return 'text-sky-950 font-medium tracking-wide'
            case 'neopop': return 'text-black font-black tracking-tighter'
            case 'elegant': return 'text-[#5C5446] font-serif tracking-widest'
            default: return 'text-gray-800 tracking-tight'
        }
    }

    const getButtonClass = () => {
        switch (theme) {
            case 'native': return 'bg-white border border-gray-200 text-gray-700 shadow-sm hover:bg-gray-50'
            case 'dark': return 'bg-slate-800/90 border-slate-700 text-slate-200 hover:bg-slate-700'
            case 'neumorphism': return 'bg-[#e0e5ec] border-transparent text-slate-600 shadow-[3px_3px_6px_#c8d0e7,-3px_-3px_6px_#ffffff] hover:shadow-[inset_2px_2px_5px_#c8d0e7,inset_-2px_-2px_5px_#ffffff]'
            case 'bento': return 'bg-white border-2 border-black rounded-none text-black shadow-[2px_2px_0_#000] hover:bg-gray-100 hover:translate-y-0.5 hover:shadow-none'
            case 'glass': return 'bg-white/50 border-white/60 text-sky-900 shadow-sm hover:bg-white/80'
            case 'neopop': return 'bg-white border-[3px] border-black rounded-none text-black shadow-[4px_4px_0_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none'
            case 'elegant': return 'bg-[#FAF8F5] border border-[#D4C3A3] text-[#5C5446] hover:bg-white shadow-sm'
            default: return 'bg-white/95 backdrop-blur shadow-[0_8px_30px_rgb(0,0,0,0.12)] border-gray-100 text-gray-700 hover:bg-white hover:scale-110 active:scale-95'
        }
    }

    if (ranking.comingSoon) {
        return (
            <div className="mb-8">
                <div className="flex items-center gap-3 mb-4 px-4 sm:px-6">
                    <div className={`w-10 h-10 flex items-center justify-center text-xl transition-all duration-300 ${theme === 'bento' || theme === 'neopop' ? '' : 'rounded-xl'} ${getIconWrapperClass()}`}>
                        {ranking.icon}
                    </div>
                    <h3 className={`text-lg font-black ${getTitleClass()}`}>{ranking.label}</h3>
                    <span className={`text-[10px] px-2 py-1 rounded-full font-bold ml-2 ${theme === 'dark' ? 'bg-slate-800 text-slate-400' : theme === 'bento' ? 'bg-black text-white rounded-none border border-black' : theme === 'neopop' ? 'bg-yellow-300 text-black border-2 border-black rounded-none shadow-[2px_2px_0_#000]' : theme === 'glass' ? 'bg-white/50 text-sky-800 border bg-clip-padding backdrop-filter backdrop-blur-sm bg-opacity-40 border-gray-200' : theme === 'elegant' ? 'bg-[#E8E1D5]/50 text-[#9C8F7A] border border-[#D4C3A3]' : 'bg-gray-100 text-gray-500'}`}>
                        Coming Soon
                    </span>
                </div>
                <div className="px-4 sm:px-6">
                    <div className={`rounded-2xl p-12 text-center text-sm border-dashed transition-colors duration-300
                        ${theme === 'native' ? 'bg-white text-gray-500 border-gray-300' :
                            theme === 'dark' ? 'bg-slate-900/50 text-slate-500 border-slate-800' :
                                theme === 'bento' ? 'bg-white text-gray-500 border-black border-[2px] rounded-none' :
                                    theme === 'neumorphism' ? 'bg-[#e0e5ec] text-slate-500 border-slate-300/50 shadow-[inset_3px_3px_6px_#c8d0e7,inset_-3px_-3px_6px_#ffffff]' :
                                        theme === 'glass' ? 'bg-white/30 text-sky-900/60 border-white/60 shadow-sm backdrop-blur-sm' :
                                            theme === 'neopop' ? 'bg-gray-100 text-gray-500 border-[3px] border-black rounded-none' :
                                                theme === 'elegant' ? 'bg-white/50 text-[#A8A195] border-[#D4C3A3]/50' :
                                                    'bg-white/50 text-gray-400 border-gray-200 shadow-sm'}`}>
                        <div className={`inline-block p-3 rounded-full mb-3 ${theme === 'dark' ? 'bg-slate-800 text-slate-400' : theme === 'native' ? 'bg-gray-100 text-gray-500' : theme === 'bento' || theme === 'neopop' ? 'bg-black text-white rounded-none' : theme === 'glass' ? 'bg-white/50 shadow-sm text-sky-800' : theme === 'elegant' ? 'bg-[#FAF8F5] border border-[#D4C3A3] text-[#9C8F7A]' : 'bg-gray-50 text-gray-400'}`}>
                            <Clock size={24} />
                        </div>
                        <p className={`font-medium ${theme === 'elegant' ? 'font-serif' : ''}`}>データ準備中...</p>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="mb-8 group/row relative">
            {/* ヘッダー */}
            {theme === 'native' ? (
                <div className="flex items-center justify-between bg-[#F5F6F8] border-y border-gray-200 px-4 py-3 mb-4">
                    <div className="flex items-center gap-2">
                        <div className="text-xl drop-shadow-sm">{ranking.icon}</div>
                        <h3 className="text-sm font-bold text-gray-900">{ranking.label}</h3>
                    </div>
                    <span className="text-xs text-gray-500 font-medium bg-white px-2 py-0.5 rounded border border-gray-200 shadow-sm">{cards.length}枚</span>
                </div>
            ) : (
                <div className="flex items-center gap-3 mb-4 px-4 sm:px-6">
                    <div className={`w-10 h-10 flex items-center justify-center text-xl transition-all duration-300 ${theme === 'bento' || theme === 'neopop' ? '' : 'rounded-xl'} ${getIconWrapperClass()}`}
                        style={theme === 'default' || theme === 'dark' || theme === 'glass' ? { background: `linear-gradient(135deg, ${theme === 'dark' ? 'rgba(30,41,59,0.5)' : theme === 'glass' ? 'rgba(255,255,255,0.4)' : 'white'}, ${ranking.color}${theme === 'glass' ? '30' : '15'})` } : {}}>
                        <span className={theme === 'bento' || theme === 'neopop' ? 'drop-shadow-none' : 'drop-shadow-sm'}>{ranking.icon}</span>
                    </div>
                    <h3 className={`text-lg font-black ${getTitleClass()}`}>{ranking.label}</h3>
                    <div
                        className="w-2.5 h-2.5 rounded-full animate-pulse ml-1"
                        style={{ backgroundColor: ranking.color, boxShadow: `0 0 10px ${ranking.color}80` }}
                    />
                    <span className={`text-xs mx-auto px-2.5 py-1 font-semibold ml-auto transition-colors duration-300
                        ${theme === 'dark' ? 'text-slate-400 bg-slate-800/80 border border-slate-700 rounded-full' :
                            theme === 'bento' ? 'text-white bg-black border border-black uppercase tracking-widest' :
                                theme === 'neumorphism' ? 'text-slate-500 bg-[#e0e5ec] shadow-[inset_2px_2px_4px_#c8d0e7,inset_-2px_-2px_4px_#ffffff] rounded-full' :
                                    theme === 'glass' ? 'text-sky-800 bg-white/50 border border-white/60 shadow-sm backdrop-blur-sm rounded-full' :
                                        theme === 'neopop' ? 'text-black bg-cyan-300 border-2 border-black rounded-none shadow-[2px_2px_0_#000] font-black' :
                                            theme === 'elegant' ? 'text-[#9C8F7A] bg-[#E8E1D5]/40 border border-[#D4C3A3]/50 rounded-full font-serif' :
                                                'text-gray-400 bg-gray-100/80 border border-gray-200/50 rounded-full'}`}>
                        {cards.length}枚
                    </span>
                </div>
            )}

            {/* コンテンツエリア */}
            {layout === 'grid' ? (
                <div className="grid grid-cols-2 min-[400px]:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 px-4 sm:px-6 pb-6 pt-2">
                    {cards.length > 0 ? (
                        cards.map((card, i) => (
                            <RankingCardComponent
                                key={card.id}
                                card={card}
                                rank={i + 1}
                                color={ranking.color}
                                layout={layout}
                            />
                        ))
                    ) : (
                        <div className={`col-span-full w-full py-12 text-center text-sm rounded-2xl border border-dashed transition-colors duration-300
                            ${theme === 'native' ? 'bg-white text-gray-500 border-gray-300' :
                                theme === 'dark' ? 'bg-slate-900/50 text-slate-500 border-slate-800' :
                                    theme === 'bento' ? 'bg-white text-gray-500 border-black border-[2px] rounded-none' :
                                        theme === 'neumorphism' ? 'bg-[#e0e5ec] text-slate-500 border-slate-300/50 shadow-[inset_3px_3px_6px_#c8d0e7,inset_-3px_-3px_6px_#ffffff]' :
                                            theme === 'glass' ? 'bg-white/30 text-sky-900/60 border-white/60 shadow-sm backdrop-blur-sm' :
                                                theme === 'neopop' ? 'bg-gray-100 text-gray-500 border-[3px] border-black rounded-none' :
                                                    theme === 'elegant' ? 'bg-white/50 text-[#A8A195] border-[#D4C3A3]/50' :
                                                        'bg-white/50 text-gray-400 border-gray-200'}`}>
                            データがありません
                        </div>
                    )}
                </div>
            ) : layout === 'compact' ? (
                <div className="flex flex-col gap-2 px-4 sm:px-6 pb-6 pt-2">
                    {cards.length > 0 ? (
                        cards.map((card, i) => (
                            <RankingCardComponent
                                key={card.id}
                                card={card}
                                rank={i + 1}
                                color={ranking.color}
                                layout={layout}
                            />
                        ))
                    ) : (
                        <div className={`w-full py-12 text-center text-sm rounded-2xl border border-dashed transition-colors duration-300
                            ${theme === 'native' ? 'bg-white text-gray-500 border-gray-300' :
                                theme === 'dark' ? 'bg-slate-900/50 text-slate-500 border-slate-800' :
                                    theme === 'bento' ? 'bg-white text-gray-500 border-black border-[2px] rounded-none' :
                                        theme === 'neumorphism' ? 'bg-[#e0e5ec] text-slate-500 border-slate-300/50 shadow-[inset_3px_3px_6px_#c8d0e7,inset_-3px_-3px_6px_#ffffff]' :
                                            theme === 'glass' ? 'bg-white/30 text-sky-900/60 border-white/60 shadow-sm backdrop-blur-sm' :
                                                theme === 'neopop' ? 'bg-gray-100 text-gray-500 border-[3px] border-black rounded-none' :
                                                    theme === 'elegant' ? 'bg-white/50 text-[#A8A195] border-[#D4C3A3]/50' :
                                                        'bg-white/50 text-gray-400 border-gray-200'}`}>
                            データがありません
                        </div>
                    )}
                </div>
            ) : (
                <div className="relative">
                    {/* 左グラデーションマスク */}
                    {showLeft && <div className={`absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r z-10 pointer-events-none transition-colors duration-300 ${getFadeClass('left')}`} />}

                    {/* 左矢印 */}
                    {showLeft && (
                        <button
                            onClick={() => scroll('left')}
                            className={`hidden sm:flex absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 border transition-all duration-300 items-center justify-center opacity-0 group-hover/row:opacity-100 ${theme === 'bento' ? '' : 'rounded-full'} ${getButtonClass()}`}
                        >
                            <ChevronLeft size={20} />
                        </button>
                    )}

                    {/* 右グラデーションマスク */}
                    {showRight && cards.length > 0 && <div className={`absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l z-10 pointer-events-none transition-colors duration-300 ${getFadeClass('left')}`} />}

                    {/* 右矢印 */}
                    {showRight && cards.length > 0 && (
                        <button
                            onClick={() => scroll('right')}
                            className={`hidden sm:flex absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20 w-10 h-10 border transition-all duration-300 items-center justify-center opacity-0 group-hover/row:opacity-100 ${theme === 'bento' ? '' : 'rounded-full'} ${getButtonClass()}`}
                        >
                            <ChevronRight size={20} />
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
                                        layout={layout}
                                    />
                                </div>
                            ))
                        ) : (
                            <div className={`w-full py-12 text-center text-sm rounded-2xl border border-dashed mx-4 sm:mx-6 transition-colors duration-300
                                ${theme === 'native' ? 'bg-white text-gray-500 border-gray-300' :
                                    theme === 'dark' ? 'bg-slate-900/50 text-slate-500 border-slate-800' :
                                        theme === 'bento' ? 'bg-white text-gray-500 border-black border-[2px] rounded-none' :
                                            theme === 'neumorphism' ? 'bg-[#e0e5ec] text-slate-500 border-slate-300/50 shadow-[inset_3px_3px_6px_#c8d0e7,inset_-3px_-3px_6px_#ffffff]' :
                                                theme === 'glass' ? 'bg-white/30 text-sky-900/60 border-white/60 shadow-sm backdrop-blur-sm' :
                                                    theme === 'neopop' ? 'bg-gray-100 text-gray-500 border-[3px] border-black rounded-none' :
                                                        theme === 'elegant' ? 'bg-white/50 text-[#A8A195] border-[#D4C3A3]/50' :
                                                            'bg-white/50 text-gray-400 border-gray-200'}`}>
                                データがありません
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
