'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Share2 } from 'lucide-react'
import ChartLayoutComponent from '@/components/chart/ChartLayout'
import PriceGraph from '@/components/chart/PriceGraph'
import PurchasePriceTable from '@/components/chart/PurchasePriceTable'
import AffiliateButtons from '@/components/chart/AffiliateButtons'
import PriceChangeIndicator from '@/components/chart/PriceChangeIndicator'
import ShinsokuLink from '@/components/chart/ShinsokuLink'
import { getCardDetail, getPriceHistory, getPurchasePrices } from '@/lib/chart/queries'
import { getAffiliateLinks } from '@/lib/chart/affiliate'
import { formatPrice } from '@/lib/chart/format'
import { CardDetail, PricePoint, PurchaseShopPrice } from '@/lib/chart/types'
import { supabase } from '@/lib/supabase'

interface Props {
    params: Promise<{ id: string }>
}

export default function CardDetailPage({ params }: Props) {
    const [card, setCard] = useState<CardDetail | null>(null)
    const [priceData, setPriceData] = useState<Record<string, PricePoint[]>>({})
    const [purchasePrices, setPurchasePrices] = useState<PurchaseShopPrice[]>([])
    const [tab, setTab] = useState<'chart' | 'purchase' | 'shinsoku'>('chart')
    const [shinsokuItemId, setShinsokuItemId] = useState<string | null>(null)
    const [loading, setLoading] = useState(true)
    const [cardId, setCardId] = useState<string>('')

    useEffect(() => {
        params.then(p => setCardId(p.id))
    }, [params])

    useEffect(() => {
        if (!cardId) return

        async function fetchData() {
            setLoading(true)

            const [cardData, history30, history90, history1y, historyAll, purchases, shinsokuRes] = await Promise.all([
                getCardDetail(cardId),
                getPriceHistory(cardId, '30d'),
                getPriceHistory(cardId, '90d'),
                getPriceHistory(cardId, '1y'),
                getPriceHistory(cardId, 'all'),
                getPurchasePrices(cardId),
                supabase.from('cards').select('shinsoku_item_id').eq('id', cardId).single(),
            ])

            setCard(cardData)
            setPriceData({
                '30d': history30,
                '90d': history90,
                '1y': history1y,
                'all': historyAll,
            })
            setPurchasePrices(purchases)
            setShinsokuItemId(shinsokuRes.data?.shinsoku_item_id || null)
            setLoading(false)
        }

        fetchData()
    }, [cardId])

    if (loading) {
        return (
            <ChartLayoutComponent>
                <div className="py-20 text-center">
                    <div className="inline-block w-8 h-8 border-2 border-gray-200 border-t-red-400 rounded-full animate-spin" />
                    <p className="text-sm text-gray-400 mt-3">読み込み中...</p>
                </div>
            </ChartLayoutComponent>
        )
    }

    if (!card) {
        return (
            <ChartLayoutComponent>
                <div className="py-20 text-center">
                    <p className="text-lg text-gray-400">カードが見つかりません</p>
                    <Link href="/chart" className="text-red-500 text-sm mt-2 inline-block hover:underline">
                        トップに戻る
                    </Link>
                </div>
            </ChartLayoutComponent>
        )
    }

    const affiliateLinks = getAffiliateLinks(card.name, card.rarity, card.avg_price)
    const spread = card.avg_price - (card.purchase_price_avg || 0)
    const spreadPct = card.avg_price > 0 ? ((spread / card.avg_price) * 100) : 0

    return (
        <div className="min-h-screen bg-gray-50">
            {/* ヘッダー */}
            <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
                <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
                    <Link
                        href="/chart"
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"
                    >
                        <ArrowLeft size={18} />
                    </Link>
                    <h1 className="text-sm font-bold text-gray-800 truncate flex-1">
                        {card.name}
                    </h1>
                    <button
                        onClick={() => {
                            if (navigator.share) {
                                navigator.share({ title: card.name, url: window.location.href })
                            } else {
                                navigator.clipboard.writeText(window.location.href)
                            }
                        }}
                        className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
                    >
                        <Share2 size={16} className="text-gray-500" />
                    </button>
                </div>
            </header>

            <main className="max-w-3xl mx-auto">
                {/* カード情報ヘッダー */}
                <div className="bg-white px-4 pt-4 pb-5">
                    <div className="flex gap-4">
                        {/* カード画像 */}
                        <div className="flex-shrink-0 w-28 h-40 rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center overflow-hidden shadow-md border border-gray-100">
                            {card.image_url ? (
                                <img src={card.image_url} alt={card.name} className="h-full object-contain" />
                            ) : (
                                <span className="text-5xl text-gray-300">🃏</span>
                            )}
                        </div>

                        {/* 基本情報 */}
                        <div className="flex-1 min-w-0">
                            <h2 className="text-lg font-bold text-gray-900 leading-tight">
                                {card.name}
                            </h2>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {card.rarity && (
                                    <span className="text-[10px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">
                                        {card.rarity}
                                    </span>
                                )}
                                {card.card_number && (
                                    <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                                        {card.card_number}
                                    </span>
                                )}
                            </div>
                            {card.category && (
                                <p className="text-xs text-gray-400 mt-1">{card.category}</p>
                            )}

                            {/* 現在価格 */}
                            <div className="mt-3">
                                <p className="text-2xl font-bold text-gray-900">
                                    {formatPrice(card.avg_price)}
                                </p>
                                <div className="flex items-center gap-3 mt-0.5">
                                    <div className="flex items-center gap-1">
                                        <span className="text-[10px] text-gray-400">24h</span>
                                        <PriceChangeIndicator value={card.price_change_24h} />
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-[10px] text-gray-400">7d</span>
                                        <PriceChangeIndicator value={card.price_change_7d} />
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-[10px] text-gray-400">30d</span>
                                        <PriceChangeIndicator value={card.price_change_30d} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 価格サマリーカード */}
                    <div className="grid grid-cols-3 gap-2 mt-4">
                        <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                            <p className="text-[10px] text-gray-400">買取平均</p>
                            <p className="text-sm font-bold text-green-600">
                                {card.purchase_price_avg ? formatPrice(card.purchase_price_avg) : '-'}
                            </p>
                        </div>
                        <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                            <p className="text-[10px] text-gray-400">最高値</p>
                            <p className="text-sm font-bold text-red-500">
                                {card.high_price ? formatPrice(card.high_price) : '-'}
                            </p>
                        </div>
                        <div className="bg-gray-50 rounded-lg px-3 py-2 text-center">
                            <p className="text-[10px] text-gray-400">最安値</p>
                            <p className="text-sm font-bold text-blue-500">
                                {card.low_price ? formatPrice(card.low_price) : '-'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* タブナビ */}
                <div className="bg-white border-t border-b border-gray-100 px-4 mt-1">
                    <div className="flex">
                        {[
                            { key: 'chart' as const, label: '📊 チャート' },
                            { key: 'purchase' as const, label: '🏪 買取価格' },
                            { key: 'shinsoku' as const, label: `🔗 シンソク${shinsokuItemId ? ' ✅' : ''}` },
                        ].map(t => (
                            <button
                                key={t.key}
                                onClick={() => setTab(t.key)}
                                className={`flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors ${tab === t.key
                                    ? 'border-gray-800 text-gray-800'
                                    : 'border-transparent text-gray-400 hover:text-gray-600'
                                    }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="px-4 py-4">
                    {/* チャートタブ */}
                    {tab === 'chart' && (
                        <>
                            <PriceGraph
                                data={priceData}
                                onPeriodChange={() => { }}
                            />

                            {/* スプレッド */}
                            {card.purchase_price_avg && card.purchase_price_avg > 0 && (
                                <div className="mt-3 bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs text-gray-500">販売 - 買取 スプレッド</p>
                                        <p className="text-sm font-bold text-amber-600">
                                            {formatPrice(spread)}
                                            <span className="text-[10px] text-gray-400 ml-1">
                                                ({spreadPct.toFixed(1)}%)
                                            </span>
                                        </p>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* 買取価格タブ */}
                    {tab === 'purchase' && (
                        <>
                            <h3 className="text-sm font-bold text-gray-700 mb-3">
                                店舗別 買取価格
                            </h3>
                            <PurchasePriceTable prices={purchasePrices} />
                        </>
                    )}

                    {/* シンソク紐付けタブ */}
                    {tab === 'shinsoku' && (
                        <>
                            <h3 className="text-sm font-bold text-gray-700 mb-3">
                                🔗 シンソク買取 紐付け
                            </h3>
                            <p className="text-xs text-gray-400 mb-3">
                                シンソクの商品と紐付けると、買取価格を自動追跡します
                            </p>
                            <ShinsokuLink
                                cardId={cardId}
                                cardName={card.name}
                                linkedItemId={shinsokuItemId}
                                onLinked={(itemId) => setShinsokuItemId(itemId)}
                                onUnlinked={() => setShinsokuItemId(null)}
                            />
                        </>
                    )}

                    {/* アフィリエイトリンク（常に表示） */}
                    <div className="mt-6">
                        <h3 className="text-sm font-bold text-gray-700 mb-3">
                            🛒 この商品を探す
                        </h3>
                        <AffiliateButtons links={affiliateLinks} />
                    </div>

                    {/* 広告バナー */}
                    <div className="mt-6 bg-gray-100 border border-dashed border-gray-300 rounded-xl h-20 flex items-center justify-center text-gray-400 text-sm">
                        広告バナー
                    </div>

                    {/* カード基本情報 */}
                    <div className="mt-6 bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                        <h3 className="text-sm font-bold text-gray-700 mb-3">📋 カード情報</h3>
                        <div className="space-y-2 text-sm">
                            {[
                                ['カード名', card.name],
                                ['レアリティ', card.rarity],
                                ['カード番号', card.card_number || '-'],
                                ['カテゴリ', card.category],
                            ].filter(([_, v]) => v).map(([k, v]) => (
                                <div key={k} className="flex justify-between">
                                    <span className="text-gray-400">{k}</span>
                                    <span className="text-gray-800 font-medium">{v}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </main>

            {/* フッター */}
            <footer className="border-t border-gray-100 mt-8 py-6 text-center text-xs text-gray-400">
                <p>※ 本サイトにはプロモーションが含まれています。</p>
                <p className="mt-1">© 2026 トレカチャート</p>
            </footer>
        </div>
    )
}
