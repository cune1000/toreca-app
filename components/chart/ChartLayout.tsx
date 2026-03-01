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
        <>
            {/* ヘッダー */}
            <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-100 shadow-sm">
                <div className="max-w-6xl mx-auto px-4 py-3">
                    {/* 1行目: ロゴ + デスクトップ検索 + 設定 */}
                    <div className="flex items-center justify-between md:gap-4">
                        <Link href="/chart" className="flex items-center gap-2 shrink-0">
                            <div className="w-9 h-9 bg-gradient-to-br from-red-500 to-orange-500 rounded-xl flex items-center justify-center shadow-sm">
                                <TrendingUp size={20} className="text-white" />
                            </div>
                            <span className="text-lg font-black bg-gradient-to-r from-red-500 to-orange-500 bg-clip-text text-transparent tracking-tight">
                                トレカチャート
                            </span>
                        </Link>

                        {/* デスクトップ: 検索バーを1行目に */}
                        <form onSubmit={handleSearch} className="hidden md:block flex-1 max-w-md">
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    placeholder="カード名を検索..."
                                    className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm
                                        focus:outline-none focus:ring-2 focus:ring-red-400/30 focus:border-red-400 transition-all"
                                />
                            </div>
                        </form>

                        {/* 設定ボタン */}
                        {onOpenSettings && (
                            <button
                                onClick={onOpenSettings}
                                className="p-2.5 hover:bg-gray-100 rounded-xl transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
                                title="ランキング設定"
                            >
                                <Settings size={22} className="text-gray-500" />
                            </button>
                        )}
                    </div>

                    {/* 2行目: モバイル検索バー */}
                    <form onSubmit={handleSearch} className="mt-2 md:hidden">
                        <div className="relative">
                            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="カード名を検索..."
                                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm
                                    focus:outline-none focus:ring-2 focus:ring-red-400/30 focus:border-red-400 transition-all"
                            />
                        </div>
                    </form>
                </div>
            </header>

            {/* コンテンツ */}
            <main className="max-w-6xl mx-auto">
                {children}
            </main>

            {/* フッター */}
            <footer className="border-t border-gray-100 mt-12 py-8 text-center text-xs text-gray-400">
                <p>※ 本サイトにはプロモーションが含まれています。</p>
                <p className="mt-1">© 2026 トレカチャート</p>
            </footer>
        </>
    )
}
