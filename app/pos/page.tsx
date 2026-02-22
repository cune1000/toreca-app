'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PosLayout from '@/components/pos/PosLayout'
import PosSpinner from '@/components/pos/PosSpinner'
import TransactionTypeBadge from '@/components/pos/TransactionTypeBadge'
import { getStats, getTransactions, refreshMarketPrices, getCheckoutStats } from '@/lib/pos/api'
import { formatPrice } from '@/lib/pos/constants'
import type { PosStats, PosTransaction, PosCheckoutStats } from '@/lib/pos/types'

export default function PosDashboard() {
    const router = useRouter()
    const [stats, setStats] = useState<PosStats | null>(null)
    const [recent, setRecent] = useState<PosTransaction[]>([])
    const [checkoutStats, setCheckoutStats] = useState<PosCheckoutStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [refreshing, setRefreshing] = useState(false)

    const loadData = () => {
        Promise.all([
            getStats().then(r => setStats(r.data)),
            getTransactions({ limit: 10 }).then(r => setRecent(r.data)),
            getCheckoutStats().then(r => setCheckoutStats(r.data)).catch(err => {
                // チェックアウト統計が取得できなくてもダッシュボードは表示する
                console.error('checkout stats:', err)
            }),
        ]).catch(console.error).finally(() => setLoading(false))
    }

    useEffect(() => { loadData() }, [])

    const handleRefresh = async () => {
        setRefreshing(true)
        try {
            await refreshMarketPrices()
            loadData()
        } catch (err) { console.error(err) }
        finally { setRefreshing(false) }
    }

    return (
        <PosLayout>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 md:mb-8">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">ダッシュボード</h1>
                    <p className="text-sm text-gray-500 mt-1">POS在庫管理の概要</p>
                </div>
                <div className="flex gap-2 sm:gap-3">
                    <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="px-3 sm:px-4 py-3 bg-purple-50 text-purple-700 rounded-lg text-sm font-bold hover:bg-purple-100 transition-colors disabled:opacity-50"
                    >{refreshing ? '更新中...' : '📈 相場更新'}</button>
                    <button
                        onClick={() => router.push('/pos/sale')}
                        className="flex-1 sm:flex-none px-4 sm:px-6 py-3 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition-colors"
                    >🛒 販売</button>
                </div>
            </div>

            {loading ? (
                <PosSpinner />
            ) : (
                <>
                    {/* 統計カード */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4 mb-3 md:mb-4">
                        <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6">
                            <p className="text-sm text-gray-400 mb-1">総在庫数</p>
                            <p className="text-2xl md:text-3xl font-bold text-gray-900">{stats?.totalItems ?? 0}<span className="text-base text-gray-400 ml-1">点</span></p>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6">
                            <p className="text-sm text-gray-400 mb-1">仕入れ累計</p>
                            <p className="text-xl md:text-2xl font-bold text-blue-600">{formatPrice(stats?.totalPurchaseAmount ?? 0)}</p>
                            {(stats?.totalExpenses ?? 0) > 0 && (
                                <p className="text-xs text-gray-400 mt-1">経費 {formatPrice(stats?.totalExpenses ?? 0)}</p>
                            )}
                        </div>
                        <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6">
                            <p className="text-sm text-gray-400 mb-1">予測販売総額</p>
                            <p className="text-xl md:text-2xl font-bold text-gray-900">{formatPrice(stats?.predictedSaleTotal ?? 0)}</p>
                        </div>
                        <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6">
                            <p className="text-sm text-gray-400 mb-1">予測利益</p>
                            <p className={`text-xl md:text-2xl font-bold ${(stats?.predictedProfit ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                {formatPrice(stats?.predictedProfit ?? 0)}
                            </p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
                        <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6">
                            <p className="text-sm text-gray-400 mb-1">本日の仕入れ</p>
                            <p className="text-xl md:text-2xl font-bold text-blue-600">{formatPrice(stats?.todayPurchase ?? 0)}</p>
                            {(stats?.todayExpenses ?? 0) > 0 && (
                                <p className="text-xs text-gray-400 mt-1">経費 +{formatPrice(stats?.todayExpenses ?? 0)}</p>
                            )}
                        </div>
                        {checkoutStats && checkoutStats.pendingItems > 0 ? (
                            <button
                                onClick={() => router.push('/pos/checkout')}
                                className="bg-amber-50 border border-amber-200 rounded-xl p-4 md:p-6 text-left hover:border-amber-300 transition-colors"
                            >
                                <p className="text-sm text-amber-600 mb-1">持ち出し中</p>
                                <p className="text-xl md:text-2xl font-bold text-amber-700">{formatPrice(checkoutStats.lockedAmount)}</p>
                                <p className="text-xs text-amber-500 mt-1">{checkoutStats.pendingItems}点 保留中</p>
                            </button>
                        ) : (
                            <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6">
                                <p className="text-sm text-gray-400 mb-1">持ち出し中</p>
                                <p className="text-xl md:text-2xl font-bold text-gray-300">-</p>
                            </div>
                        )}
                        <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6">
                            <p className="text-sm text-gray-400 mb-1">本日の販売</p>
                            <p className="text-xl md:text-2xl font-bold text-green-600">{formatPrice(stats?.todaySale ?? 0)}</p>
                            {(stats?.todayProfit ?? 0) !== 0 && (
                                <p className={`text-xs mt-1 ${(stats?.todayProfit ?? 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    利益 {(stats?.todayProfit ?? 0) > 0 ? '+' : ''}{formatPrice(stats?.todayProfit ?? 0)}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* 最近の取引 */}
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <div className="px-4 md:px-6 py-3 md:py-4 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="text-sm font-bold text-gray-700">最近の取引</h2>
                            <button
                                onClick={() => router.push('/pos/history')}
                                className="text-sm text-gray-400 hover:text-gray-600 font-medium"
                            >すべて表示 →</button>
                        </div>

                        {/* デスクトップ: テーブル */}
                        <table className="w-full hidden md:table">
                            <thead>
                                <tr className="border-b border-gray-50 bg-gray-50/30">
                                    <th className="text-left text-xs font-semibold text-gray-400 px-6 py-3">日時</th>
                                    <th className="text-center text-xs font-semibold text-gray-400 px-4 py-3">種別</th>
                                    <th className="text-left text-xs font-semibold text-gray-400 px-4 py-3">商品</th>
                                    <th className="text-center text-xs font-semibold text-gray-400 px-4 py-3">数量</th>
                                    <th className="text-right text-xs font-semibold text-gray-400 px-4 py-3">合計</th>
                                    <th className="text-right text-xs font-semibold text-gray-400 px-4 py-3">費用</th>
                                    <th className="text-right text-xs font-semibold text-gray-400 px-6 py-3">利益</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {recent.length > 0 ? recent.map(tx => (
                                    <tr key={tx.id} className="hover:bg-gray-50/50">
                                        <td className="px-6 py-3.5 text-sm text-gray-500">
                                            {new Date(tx.transaction_date).toLocaleDateString('ja-JP')}
                                        </td>
                                        <td className="text-center px-4">
                                            <TransactionTypeBadge type={tx.type} />
                                        </td>
                                        <td className="px-4">
                                            <p className="text-sm text-gray-800 truncate max-w-[250px]">
                                                {tx.inventory?.catalog?.name || '-'}
                                            </p>
                                        </td>
                                        <td className="text-center text-sm text-gray-600 px-4">{tx.quantity}</td>
                                        <td className="text-right text-sm font-bold text-gray-900 px-4">{formatPrice(tx.total_price)}</td>
                                        <td className="text-right px-4">
                                            {tx.expenses > 0 ? (
                                                <span className="text-sm font-bold text-orange-600">{formatPrice(tx.expenses)}</span>
                                            ) : <span className="text-xs text-gray-300">-</span>}
                                        </td>
                                        <td className="text-right px-6">
                                            {tx.type === 'sale' && tx.profit != null ? (
                                                <span className={`text-sm font-bold ${tx.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                    {tx.profit > 0 ? '+' : ''}{formatPrice(tx.profit)}
                                                </span>
                                            ) : <span className="text-xs text-gray-300">-</span>}
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={7} className="text-center py-12 text-sm text-gray-400">取引がありません</td></tr>
                                )}
                            </tbody>
                        </table>

                        {/* モバイル: カードリスト */}
                        <div className="md:hidden divide-y divide-gray-50">
                            {recent.length > 0 ? recent.map(tx => (
                                <div key={tx.id} className="px-4 py-3">
                                    <div className="flex items-center justify-between mb-1">
                                        <TransactionTypeBadge type={tx.type} size="sm" />
                                        <span className="text-xs text-gray-400">{new Date(tx.transaction_date).toLocaleDateString('ja-JP')}</span>
                                    </div>
                                    <p className="text-sm font-bold text-gray-800 truncate">{tx.inventory?.catalog?.name || '-'}</p>
                                    <div className="flex items-center justify-between mt-1">
                                        <span className="text-xs text-gray-500">{tx.quantity}個</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-gray-900">{formatPrice(tx.total_price)}</span>
                                            {tx.type === 'sale' && tx.profit != null && (
                                                <span className={`text-xs font-bold ${tx.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                    {tx.profit > 0 ? '+' : ''}{formatPrice(tx.profit)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <p className="text-center py-12 text-sm text-gray-400">取引がありません</p>
                            )}
                        </div>
                    </div>
                </>
            )}
        </PosLayout>
    )
}
