'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
    { key: 'dashboard', icon: '📊', label: 'ダッシュボード', shortLabel: 'ホーム', href: '/pos', mobile: true },
    { key: 'catalog', icon: '📋', label: 'カタログ・在庫', shortLabel: '在庫', href: '/pos/catalog', mobile: true },
    { key: 'sale', icon: '🛒', label: '販売登録', shortLabel: '販売', href: '/pos/sale', mobile: true },
    { key: 'checkout', icon: '📦', label: '持ち出し管理', shortLabel: '持出し', href: '/pos/checkout', mobile: true },
    { key: 'sources', icon: '🏢', label: '仕入先', shortLabel: '仕入先', href: '/pos/sources', mobile: false },
    { key: 'history', icon: '📜', label: '取引履歴', shortLabel: '履歴', href: '/pos/history', mobile: true },
]

const MOBILE_NAV = NAV_ITEMS.filter(i => i.mobile)

export default function PosLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname()

    return (
        <div className="min-h-screen bg-[#f8f9fb] flex">
            {/* PC サイドバー */}
            <aside className="hidden md:flex w-60 bg-white border-r border-gray-200 flex-shrink-0 sticky top-0 h-screen overflow-y-auto flex-col">
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
            <main className="flex-1 min-w-0 pb-24 md:pb-0">
                <div className="max-w-6xl mx-auto px-4 py-4 md:px-10 md:py-8">
                    {children}
                </div>
            </main>

            {/* モバイル ボトムナビ */}
            <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden z-50 safe-area-pb">
                <div className="flex justify-around items-center h-16">
                    {MOBILE_NAV.map(item => {
                        const active = pathname === item.href || (item.href !== '/pos' && pathname.startsWith(item.href))
                        return (
                            <Link
                                key={item.key}
                                href={item.href}
                                className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg min-w-[60px] transition-colors ${active
                                    ? 'text-gray-900 bg-gray-100'
                                    : 'text-gray-400 active:bg-gray-50'
                                }`}
                            >
                                <span className="text-xl leading-none">{item.icon}</span>
                                <span className={`text-[11px] leading-tight ${active ? 'font-bold' : 'font-medium'}`}>{item.shortLabel}</span>
                            </Link>
                        )
                    })}
                </div>
            </nav>
        </div>
    )
}
