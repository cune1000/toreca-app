'use client'

import { useState, useEffect } from 'react'
import PosLayout from '@/components/pos/PosLayout'
import { getTransactions } from '@/lib/pos/api'
import { formatPrice, getCondition } from '@/lib/pos/constants'
import type { PosTransaction } from '@/lib/pos/types'

export default function HistoryPage() {
    const [transactions, setTransactions] = useState<PosTransaction[]>([])
    const [typeFilter, setTypeFilter] = useState<'all' | 'purchase' | 'sale'>('all')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        getTransactions({ type: typeFilter === 'all' ? undefined : typeFilter })
            .then(r => setTransactions(r.data))
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [typeFilter])

    const totalPurchase = transactions.filter(t => t.type === 'purchase').reduce((s, t) => s + t.total_price, 0)
    const totalSale = transactions.filter(t => t.type === 'sale').reduce((s, t) => s + t.total_price, 0)
    const totalProfit = transactions.filter(t => t.type === 'sale').reduce((s, t) => s + (t.profit || 0), 0)

    return (
        <PosLayout>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">取引履歴</h1>
                    <p className="text-sm text-gray-500 mt-1">{transactions.length}件の取引</p>
                </div>
                <div className="flex gap-1.5 bg-white border border-gray-200 rounded-lg p-1">
                    {[
                        { key: 'all' as const, label: 'すべて' },
                        { key: 'purchase' as const, label: '仕入れ' },
                        { key: 'sale' as const, label: '販売' },
                    ].map(f => (
                        <button
                            key={f.key}
                            onClick={() => { setLoading(true); setTypeFilter(f.key) }}
                            className={`px-4 py-2 rounded-md text-sm font-bold transition-colors ${typeFilter === f.key ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-700'
                                }`}
                        >{f.label}</button>
                    ))}
                </div>
            </div>

            {/* サマリー */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <p className="text-sm text-gray-400 mb-1">仕入れ総額</p>
                    <p className="text-2xl font-bold text-blue-600">{formatPrice(totalPurchase)}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <p className="text-sm text-gray-400 mb-1">販売総額</p>
                    <p className="text-2xl font-bold text-green-600">{formatPrice(totalSale)}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-5">
                    <p className="text-sm text-gray-400 mb-1">累計利益</p>
                    <p className={`text-2xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {totalProfit > 0 ? '+' : ''}{formatPrice(totalProfit)}
                    </p>
                </div>
            </div>

            {/* テーブル */}
            {loading ? (
                <div className="py-16 text-center">
                    <div className="inline-block w-8 h-8 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
                </div>
            ) : (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/50">
                                <th className="text-left text-xs font-semibold text-gray-500 px-6 py-3.5">日時</th>
                                <th className="text-center text-xs font-semibold text-gray-500 px-4 py-3.5">種別</th>
                                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5">商品</th>
                                <th className="text-center text-xs font-semibold text-gray-500 px-4 py-3.5">状態</th>
                                <th className="text-center text-xs font-semibold text-gray-500 px-4 py-3.5">数量</th>
                                <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3.5">単価</th>
                                <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3.5">合計</th>
                                <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3.5">利益</th>
                                <th className="text-left text-xs font-semibold text-gray-500 px-6 py-3.5">メモ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {transactions.length > 0 ? transactions.map(tx => {
                                const cond = getCondition(tx.inventory?.condition || '')
                                return (
                                    <tr key={tx.id} className="hover:bg-gray-50/50">
                                        <td className="px-6 py-3.5 text-sm text-gray-500">
                                            {new Date(tx.transaction_date).toLocaleDateString('ja-JP')}
                                        </td>
                                        <td className="text-center px-4">
                                            <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${tx.type === 'purchase' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'
                                                }`}>
                                                {tx.type === 'purchase' ? '仕入れ' : '販売'}
                                            </span>
                                        </td>
                                        <td className="px-4">
                                            <p className="text-sm text-gray-800 truncate max-w-[200px]">
                                                {tx.inventory?.catalog?.name || '-'}
                                            </p>
                                        </td>
                                        <td className="text-center px-4">
                                            <span
                                                className="text-xs px-2.5 py-1 rounded-full text-white font-bold"
                                                style={{ backgroundColor: cond?.color || '#6b7280' }}
                                            >
                                                {tx.inventory?.condition || '-'}
                                            </span>
                                        </td>
                                        <td className="text-center text-sm text-gray-700 px-4">{tx.quantity}</td>
                                        <td className="text-right text-sm text-gray-700 px-4">{formatPrice(tx.unit_price)}</td>
                                        <td className="text-right text-sm font-bold text-gray-900 px-4">{formatPrice(tx.total_price)}</td>
                                        <td className="text-right px-4">
                                            {tx.type === 'sale' && tx.profit != null ? (
                                                <span className={`text-sm font-bold ${tx.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                    {tx.profit > 0 ? '+' : ''}{formatPrice(tx.profit)}
                                                </span>
                                            ) : <span className="text-xs text-gray-300">-</span>}
                                        </td>
                                        <td className="px-6 text-sm text-gray-400 truncate max-w-[150px]">{tx.notes || '-'}</td>
                                    </tr>
                                )
                            }) : (
                                <tr><td colSpan={9} className="text-center py-16 text-sm text-gray-400">取引がありません</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </PosLayout>
    )
}
