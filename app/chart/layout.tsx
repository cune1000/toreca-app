import type { Metadata } from 'next'

export const metadata: Metadata = {
    title: 'トレカチャート - 海外相場で見るトレカ価格情報',
    description: 'PriceCharting海外相場ベースのトレーディングカード価格推移・ランキングを一覧で確認。素体・PSA10の価格変動をリアルタイムで追跡。ポケカ・ワンピース・遊戯王・MTG対応。',
    openGraph: {
        title: 'トレカチャート',
        description: '海外相場ベースのトレカ価格推移・ランキング・PSA10価格を確認',
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
