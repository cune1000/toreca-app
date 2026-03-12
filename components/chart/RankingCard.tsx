'use client'

import Link from 'next/link'
import { ChartCard } from '@/lib/chart/types'
import { formatPrice, formatUsd } from '@/lib/chart/format'
import { Image as ImageIcon } from 'lucide-react'
import { useChartTheme } from './ChartThemeContext'

interface Props {
    card: ChartCard
    rank: number
    color: string
    layout?: 'carousel' | 'grid' | 'compact'
}

export default function RankingCard({ card, rank, color, layout = 'carousel' }: Props) {
    const { theme } = useChartTheme()
    const change = card.price_change_30d
    const isUp = change > 0

    // ランク別メダルスタイル
    const getRankStyle = () => {
        if (theme === 'native') {
            return rank === 1 ? 'bg-[#111827] text-white border border-[#111827]' :
                rank === 2 ? 'bg-gray-500 text-white border border-gray-500' :
                    rank === 3 ? 'bg-gray-400 text-white border border-gray-400' :
                        'bg-white text-gray-500 border border-gray-200 shadow-sm'
        }
        if (theme === 'dark') {
            return rank === 1 ? 'bg-gradient-to-br from-yellow-300 to-amber-500 text-amber-950 shadow-[0_0_15px_rgba(251,191,36,0.6)]' :
                rank === 2 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-slate-900 shadow-[0_0_15px_rgba(148,163,184,0.4)]' :
                    rank === 3 ? 'bg-gradient-to-br from-orange-400 to-red-500 text-white shadow-[0_0_15px_rgba(249,115,22,0.5)]' :
                        'bg-slate-800 text-slate-300 border border-slate-700 shadow-none'
        }
        if (theme === 'bento') {
            return rank === 1 ? 'bg-yellow-400 text-black border-[3px] border-black' :
                rank === 2 ? 'bg-slate-300 text-black border-[3px] border-black' :
                    rank === 3 ? 'bg-orange-500 text-white border-[3px] border-black' :
                        'bg-white text-black border-[3px] border-black'
        }
        if (theme === 'neumorphism') {
            const baseNeu = 'shadow-[inset_3px_3px_6px_#c8d0e7,inset_-3px_-3px_6px_#ffffff]'
            return rank === 1 ? `text-amber-600 ${baseNeu}` :
                rank === 2 ? `text-slate-500 ${baseNeu}` :
                    rank === 3 ? `text-orange-600 ${baseNeu}` :
                        `text-slate-500 ${baseNeu}`
        }
        if (theme === 'glass') {
            return rank === 1 ? 'bg-white/80 text-amber-500 border border-white/60 shadow-[0_4px_12px_rgba(251,191,36,0.2)] backdrop-blur-md' :
                rank === 2 ? 'bg-white/70 text-slate-500 border border-white/60 shadow-[0_4px_12px_rgba(148,163,184,0.2)] backdrop-blur-md' :
                    rank === 3 ? 'bg-white/60 text-orange-500 border border-white/60 shadow-[0_4px_12px_rgba(249,115,22,0.2)] backdrop-blur-md' :
                        'bg-white/40 text-sky-800 border border-white/60 shadow-sm backdrop-blur-md'
        }
        if (theme === 'neopop') {
            return rank === 1 ? 'bg-yellow-300 text-black border-[3px] border-black shadow-[2px_2px_0_#000]' :
                rank === 2 ? 'bg-slate-200 text-black border-[3px] border-black shadow-[2px_2px_0_#000]' :
                    rank === 3 ? 'bg-orange-400 text-white border-[3px] border-black shadow-[2px_2px_0_#000]' :
                        'bg-black text-white border-[3px] border-black shadow-[2px_2px_0_#000]'
        }
        if (theme === 'elegant') {
            return rank === 1 ? 'bg-[#FAF8F5] text-[#D4C3A3] border border-[#D4C3A3] shadow-sm font-serif' :
                rank === 2 ? 'bg-[#FAF8F5] text-[#A8A195] border border-[#E8E1D5] shadow-sm font-serif' :
                    rank === 3 ? 'bg-[#FAF8F5] text-[#C4A484] border border-[#E8E1D5] shadow-sm font-serif' :
                        'bg-[#FAF8F5] text-[#9C8F7A] border border-[#E8E1D5] shadow-sm font-serif'
        }

        // Default
        return rank === 1 ? 'bg-gradient-to-br from-yellow-300 to-amber-400 text-amber-900 border border-yellow-200' :
            rank === 2 ? 'bg-gradient-to-br from-slate-100 to-slate-300 text-slate-800 border border-slate-200' :
                rank === 3 ? 'bg-gradient-to-br from-orange-400 to-amber-600 text-white border border-orange-300/50' :
                    'bg-white text-gray-500 border border-gray-200/80 font-bold'
    }

    const getCardClass = () => {
        switch (theme) {
            case 'native': return 'bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-colors shadow-none'
            case 'dark': return 'bg-slate-900 rounded-2xl border border-white/10 hover:shadow-[0_0_30px_rgba(168,85,247,0.3)]'
            case 'neumorphism': return 'rounded-[1.5rem] border-transparent shadow-[9px_9px_16px_rgba(163,177,198,0.6),-9px_-9px_16px_rgba(255,255,255,0.5)]'
            case 'bento': return 'bg-white rounded-none border-[3px] border-black hover:shadow-none'
            case 'glass': return 'bg-white/20 backdrop-blur-md rounded-2xl border border-white/40 shadow-[0_8px_32px_rgba(0,0,0,0.05)] hover:-translate-y-2 hover:shadow-[0_16px_48px_rgba(0,0,0,0.1)]'
            case 'neopop': return 'bg-white rounded-none border-[3px] border-black shadow-[4px_4px_0_#000] hover:-translate-y-1 hover:translate-x-1 hover:shadow-none transition-all'
            case 'elegant': return 'bg-white rounded-xl border border-[#D4C3A3]/50 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all'
            default: return 'bg-white rounded-xl border border-gray-200/50 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]'
        }
    }

    const getImageWrapperClass = () => {
        switch (theme) {
            case 'native': return 'bg-gray-50/50 rounded-t-lg border-b border-gray-100'
            case 'dark': return 'bg-slate-800/50 rounded-t-xl overflow-hidden backdrop-blur-sm border-b border-white/5'
            case 'neumorphism': return 'rounded-2xl shadow-[inset_5px_5px_10px_#c8d0e7,inset_-5px_-5px_10px_#ffffff]'
            case 'bento': return 'bg-gray-100 border-b-[3px] border-black'
            case 'glass': return 'bg-white/30 rounded-t-2xl border-b border-white/20'
            case 'neopop': return 'bg-cyan-100 border-b-[3px] border-black rounded-none'
            case 'elegant': return 'bg-[#FAF8F5] rounded-t-xl border-b border-[#E8E1D5]'
            default: return 'bg-[#f8fafc] border-b border-gray-100'
        }
    }

    const getBadgeClass = () => {
        switch (theme) {
            case 'native': return isUp ? 'text-red-600 bg-red-50 font-medium px-1.5' : 'text-blue-600 bg-blue-50 font-medium px-1.5'
            case 'dark': return isUp ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
            case 'neumorphism': return isUp ? 'text-emerald-600 shadow-[inset_2px_2px_5px_#c8d0e7,inset_-2px_-2px_5px_#ffffff]' : 'text-rose-600 shadow-[inset_2px_2px_5px_#c8d0e7,inset_-2px_-2px_5px_#ffffff]'
            case 'bento': return 'bg-black text-white rounded-none border-[2px] border-black shadow-[2px_2px_0_#000]'
            case 'glass': return isUp ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 backdrop-blur-sm' : 'bg-rose-500/10 text-rose-700 border border-rose-500/20 backdrop-blur-sm'
            case 'neopop': return 'bg-white text-black border-[2px] border-black rounded-none font-black shadow-[2px_2px_0_#000]'
            case 'elegant': return isUp ? 'bg-[#FAF8F5] text-emerald-700 border border-[#D4C3A3] font-serif shadow-sm' : 'bg-[#FAF8F5] text-rose-700 border border-[#D4C3A3] font-serif shadow-sm'
            default: return isUp ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-sm' : 'bg-rose-50 text-rose-600 border border-rose-200 shadow-sm'
        }
    }

    const getTextClass = () => {
        switch (theme) {
            case 'native': return 'text-[#111827] font-medium'
            case 'dark': return 'text-white'
            case 'neumorphism': return 'text-slate-700'
            case 'bento': return 'text-black tracking-tight'
            case 'glass': return 'text-sky-950 font-medium tracking-wide'
            case 'neopop': return 'text-black font-black tracking-tight'
            case 'elegant': return 'text-[#5C5446] font-serif leading-snug'
            default: return 'text-gray-800'
        }
    }

    const getPriceClass = () => {
        switch (theme) {
            case 'native': return 'text-[#111827] font-bold'
            case 'dark': return 'text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-orange-400'
            case 'neumorphism': return 'text-slate-800'
            case 'bento': return 'text-black tracking-tighter'
            case 'glass': return 'text-sky-900 tracking-tight font-bold'
            case 'neopop': return 'text-black font-black tracking-tighter text-lg'
            case 'elegant': return 'text-[#5C5446] font-serif tracking-widest'
            default: return 'text-gray-900'
        }
    }

    if (theme === 'native') {
        if (layout === 'compact') {
            return (
                <Link href={`/chart/card/${card.id}`} className="bg-white border-b border-gray-200 px-3 sm:px-4 py-3 flex items-center gap-3 w-full hover:bg-gray-50 transition-colors">
                    <div className="w-6 text-center shrink-0 font-bold text-base sm:text-lg text-gray-700">
                        {rank}
                    </div>
                    <div className="relative w-16 h-20 sm:w-20 sm:h-24 shrink-0 flex items-center justify-center">
                        {card.image_url ? (
                            <img src={card.image_url} alt={card.name} className="h-full object-contain drop-shadow-sm" loading="lazy" />
                        ) : (
                            <ImageIcon className="w-8 h-8 text-gray-300 stroke-1" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <p className="text-xs sm:text-[13px] font-bold text-gray-900 text-left line-clamp-1 mb-1.5">{card.name}</p>
                        <div className="flex flex-col sm:flex-row gap-1 sm:gap-4">
                            <div className="flex justify-between sm:justify-start gap-2 items-center sm:items-baseline">
                                <span className="text-[10px] text-gray-500">直近価格</span>
                                <span className="text-[13px] sm:text-[14px] font-bold text-gray-900 leading-none">{formatPrice(card.display_price)}</span>
                            </div>
                            <div className="flex justify-between sm:justify-start gap-2 items-center sm:items-baseline">
                                <span className="text-[10px] text-gray-500">騰落率(30日)</span>
                                <span className={`text-[12px] font-bold leading-none ${change === 0 ? 'text-gray-500' : isUp ? 'text-red-600' : 'text-blue-600'}`}>
                                    {change === 0 ? '±0%' : isUp ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`}
                                </span>
                            </div>
                        </div>
                    </div>
                </Link>
            )
        }

        const widthClass = layout === 'grid' ? 'w-full' : 'flex-shrink-0 w-[140px] sm:w-[150px]'
        return (
            <Link href={`/chart/card/${card.id}`} className={`${widthClass} bg-white border border-gray-200 flex flex-col hover:border-gray-300 transition-colors group`}>
                <div className="relative p-2 bg-white flex justify-center items-center h-[190px]">
                    {card.image_url ? (
                        <img src={card.image_url} alt={card.name} className="h-[170px] object-contain drop-shadow-sm group-hover:scale-105 transition-transform" />
                    ) : (
                        <ImageIcon className="w-12 h-12 text-gray-200 stroke-1" />
                    )}
                </div>

                {/* ランク帯 (Reference: pokeca-chart) */}
                <div className="flex justify-center -mt-3 mb-1 relative z-10">
                    <span className="text-white text-[10px] font-bold px-4 py-0.5 rounded-full shadow-sm" style={{ backgroundColor: color }}>
                        {rank}位
                    </span>
                </div>

                <div className="px-2 pt-1 pb-2 flex flex-col flex-1">
                    {/* タイトル */}
                    <p className="text-[11px] font-bold text-gray-800 line-clamp-2 mb-2 text-left h-[32px]">{card.name}</p>

                    {/* データテーブル */}
                    <div className="mt-auto flex flex-col gap-1.5 text-[10px] sm:text-[11px]">
                        <div className="flex justify-between items-center border-b border-gray-100 pb-1">
                            <span className="text-gray-500">直近価格</span>
                            <span className="font-bold text-gray-900">{formatPrice(card.display_price)}</span>
                        </div>
                        <div className="flex justify-between items-center pb-0.5">
                            <span className="text-gray-500">騰落率</span>
                            <span className={`font-bold ${change === 0 ? 'text-gray-500' : isUp ? 'text-red-600' : 'text-blue-600'}`}>
                                {change === 0 ? '±0%' : isUp ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`}
                            </span>
                        </div>
                    </div>
                </div>
            </Link>
        )
    }

    // デフォルトテーマ → nativeと同じ実用スタイル
    if (theme === 'default') {
        if (layout === 'compact') {
            return (
                <Link href={`/chart/card/${card.id}`} className="bg-white border-b border-gray-200 px-3 sm:px-4 py-3 flex items-center gap-3 w-full hover:bg-gray-50 transition-colors">
                    <div className="w-6 text-center shrink-0 font-bold text-base sm:text-lg text-gray-700">
                        {rank}
                    </div>
                    <div className="relative w-16 h-20 sm:w-20 sm:h-24 shrink-0 flex items-center justify-center">
                        {card.image_url ? (
                            <img src={card.image_url} alt={card.name} className="h-full object-contain drop-shadow-sm" loading="lazy" />
                        ) : (
                            <ImageIcon className="w-8 h-8 text-gray-300 stroke-1" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <p className="text-xs sm:text-[13px] font-bold text-gray-900 text-left line-clamp-1 mb-1.5">{card.name}</p>
                        <div className="flex flex-col sm:flex-row gap-1 sm:gap-4">
                            <div className="flex justify-between sm:justify-start gap-2 items-center sm:items-baseline">
                                <span className="text-[10px] text-gray-500">直近価格</span>
                                <span className="text-[13px] sm:text-[14px] font-bold text-gray-900 leading-none">{formatPrice(card.display_price)}</span>
                            </div>
                            <div className="flex justify-between sm:justify-start gap-2 items-center sm:items-baseline">
                                <span className="text-[10px] text-gray-500">騰落率(30日)</span>
                                <span className={`text-[12px] font-bold leading-none ${change === 0 ? 'text-gray-500' : isUp ? 'text-red-600' : 'text-blue-600'}`}>
                                    {change === 0 ? '±0%' : isUp ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`}
                                </span>
                            </div>
                        </div>
                    </div>
                </Link>
            )
        }

        const defaultWidthClass = layout === 'grid' ? 'w-full' : 'flex-shrink-0 w-[140px] sm:w-[150px]'
        return (
            <Link href={`/chart/card/${card.id}`} className={`${defaultWidthClass} bg-white border border-gray-200 rounded-lg flex flex-col hover:border-gray-300 transition-colors group`}>
                <div className="relative p-2 bg-white rounded-t-lg flex justify-center items-center h-[190px]">
                    {card.image_url ? (
                        <img src={card.image_url} alt={card.name} className="h-[170px] object-contain drop-shadow-sm group-hover:scale-105 transition-transform" loading="lazy" />
                    ) : (
                        <ImageIcon className="w-12 h-12 text-gray-200 stroke-1" />
                    )}
                </div>

                <div className="flex justify-center -mt-3 mb-1 relative z-10">
                    <span className="text-white text-[10px] font-bold px-4 py-0.5 rounded-full shadow-sm" style={{ backgroundColor: color }}>
                        {rank}位
                    </span>
                </div>

                <div className="px-2 pt-1 pb-2 flex flex-col flex-1">
                    <p className="text-[11px] font-bold text-gray-800 line-clamp-2 mb-2 text-left h-[32px]">{card.name}</p>
                    <div className="mt-auto flex flex-col gap-1.5 text-[10px] sm:text-[11px]">
                        <div className="flex justify-between items-center border-b border-gray-100 pb-1">
                            <span className="text-gray-500">直近価格</span>
                            <span className="font-bold text-gray-900">{formatPrice(card.display_price)}</span>
                        </div>
                        <div className="flex justify-between items-center pb-0.5">
                            <span className="text-gray-500">騰落率</span>
                            <span className={`font-bold ${change === 0 ? 'text-gray-500' : isUp ? 'text-red-600' : 'text-blue-600'}`}>
                                {change === 0 ? '±0%' : isUp ? `+${change.toFixed(1)}%` : `${change.toFixed(1)}%`}
                            </span>
                        </div>
                    </div>
                </div>
            </Link>
        )
    }

    const widthClass = layout === 'grid' ? 'w-full' : 'flex-shrink-0 w-[140px] sm:w-[150px] md:w-[160px]'

    return (
        <Link
            href={`/chart/card/${card.id}`}
            className={`${widthClass} overflow-hidden
            hover:-translate-y-1 transition-all duration-300 group relative flex flex-col h-full ${getCardClass()}`}
            style={theme === 'neumorphism' ? { backgroundColor: '#e0e5ec' } : {}}
        >
            {/* ダークテーマ用ホバー背景 */}
            {theme === 'dark' && (
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 to-blue-500/10 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            )}

            {/* ランク番号 */}
            <div
                className={`absolute w-7 h-7 flex items-center justify-center font-black z-20
                    ${theme === 'bento' || theme === 'neopop' ? '-top-3 -left-3 border-[3px] border-black text-xl rounded-none' :
                        theme === 'neumorphism' ? 'top-3 left-3 rounded-full text-[13px]' :
                            theme === 'dark' ? 'top-2 left-2 rounded-full text-[13px]' :
                                theme === 'glass' ? 'top-2 left-2 rounded-full text-[13px]' :
                                    theme === 'elegant' ? 'top-2 left-2 rounded-full text-[13px]' :
                                        'top-2 left-2 rounded-lg text-[13px] shadow-[0_2px_8px_rgba(0,0,0,0.12)]'}
                    ${getRankStyle()}`}
            >
                {rank}
            </div>

            {/* 変動率バッジ(右上) */}
            {(change !== 0 || theme === 'bento' || theme === 'neopop') && (
                <div className={`absolute z-20
                    font-bold
                    ${theme === 'bento' || theme === 'neopop' ? 'top-0 right-0 px-2 py-1 text-xs uppercase' :
                        theme === 'neumorphism' ? 'top-3 right-3 px-2 py-1 rounded-full text-[10px]' :
                            theme === 'glass' || theme === 'elegant' ? 'top-2 right-2 px-1.5 py-0.5 rounded-full text-[10px]' :
                                'top-2 right-2 px-1.5 py-0.5 rounded text-[10px]'}
                    ${getBadgeClass()}`}
                >
                    {isUp && theme !== 'bento' && theme !== 'neopop' ? '+' : ''}{change.toFixed(1)}%
                </div>
            )}

            {/* カード画像エリア */}
            <div className={`relative w-full h-[140px] sm:h-[150px] flex items-center justify-center overflow-hidden ${getImageWrapperClass()}`}>
                {theme === 'dark' && (
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-purple-500/30 blur-2xl rounded-full" />
                )}
                {card.image_url ? (
                    <img
                        src={card.image_url}
                        alt={card.name}
                        className={`h-[125px] sm:h-[135px] object-contain relative z-10 transition-transform duration-300 ${theme === 'bento' || theme === 'neopop' ? 'mix-blend-multiply' : theme === 'neumorphism' ? 'group-hover:scale-105 mix-blend-darken' : theme === 'dark' ? 'group-hover:scale-110 drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]' : 'group-hover:scale-105 drop-shadow-sm'}`}
                        loading="lazy"
                    />
                ) : (
                    <ImageIcon className="w-10 h-10 text-gray-200 relative z-10 stroke-1" />
                )}
            </div>

            {/* 情報エリア */}
            <div className={`px-2.5 pb-2.5 pt-2 flex flex-col flex-1 justify-between gap-1 relative z-10 ${theme === 'dark' ? 'bg-transparent' : theme === 'neumorphism' ? '' : 'bg-transparent'}`}>
                <div>
                    <div className="flex items-center gap-1 mb-1 flex-wrap">
                        {card.rarity && (
                            <span className={`px-1 py-0.5 font-bold uppercase ${theme === 'dark' ? 'text-[9px] bg-white/10 text-slate-300 rounded' : theme === 'bento' || theme === 'neopop' ? 'text-[10px] bg-black text-white w-fit tracking-wider' : theme === 'neumorphism' ? 'text-[9px] text-slate-500 rounded-full shadow-[2px_2px_5px_#c8d0e7,-2px_-2px_5px_#ffffff]' : theme === 'glass' ? 'text-[9px] bg-white/50 text-sky-800 rounded border border-white/60' : theme === 'elegant' ? 'text-[9px] bg-[#E8E1D5]/50 text-[#9C8F7A] rounded font-serif' : 'text-[9px] bg-gray-100 text-gray-500 rounded border border-gray-200/50'}`}>
                                {card.rarity}
                            </span>
                        )}
                    </div>
                    <p className={`text-[12px] sm:text-[13px] font-bold leading-tight line-clamp-2 ${getTextClass()}`}>
                        {card.name}
                    </p>
                </div>

                <div className={`mt-auto pt-1.5 ${theme === 'bento' || theme === 'neopop' ? 'border-t-[3px] border-black mt-2' : theme === 'dark' || theme === 'glass' || theme === 'neumorphism' || theme === 'elegant' ? 'border-none mt-2' : 'border-t border-gray-50'}`}>
                    <div className="flex items-baseline gap-1">
                        <p className={`text-[15px] font-black tabular-nums leading-none ${theme === 'bento' ? 'text-lg' : ''} ${getPriceClass()}`}>
                            {formatPrice(card.display_price)}
                        </p>
                    </div>
                    {card.display_price_usd > 0 && theme !== 'bento' && theme !== 'neopop' && (
                        <p className={`text-[10px] font-semibold tabular-nums mt-0.5 ${theme === 'dark' ? 'text-slate-500' : theme === 'glass' ? 'text-sky-900/40 font-bold' : theme === 'elegant' ? 'text-[#D4C3A3]' : 'text-gray-400'}`}>
                            {formatUsd(card.display_price_usd)}
                        </p>
                    )}
                </div>
            </div>
        </Link>
    )
}
