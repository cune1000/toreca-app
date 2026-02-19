'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
    { key: 'dashboard', icon: '📊', label: 'ダッシュボード', href: '/pos' },
    { key: 'catalog', icon: '📋', label: 'カタログ・在庫', href: '/pos/catalog' },
    { key: 'purchase', icon: '💰', label: '仕入れ登録', href: '/pos/purchase' },
    { key: 'sale', icon: '🛒', label: '販売登録', href: '/pos/sale' },
    { key: 'history', icon: '📜', label: '取引履歴', href: '/pos/history' },
]

export default function PosLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()

    return (
        <div className="min-h-screen bg-[#f8f9fb] flex">
            {/* PC サイドバー */}
            <aside className="w-60 bg-white border-r border-gray-200 flex-shrink-0 sticky top-0 h-screen overflow-y-auto">
                <div className="px-5 py-5 border-b border-gray-100">
                    <Link href="/pos" className="flex items-center gap-2.5">
                        <span className="text-2xl">🏪</span>
                        <span className="text-lg font-bold text-gray-900">POS管理</span>
                    </Link>
                </div>
                <nav className="px-3 py-4 space-y-1">
                    {NAV_ITEMS.map(item => {
                        const active = pathname === item.href || (item.href !== '/pos' && pathname.startsWith(item.href))
                        return (
                            <Link
                                key={item.key}
                                href={item.href}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-colors ${active
                                        ? 'bg-gray-900 text-white'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                    }`}
                            >
                                <span className="text-lg">{item.icon}</span>
                                <span>{item.label}</span>
                            </Link>
                        )
                    })}
                </nav>
            </aside>

            {/* メインコンテンツ */}
            <main className="flex-1 min-w-0">
                <div className="max-w-6xl mx-auto px-10 py-8">
                    {children}
                </div>
            </main>
        </div>
    )
}
