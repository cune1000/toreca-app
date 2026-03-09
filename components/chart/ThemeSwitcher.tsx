'use client'

import { useChartTheme } from './ChartThemeContext'
import { Palette, LayoutGrid, List, Columns3 } from 'lucide-react'

export default function ThemeSwitcher() {
    const { theme, setTheme, layout, setLayout } = useChartTheme()

    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 bg-white/90 backdrop-blur-md p-2 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.15)] border border-gray-200/50">
            {/* テーマ切替 */}
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 pr-3 sm:pr-4 border-r border-gray-200">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-sm">
                        <Palette size={16} className="text-white" />
                    </div>
                    <span className="text-xs font-bold text-gray-700 hidden sm:block">デザイン</span>
                </div>

                <div className="flex gap-1 overflow-x-auto hide-scrollbar max-w-[250px] sm:max-w-none">
                    <button
                        onClick={() => setTheme('default')}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all whitespace-nowrap ${theme === 'default' ? 'bg-gray-800 text-white' : 'hover:bg-gray-100 text-gray-600'}`}
                    >
                        Default
                    </button>
                    <button
                        onClick={() => setTheme('native')}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all whitespace-nowrap ${theme === 'native' ? 'bg-blue-600 text-white shadow-sm' : 'hover:bg-gray-100 text-gray-600'}`}
                    >
                        📱 実用アプリ
                    </button>
                    <button
                        onClick={() => setTheme('bento')}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all whitespace-nowrap ${theme === 'bento' ? 'bg-black text-white' : 'hover:bg-gray-100 text-gray-600'}`}
                    >
                        Bento
                    </button>
                    <button
                        onClick={() => setTheme('dark')}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all whitespace-nowrap ${theme === 'dark' ? 'bg-indigo-600 text-white shadow-[0_2px_10px_rgba(79,70,229,0.4)]' : 'hover:bg-gray-100 text-gray-600'}`}
                    >
                        Premium Dark
                    </button>
                    <button
                        onClick={() => setTheme('neumorphism')}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all whitespace-nowrap ${theme === 'neumorphism' ? 'bg-slate-300 text-slate-800 shadow-inner' : 'hover:bg-gray-100 text-gray-600'}`}
                    >
                        Soft UI
                    </button>
                    <button
                        onClick={() => setTheme('glass')}
                        className={`px-3 py-1.5 rounded-full text-[11px] font-bold transition-all whitespace-nowrap ${theme === 'glass' ? 'bg-white/40 backdrop-blur-md border border-white/60 text-sky-800 shadow-[0_4px_12px_rgba(0,0,0,0.1)]' : 'hover:bg-gray-100 text-gray-600'}`}
                    >
                        💎 Glass
                    </button>
                    <button
                        onClick={() => setTheme('neopop')}
                        className={`px-3 py-1.5 text-[11px] font-bold transition-all whitespace-nowrap ${theme === 'neopop' ? 'bg-yellow-300 text-black border-2 border-black shadow-[2px_2px_0_#000]' : 'hover:bg-gray-100 text-gray-600'}`}
                    >
                        🎨 Neo-Pop
                    </button>
                    <button
                        onClick={() => setTheme('elegant')}
                        className={`px-3 py-1.5 text-[11px] transition-all whitespace-nowrap border ${theme === 'elegant' ? 'bg-[#FAF8F5] text-[#5C5446] border-[#D4C3A3] shadow-sm font-serif' : 'border-transparent font-bold hover:bg-gray-100 text-gray-600'}`}
                    >
                        ✨ Elegant
                    </button>
                </div>
            </div>

            <div className="h-px bg-gray-100 w-full" />

            {/* レイアウト切替 */}
            <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 pr-3 sm:pr-4 border-r border-gray-200">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-500 to-teal-500 flex items-center justify-center shadow-sm">
                        <LayoutGrid size={16} className="text-white" />
                    </div>
                    <span className="text-xs font-bold text-gray-700 hidden sm:block">レイアウト</span>
                </div>

                <div className="flex gap-1 overflow-x-auto hide-scrollbar max-w-[250px] sm:max-w-none">
                    <button
                        onClick={() => setLayout('carousel')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all whitespace-nowrap ${layout === 'carousel' ? 'bg-emerald-600 text-white' : 'hover:bg-gray-100 text-gray-600'}`}
                    >
                        <Columns3 size={12} /> スクロール
                    </button>
                    <button
                        onClick={() => setLayout('grid')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all whitespace-nowrap ${layout === 'grid' ? 'bg-emerald-600 text-white' : 'hover:bg-gray-100 text-gray-600'}`}
                    >
                        <LayoutGrid size={12} /> グリッド
                    </button>
                    <button
                        onClick={() => setLayout('compact')}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all whitespace-nowrap ${layout === 'compact' ? 'bg-emerald-600 text-white' : 'hover:bg-gray-100 text-gray-600'}`}
                    >
                        <List size={12} /> リスト
                    </button>
                </div>
            </div>
        </div>
    )
}
