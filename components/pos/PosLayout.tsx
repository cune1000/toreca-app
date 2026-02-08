'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_ITEMS } from '@/lib/pos/constants'

interface Props {
    children: React.ReactNode
}

export default function PosLayout({ children }: Props) {
    const pathname = usePathname()

    const getActiveKey = () => {
        if (pathname === '/pos') return 'dashboard'
        const match = NAV_ITEMS.find(item => item.key !== 'dashboard' && pathname.startsWith(item.href))
        return match?.key || 'dashboard'
    }

    const active = getActiveKey()

    return (
        <div className="min-h-screen bg-gray-50 flex">
            {/* PC サイドバー */}
            <aside className="hidden md:flex flex-col w-52 bg-white border-r border-gray-100 min-h-screen pt-4 shrink-0">
                <div className="px-4 mb-6">
                    <Link href="/pos" className="text-base font-bold text-gray-800 flex items-center gap-2">
                        <span className="text-lg">🏪</span> POS管理
                    </Link>
                </div>
                {NAV_ITEMS.map(item => (
                    <Link
                        key={item.key}
                        href={item.href}
                        className={`flex items-center gap-2.5 px-4 py-2.5 text-sm transition-colors ${active === item.key
                                ? 'bg-gray-800 text-white mx-2 rounded-lg font-medium'
                                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                            }`}
                    >
                        <span>{item.icon}</span>
                        <span>{item.label}</span>
                    </Link>
                ))}
            </aside>

            {/* メインコンテンツ */}
            <main className="flex-1 px-4 py-4 md:px-6 md:py-6 pb-20 md:pb-6 max-w-4xl">
                {children}
            </main>

            {/* モバイル 下部ナビ */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 flex z-50">
                {NAV_ITEMS.map(item => (
                    <Link
                        key={item.key}
                        href={item.href}
                        className={`flex-1 flex flex-col items-center py-2 text-[10px] transition-colors ${active === item.key ? 'text-gray-800 font-bold' : 'text-gray-400'
                            }`}
                    >
                        <span className="text-base">{item.icon}</span>
                        <span>{item.label}</span>
                    </Link>
                ))}
            </nav>
        </div>
    )
}
