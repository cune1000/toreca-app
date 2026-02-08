import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'トレカチャート - トレーディングカード価格情報',
    description: 'トレーディングカードの価格推移・ランキング・買取相場を一覧で確認。ポケカ・ワンピース・遊戯王・MTG対応。',
    openGraph: {
        title: 'トレカチャート',
        description: 'トレーディングカードの価格推移・ランキング・買取相場',
        type: 'website',
    },
}

export default function ChartLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-gray-50">
            {children}
        </div>
    )
}
