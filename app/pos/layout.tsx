import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'POS管理 - トレカ在庫管理システム',
    description: 'トレーディングカードショップ向けの在庫管理・販売支援システム',
}

export default function PosRootLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-gray-50">
            {children}
        </div>
    )
}
