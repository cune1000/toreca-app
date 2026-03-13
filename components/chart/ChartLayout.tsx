'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, Settings, TrendingUp } from 'lucide-react'
import { useChartTheme } from './ChartThemeContext'

interface Props {
    children: React.ReactNode
    onOpenSettings?: () => void
}

export default function ChartLayout({ children, onOpenSettings }: Props) {
    const [searchQuery, setSearchQuery] = useState('')
    const { theme } = useChartTheme()

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        if (searchQuery.trim()) {
            window.location.href = `/chart/search?q=${encodeURIComponent(searchQuery.trim())}`
        }
    }

    // テーマ別の背景・ヘッダー色判定
    const getBgClass = () => {
        switch (theme) {
            case 'native': return 'bg-[#F5F6F8] text-[#111827] selection:bg-blue-100 selection:text-blue-900'
            case 'dark': return 'bg-slate-950 text-slate-200 selection:bg-indigo-500/30 selection:text-indigo-200'
            case 'neumorphism': return 'bg-[#e0e5ec] text-slate-800'
            case 'bento': return 'bg-white text-black selection:bg-black selection:text-white'
            case 'glass': return 'bg-gradient-to-br from-[#eff6ff] via-white to-[#f0f9ff] text-sky-950 bg-fixed'
            case 'neopop': return 'bg-white text-black selection:bg-yellow-300 selection:text-black font-bold tracking-tight'
            case 'elegant': return 'bg-[#FAF8F5] text-[#5C5446] selection:bg-[#D4C3A3] selection:text-white'
            default: return 'bg-[#F8FAFC] text-slate-900 selection:bg-red-100 selection:text-red-900'
        }
    }

    const getHeaderClass = () => {
        switch (theme) {
            case 'native': return 'bg-white border-gray-200'
            case 'dark': return 'bg-slate-950/70 border-slate-800/60 shadow-[0_4px_30px_rgba(0,0,0,0.5)]'
            case 'neumorphism': return 'bg-[#e0e5ec]/70 border-transparent shadow-[5px_5px_10px_#c8d0e7,-5px_-5px_10px_#ffffff]'
            case 'bento': return 'bg-white/90 border-black border-b-[3px] shadow-none'
            case 'glass': return 'bg-white/40 border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.05)]'
            case 'neopop': return 'bg-cyan-300/90 border-black border-b-[4px] shadow-none'
            case 'elegant': return 'bg-[#FAF8F5]/80 border-[#E8E1D5] shadow-sm'
            default: return 'bg-white/70 border-gray-200/60 shadow-[0_4px_30px_rgba(0,0,0,0.03)]'
        }
    }

    const getInputClass = () => {
        switch (theme) {
            case 'native': return 'bg-gray-100 border-transparent text-[#111827] placeholder-gray-500 focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500'
            case 'dark': return 'bg-slate-800/50 border-slate-700/50 text-slate-200 placeholder-slate-400 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-inner'
            case 'neumorphism': return 'bg-transparent border-transparent text-slate-700 placeholder-slate-400 focus:ring-slate-300 focus:border-transparent shadow-[inset_3px_3px_6px_#c8d0e7,inset_-3px_-3px_6px_#ffffff]'
            case 'bento': return 'bg-white border-black border-2 text-black placeholder-gray-500 focus:ring-0 focus:border-black rounded-none shadow-[2px_2px_0px_#000]'
            case 'glass': return 'bg-white/50 border-white/50 text-sky-900 placeholder-sky-900/40 focus:bg-white/80 focus:ring-sky-200/50 focus:border-sky-300 shadow-[inset_0_2px_10px_rgba(0,0,0,0.02)]'
            case 'neopop': return 'bg-white border-black border-[3px] text-black placeholder-gray-400 focus:ring-0 focus:border-black rounded-none shadow-[4px_4px_0px_#000] active:translate-x-1 active:translate-y-1 active:shadow-none'
            case 'elegant': return 'bg-white/50 border-[#E8E1D5] text-[#5C5446] placeholder-[#A8A195] focus:bg-white focus:ring-[#D4C3A3]/20 focus:border-[#D4C3A3] shadow-inner font-sans'
            default: return 'bg-gray-100/50 hover:bg-gray-100/80 border-gray-200/60 focus:bg-white focus:ring-red-400/10 focus:border-red-400 placeholder-gray-400 shadow-inner'
        }
    }

    const getLogoClass = () => {
        switch (theme) {
            case 'native': return 'bg-[#111827] text-white'
            case 'dark': return 'bg-gradient-to-br from-indigo-500 to-purple-600 shadow-[0_4px_15px_rgba(99,102,241,0.4)]'
            case 'neumorphism': return 'bg-[#e0e5ec] shadow-[3px_3px_6px_#c8d0e7,-3px_-3px_6px_#ffffff] text-slate-600'
            case 'bento': return 'bg-black text-white rounded-none border border-black'
            case 'glass': return 'bg-white/40 border border-white/60 shadow-[0_4px_12px_rgba(0,0,0,0.05)] text-sky-500'
            case 'neopop': return 'bg-yellow-300 text-black border-[3px] border-black rounded-none shadow-[2px_2px_0_#000]'
            case 'elegant': return 'bg-[#FAF8F5] border border-[#D4C3A3] text-[#9C8F7A] shadow-sm'
            default: return 'bg-gradient-to-br from-red-500 to-orange-500 shadow-[0_4px_12px_rgba(239,68,68,0.3)]'
        }
    }

    const getLogoTextClass = () => {
        switch (theme) {
            case 'native': return 'text-[#111827]'
            case 'dark': return 'bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent'
            case 'neumorphism': return 'text-slate-700'
            case 'bento': return 'text-black'
            case 'glass': return 'text-sky-900/90 font-light tracking-widest'
            case 'neopop': return 'text-black font-black uppercase tracking-tighter'
            case 'elegant': return 'text-[#5C5446] tracking-widest uppercase text-sm'
            default: return 'bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent'
        }
    }

    return (
        <div className={`min-h-screen flex flex-col relative transition-colors duration-300 ${getBgClass()}`} style={{ fontFamily: theme === 'elegant' ? '"Shippori Mincho", "Noto Serif JP", serif' : 'var(--font-noto-sans-jp), sans-serif' }}>
            {/* ヘッダー */}
            <header className={`sticky top-0 z-50 backdrop-blur-xl border-b transition-colors duration-300 ${getHeaderClass()}`}>
                <div className="max-w-6xl mx-auto px-4 py-3">
                    {/* 1行目: ロゴ + デスクトップ検索 + 設定 */}
                    <div className="flex items-center justify-between md:gap-4">
                        <Link href="/chart" className="flex items-center gap-2 shrink-0">
                            <div className={`w-9 h-9 flex items-center justify-center transition-all duration-300 ${theme === 'bento' || theme === 'neopop' ? '' : 'rounded-xl'} ${getLogoClass()}`}>
                                <TrendingUp size={20} className={theme === 'neumorphism' ? 'text-slate-500' : theme === 'glass' ? 'text-sky-500 drop-shadow-sm' : theme === 'elegant' ? 'text-[#9C8F7A]' : theme === 'neopop' ? 'text-black' : 'text-white'} />
                            </div>
                            <span className={`text-lg font-black tracking-tight hover:opacity-80 transition-opacity ${getLogoTextClass()}`}>
                                トレカチャート
                            </span>
                        </Link>

                        {/* デスクトップ: 検索バーを1行目に */}
                        <form onSubmit={handleSearch} className="hidden md:block flex-1 max-w-md">
                            <div className="relative group">
                                <Search size={16} className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors ${theme === 'dark' ? 'text-slate-400 group-focus-within:text-indigo-400' : theme === 'bento' || theme === 'neopop' ? 'text-black group-focus-within:text-black' : theme === 'glass' ? 'text-sky-900/40 group-focus-within:text-sky-500' : theme === 'elegant' ? 'text-[#A8A195] group-focus-within:text-[#D4C3A3]' : 'text-gray-400 group-focus-within:text-red-400'}`} />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="カード名・レアリティ・収録弾・セットコードで検索"
                                    className={`w-full pl-10 pr-4 py-2 border rounded-xl text-sm transition-all font-medium focus:outline-none ${theme === 'bento' ? 'rounded-none border-2' : theme === 'neopop' ? 'rounded-none' : ''} ${getInputClass()}`}
                                />
                            </div>
                        </form>

                        {/* 設定ボタン */}
                        {onOpenSettings && (
                            <button
                                onClick={onOpenSettings}
                                className={`p-2 transition-all min-h-[44px] min-w-[44px] flex items-center justify-center border border-transparent 
                                    ${theme === 'native' ? 'hover:bg-gray-100 rounded-xl' :
                                        theme === 'dark' ? 'hover:bg-slate-800/80 hover:border-slate-700/60' :
                                            theme === 'bento' ? 'hover:bg-black hover:text-white rounded-none border-2 border-transparent hover:border-black' :
                                                theme === 'neumorphism' ? 'rounded-xl shadow-[3px_3px_6px_#c8d0e7,-3px_-3px_6px_#ffffff] hover:shadow-[inset_2px_2px_5px_#c8d0e7,inset_-2px_-2px_5px_#ffffff]' :
                                                    theme === 'glass' ? 'hover:bg-white/50 border-white/40 hover:border-white/80 rounded-xl shadow-sm' :
                                                        theme === 'neopop' ? 'bg-white border-[3px] border-black text-black rounded-none shadow-[4px_4px_0_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none' :
                                                            theme === 'elegant' ? 'hover:bg-[#E8E1D5]/40 rounded-full hover:border-[#D4C3A3]' :
                                                                'hover:bg-gray-100/80 rounded-xl hover:border-gray-200/60 hover:shadow-sm'}`}
                                title="ランキング設定"
                            >
                                <Settings size={22} className={theme === 'dark' ? 'text-slate-400' : theme === 'bento' || theme === 'neopop' || theme === 'native' ? 'text-current' : theme === 'glass' ? 'text-sky-900/60' : theme === 'elegant' ? 'text-[#9C8F7A]' : 'text-gray-500'} />
                            </button>
                        )}
                    </div>

                    {/* 2行目: モバイル検索バー */}
                    <form onSubmit={handleSearch} className="mt-3 md:hidden">
                        <div className="relative group">
                            <Search size={16} className={`absolute left-3.5 top-1/2 -translate-y-1/2 transition-colors ${theme === 'dark' ? 'text-slate-400 group-focus-within:text-indigo-400' : theme === 'bento' || theme === 'neopop' ? 'text-black group-focus-within:text-black' : theme === 'glass' ? 'text-sky-900/40 group-focus-within:text-sky-500' : theme === 'elegant' ? 'text-[#A8A195] group-focus-within:text-[#D4C3A3]' : 'text-gray-400 group-focus-within:text-red-400'}`} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="カード名・レアリティ・収録弾・セットコードで検索"
                                className={`w-full pl-10 pr-4 py-2.5 border rounded-xl text-sm font-medium focus:outline-none transition-all ${theme === 'bento' ? 'rounded-none border-2' : theme === 'neopop' ? 'rounded-none border-[3px] border-black' : ''} ${getInputClass()}`}
                            />
                        </div>
                    </form>
                </div>
            </header>

            {/* コンテンツ */}
            <main className="max-w-6xl mx-auto flex-1 w-full relative z-10">
                {/* 背景アクセント (Default / Dark / Glass / Elegant) */}
                {theme === 'default' && (
                    <>
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-red-400/5 rounded-full blur-[100px] -z-10 pointer-events-none" />
                        <div className="absolute top-40 right-0 w-[400px] h-[400px] bg-orange-400/5 rounded-full blur-[100px] -z-10 pointer-events-none" />
                    </>
                )}
                {theme === 'dark' && (
                    <>
                        <div className="absolute top-0 left-1/4 -translate-x-1/2 w-[600px] h-[400px] bg-indigo-500/10 rounded-full blur-[120px] -z-10 pointer-events-none" />
                        <div className="absolute top-80 right-1/4 w-[500px] h-[500px] bg-purple-500/10 rounded-full blur-[120px] -z-10 pointer-events-none" />
                        <div className="absolute top-[1000px] left-1/3 w-[800px] h-[800px] bg-blue-500/5 rounded-full blur-[150px] -z-10 pointer-events-none" />
                    </>
                )}
                {theme === 'glass' && (
                    <>
                        <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-b from-blue-100/50 via-sky-100/30 to-transparent blur-3xl -z-10 pointer-events-none" />
                        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-sky-200/40 rounded-full blur-[100px] -z-10 pointer-events-none" />
                        <div className="absolute top-[400px] left-[-200px] w-[600px] h-[600px] bg-purple-200/30 rounded-full blur-[120px] -z-10 pointer-events-none" />
                    </>
                )}
                {theme === 'elegant' && (
                    <>
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-3xl h-[400px] bg-[#E8E1D5]/30 rounded-full blur-[100px] -z-10 pointer-events-none" />
                    </>
                )}

                {children}
            </main>

            {/* フッター */}
            <footer className={`border-t mt-16 py-12 text-center text-xs relative z-10 backdrop-blur-sm transition-colors duration-300
                ${theme === 'native' ? 'bg-white border-gray-200 text-gray-500' :
                    theme === 'dark' ? 'bg-slate-950/40 border-slate-800/60 text-slate-500' :
                        theme === 'bento' ? 'bg-white border-black border-t-[3px] text-gray-500' :
                            theme === 'neumorphism' ? 'bg-[#e0e5ec]/40 border-transparent text-slate-500 shadow-[inset_0_2px_5px_#c8d0e7]' :
                                theme === 'glass' ? 'bg-white/20 border-white/30 text-sky-900/60' :
                                    theme === 'neopop' ? 'bg-indigo-300 border-black border-t-[4px] text-black font-bold' :
                                        theme === 'elegant' ? 'bg-[#FAF8F5]/60 border-[#E8E1D5] text-[#9C8F7A]' :
                                            'bg-white/40 border-gray-200/60 text-gray-400'}`}
            >
                <p>※ 本サイトにはプロモーションが含まれています。</p>
                <p className="mt-2 font-medium">© 2026 トレカチャート</p>
            </footer>
        </div>
    )
}
