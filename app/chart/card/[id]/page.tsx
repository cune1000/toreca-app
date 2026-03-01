'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Share2 } from 'lucide-react'
import ChartLayoutComponent from '@/components/chart/ChartLayout'
import PriceGraph from '@/components/chart/PriceGraph'
import PurchasePriceTable from '@/components/chart/PurchasePriceTable'
import AffiliateButtons from '@/components/chart/AffiliateButtons'
import PriceChangeIndicator from '@/components/chart/PriceChangeIndicator'
import { getCardDetail, getPriceHistory } from '@/lib/chart/queries'
import { getAffiliateLinks } from '@/lib/chart/affiliate'
import { formatPrice, formatUsd } from '@/lib/chart/format'
import { CardDetail, PricePoint } from '@/lib/chart/types'

interface Props {
    params: Promise<{ id: string }>
}

export default function CardDetailPage({ params }: Props) {
    const [card, setCard] = useState<CardDetail | null>(null)
    const [priceData, setPriceData] = useState<Record<string, PricePoint[]>>({})
    const [loading, setLoading] = useState(true)
    const [cardId, setCardId] = useState<string>('')

    useEffect(() => {
        params.then(p => setCardId(p.id))
    }, [params])

    useEffect(() => {
        if (!cardId) return

        async function fetchData() {
            setLoading(true)

            const [cardData, history7, history30, history90, history1y, historyAll] = await Promise.all([
                getCardDetail(cardId),
                getPriceHistory(cardId, '7d'),
                getPriceHistory(cardId, '30d'),
                getPriceHistory(cardId, '90d'),
                getPriceHistory(cardId, '1y'),
                getPriceHistory(cardId, 'all'),
            ])

            setCard(cardData)
            setPriceData({
                '7d': history7,
                '30d': history30,
                '90d': history90,
                '1y': history1y,
                'all': historyAll,
            })
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

    const affiliateLinks = getAffiliateLinks(card.name, card.rarity, card.display_price)

    return (
        <div className="min-h-screen bg-gray-50">
            {/* ヘッダー */}
            <header className="sticky top-0 z-40 bg-white border-b border-gray-100 shadow-sm">
                <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
                    <Link
                        href="/chart"
                        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 min-h-[44px] min-w-[44px]"
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
                        className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 min-h-[44px] min-w-[44px]"
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
                        <div className="flex-shrink-0 w-24 h-32 sm:w-32 sm:h-44 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center overflow-hidden shadow-lg border border-gray-100">
                            {card.image_url ? (
                                <img src={card.image_url} alt={card.name} className="h-full object-contain" />
                            ) : (
                                <span className="text-5xl text-gray-200">🃏</span>
                            )}
                        </div>

                        {/* 基本情報 */}
                        <div className="flex-1 min-w-0">
                            <h2 className="text-lg font-bold text-gray-900 leading-tight">
                                {card.name}
                            </h2>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                                {card.rarity && (
                                    <span className="text-xs px-2.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-semibold">
                                        {card.rarity}
                                    </span>
                                )}
                                {card.card_number && (
                                    <span className="text-xs px-2.5 py-0.5 bg-gray-100 text-gray-600 rounded-full">
                                        {card.card_number}
                                    </span>
                                )}
                            </div>
                            {card.category && (
                                <p className="text-xs text-gray-400 mt-1">{card.category}</p>
                            )}

                            {/* 現在価格（素体） */}
                            <div className="mt-3">
                                <p className="text-2xl sm:text-3xl font-black text-gray-900 tabular-nums">
                                    {formatPrice(card.loose_price_jpy)}
                                </p>
                                {card.loose_price_usd > 0 && (
                                    <p className="text-xs text-gray-400 tabular-nums">
                                        {formatUsd(card.loose_price_usd)}
                                    </p>
                                )}
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

                    {/* 価格サマリーカード (Bento UI風) */}
                    <div className="grid grid-cols-2 gap-2.5 mt-5">
                        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl px-4 py-3 border border-green-100">
                            <p className="text-xs text-green-500 font-medium">PSA10 海外相場</p>
                            <p className="text-lg font-black text-green-600 mt-1 tabular-nums">
                                {card.graded_price_jpy ? formatPrice(card.graded_price_jpy) : '-'}
                            </p>
                            {card.graded_price_usd && card.graded_price_usd > 0 && (
                                <p className="text-xs text-green-400 tabular-nums">{formatUsd(card.graded_price_usd)}</p>
                            )}
                        </div>
                        <div className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-2xl px-4 py-3 border border-gray-100">
                            <p className="text-xs text-gray-400 font-medium">最高値 / 最安値</p>
                            <div className="mt-1">
                                <span className="text-sm font-bold text-red-500 tabular-nums">
                                    {card.high_price ? formatPrice(card.high_price) : '-'}
                                </span>
                                <span className="text-gray-300 mx-1">/</span>
                                <span className="text-sm font-bold text-blue-500 tabular-nums">
                                    {card.low_price ? formatPrice(card.low_price) : '-'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* 買取価格サマリー */}
                    {(card.purchase_loose_best || card.purchase_psa10_best) && (
                        <div className="grid grid-cols-2 gap-2.5 mt-2.5">
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl px-4 py-3 border border-blue-100">
                                <p className="text-xs text-blue-400 font-medium">買取最高値（素体）</p>
                                <p className="text-lg font-black text-blue-600 mt-1 tabular-nums">
                                    {card.purchase_loose_best ? formatPrice(card.purchase_loose_best) : '-'}
                                </p>
                            </div>
                            <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50 rounded-2xl px-4 py-3 border border-purple-100">
                                <p className="text-xs text-purple-400 font-medium">買取最高値（PSA10）</p>
                                <p className="text-lg font-black text-purple-600 mt-1 tabular-nums">
                                    {card.purchase_psa10_best ? formatPrice(card.purchase_psa10_best) : '-'}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="px-4 py-4">
                    {/* 価格チャート */}
                    <PriceGraph
                        data={priceData}
                        onPeriodChange={() => { }}
                    />

                    {/* 店舗別買取価格一覧 */}
                    {card.purchase_prices && card.purchase_prices.length > 0 && (
                        <div className="mt-6">
                            <h3 className="text-sm font-bold text-gray-700 mb-3">
                                店舗別 買取価格
                            </h3>
                            <PurchasePriceTable prices={card.purchase_prices} />
                        </div>
                    )}

                    {/* アフィリエイトリンク */}
                    <div className="mt-6">
                        <h3 className="text-sm font-bold text-gray-700 mb-3">
                            この商品を探す
                        </h3>
                        <AffiliateButtons links={affiliateLinks} />
                    </div>

                    {/* 広告バナー */}
                    <div className="mt-6 bg-gray-100 border border-dashed border-gray-300 rounded-xl h-20 flex items-center justify-center text-gray-400 text-sm">
                        広告バナー
                    </div>

                    {/* カード基本情報 */}
                    <div className="mt-6 bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
                        <h3 className="text-sm font-bold text-gray-700 mb-3">カード情報</h3>
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
