'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Search, Settings, TrendingUp } from 'lucide-react'

interface Props {
    children: React.ReactNode
    onOpenSettings?: () => void
}

export default function ChartLayout({ children, onOpenSettings }: Props) {
    const [searchQuery, setSearchQuery] = useState('')

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault()
        if (searchQuery.trim()) {
            window.location.href = `/chart/search?q=${encodeURIComponent(searchQuery.trim())}`
        }
    }

    return (
        <div className="min-h-screen bg-[#F8FAFC] flex flex-col font-sans relative selection:bg-red-100 selection:text-red-900">
            {/* ヘッダー */}
            <header className="sticky top-0 z-50 bg-white/70 backdrop-blur-xl border-b border-gray-200/60 shadow-[0_4px_30px_rgba(0,0,0,0.03)]">
                <div className="max-w-6xl mx-auto px-4 py-3">
                    {/* 1行目: ロゴ + デスクトップ検索 + 設定 */}
                    <div className="flex items-center justify-between md:gap-4">
                        <Link href="/chart" className="flex items-center gap-2 shrink-0">
                            <div className="w-9 h-9 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center shadow-[0_4px_12px_rgba(239,68,68,0.3)]">
                                <TrendingUp size={20} className="text-white" />
                            </div>
                            <span className="text-lg font-black bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent tracking-tight hover:opacity-80 transition-opacity">
                                トレカチャート
                            </span>
                        </Link>

                        {/* デスクトップ: 検索バーを1行目に */}
                        <form onSubmit={handleSearch} className="hidden md:block flex-1 max-w-md">
                            <div className="relative group">
                                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-red-400 transition-colors" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="カード名を検索..."
                                    className="w-full pl-10 pr-4 py-2 bg-gray-100/50 hover:bg-gray-100/80 border border-gray-200/60 rounded-xl text-sm
                                        focus:bg-white focus:outline-none focus:ring-4 focus:ring-red-400/10 focus:border-red-400 transition-all font-medium placeholder-gray-400 shadow-inner"
                                />
                            </div>
                        </form>

                        {/* 設定ボタン */}
                        {onOpenSettings && (
                            <button
                                onClick={onOpenSettings}
                                className="p-2 hover:bg-gray-100/80 rounded-xl transition-all min-h-[44px] min-w-[44px] flex items-center justify-center border border-transparent hover:border-gray-200/60 hover:shadow-sm"
                                title="ランキング設定"
                            >
                                <Settings size={22} className="text-gray-500" />
                            </button>
                        )}
                    </div>

                    {/* 2行目: モバイル検索バー */}
                    <form onSubmit={handleSearch} className="mt-3 md:hidden">
                        <div className="relative group">
                            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-red-400 transition-colors" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="カード名を検索..."
                                className="w-full pl-10 pr-4 py-2.5 bg-gray-100/50 border border-gray-200/60 rounded-xl text-sm font-medium
                                    focus:bg-white focus:outline-none focus:ring-4 focus:ring-red-400/10 focus:border-red-400 transition-all placeholder-gray-400 shadow-inner"
                            />
                        </div>
                    </form>
                </div>
            </header>

            {/* コンテンツ */}
            <main className="max-w-6xl mx-auto flex-1 w-full relative z-10 w-full">
                {/* プレミアム感のある背景アクセント */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-red-400/5 rounded-full blur-[100px] -z-10 pointer-events-none" />
                <div className="absolute top-40 right-0 w-[400px] h-[400px] bg-orange-400/5 rounded-full blur-[100px] -z-10 pointer-events-none" />

                {children}
            </main>

            {/* フッター */}
            <footer className="border-t border-gray-200/60 mt-16 py-12 text-center text-xs text-gray-400 bg-white/40 backdrop-blur-sm z-10 relative">
                <p>※ 本サイトにはプロモーションが含まれています。</p>
                <p className="mt-2 font-medium">© 2026 トレカチャート</p>
            </footer>
        </div>
    )
}
