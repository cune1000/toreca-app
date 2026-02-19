'use client'

import { useState, useEffect } from 'react'
import PosLayout from '@/components/pos/PosLayout'
import TransactionEditModal from '@/components/pos/TransactionEditModal'
import TransactionDeleteDialog from '@/components/pos/TransactionDeleteDialog'
import { getTransactions } from '@/lib/pos/api'
import { formatPrice, getCondition } from '@/lib/pos/constants'
import type { PosTransaction } from '@/lib/pos/types'

export default function HistoryPage() {
    const [transactions, setTransactions] = useState<PosTransaction[]>([])
    const [typeFilter, setTypeFilter] = useState<'all' | 'purchase' | 'sale'>('all')
    const [loading, setLoading] = useState(true)
    const [editingTx, setEditingTx] = useState<PosTransaction | null>(null)
    const [deletingTx, setDeletingTx] = useState<PosTransaction | null>(null)

    const reload = () => {
        setLoading(true)
        getTransactions({ type: typeFilter === 'all' ? undefined : typeFilter })
            .then(r => setTransactions(r.data))
            .catch(console.error)
            .finally(() => setLoading(false))
    }

    useEffect(() => { reload() }, [typeFilter])

    const totalPurchase = transactions.filter(t => t.type === 'purchase').reduce((s, t) => s + t.total_price, 0)
    const totalSale = transactions.filter(t => t.type === 'sale').reduce((s, t) => s + t.total_price, 0)
    const totalProfit = transactions.filter(t => t.type === 'sale').reduce((s, t) => s + (t.profit || 0), 0)
    const totalExpenses = transactions.filter(t => t.type === 'purchase').reduce((s, t) => s + (t.expenses || 0), 0)

    return (
        <PosLayout>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5 md:mb-6">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">取引履歴</h1>
                    <p className="text-sm text-gray-500 mt-1">{transactions.length}件の取引</p>
                </div>
                <div className="flex gap-1.5 bg-white border border-gray-200 rounded-lg p-1 self-start">
                    {[
                        { key: 'all' as const, label: 'すべて' },
                        { key: 'purchase' as const, label: '仕入れ' },
                        { key: 'sale' as const, label: '販売' },
                    ].map(f => (
                        <button
                            key={f.key}
                            onClick={() => { setLoading(true); setTypeFilter(f.key) }}
                            className={`px-3 md:px-4 py-2 rounded-md text-sm font-bold transition-colors ${typeFilter === f.key ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-700'}`}
                        >{f.label}</button>
                    ))}
                </div>
            </div>

            {/* サマリー */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 mb-5 md:mb-6">
                <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-5">
                    <p className="text-xs md:text-sm text-gray-400 mb-1">仕入れ総額</p>
                    <p className="text-lg md:text-2xl font-bold text-blue-600">{formatPrice(totalPurchase)}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-5">
                    <p className="text-xs md:text-sm text-gray-400 mb-1">仕入れ費用</p>
                    <p className="text-lg md:text-2xl font-bold text-orange-600">{formatPrice(totalExpenses)}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-5">
                    <p className="text-xs md:text-sm text-gray-400 mb-1">販売総額</p>
                    <p className="text-lg md:text-2xl font-bold text-green-600">{formatPrice(totalSale)}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-5">
                    <p className="text-xs md:text-sm text-gray-400 mb-1">累計利益</p>
                    <p className={`text-lg md:text-2xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {totalProfit > 0 ? '+' : ''}{formatPrice(totalProfit)}
                    </p>
                </div>
            </div>

            {loading ? (
                <div className="py-16 text-center">
                    <div className="inline-block w-8 h-8 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
                </div>
            ) : (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    {/* デスクトップ: テーブル */}
                    <table className="w-full hidden md:table">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/50">
                                <th className="text-left text-xs font-semibold text-gray-500 px-6 py-3.5">日時</th>
                                <th className="text-center text-xs font-semibold text-gray-500 px-4 py-3.5">種別</th>
                                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5">商品</th>
                                <th className="text-center text-xs font-semibold text-gray-500 px-4 py-3.5">状態</th>
                                <th className="text-center text-xs font-semibold text-gray-500 px-4 py-3.5">数量</th>
                                <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3.5">単価</th>
                                <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3.5">合計</th>
                                <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3.5">費用</th>
                                <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3.5">利益</th>
                                <th className="text-center text-xs font-semibold text-gray-500 px-4 py-3.5">操作</th>
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
                                            <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${tx.type === 'purchase' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>
                                                {tx.type === 'purchase' ? '仕入れ' : '販売'}
                                            </span>
                                        </td>
                                        <td className="px-4">
                                            <p className="text-sm text-gray-800 truncate max-w-[200px]">{tx.inventory?.catalog?.name || '-'}</p>
                                        </td>
                                        <td className="text-center px-4">
                                            <span className="text-xs px-2.5 py-1 rounded-full text-white font-bold" style={{ backgroundColor: cond?.color || '#6b7280' }}>
                                                {tx.inventory?.condition || '-'}
                                            </span>
                                        </td>
                                        <td className="text-center text-sm text-gray-700 px-4">{tx.quantity}</td>
                                        <td className="text-right text-sm text-gray-700 px-4">{formatPrice(tx.unit_price)}</td>
                                        <td className="text-right text-sm font-bold text-gray-900 px-4">{formatPrice(tx.total_price)}</td>
                                        <td className="text-right px-4">
                                            {tx.expenses > 0 ? (
                                                <span className="text-sm font-bold text-orange-600">{formatPrice(tx.expenses)}</span>
                                            ) : <span className="text-xs text-gray-300">-</span>}
                                        </td>
                                        <td className="text-right px-4">
                                            {tx.type === 'sale' && tx.profit != null ? (
                                                <span className={`text-sm font-bold ${tx.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                    {tx.profit > 0 ? '+' : ''}{formatPrice(tx.profit)}
                                                </span>
                                            ) : <span className="text-xs text-gray-300">-</span>}
                                        </td>
                                        <td className="text-center px-4">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => setEditingTx(tx)}
                                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="編集"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                </button>
                                                <button
                                                    onClick={() => setDeletingTx(tx)}
                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="削除"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            }) : (
                                <tr><td colSpan={10} className="text-center py-16 text-sm text-gray-400">取引がありません</td></tr>
                            )}
                        </tbody>
                    </table>

                    {/* モバイル: カードリスト */}
                    <div className="md:hidden divide-y divide-gray-50">
                        {transactions.length > 0 ? transactions.map(tx => {
                            const cond = getCondition(tx.inventory?.condition || '')
                            return (
                                <div key={tx.id} className="px-4 py-3.5">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${tx.type === 'purchase' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>
                                                {tx.type === 'purchase' ? '仕入れ' : '販売'}
                                            </span>
                                            <span className="text-xs px-1.5 py-0.5 rounded text-white font-bold" style={{ backgroundColor: cond?.color || '#6b7280' }}>
                                                {tx.inventory?.condition || '-'}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs text-gray-400">{new Date(tx.transaction_date).toLocaleDateString('ja-JP')}</span>
                                            <button
                                                onClick={() => setEditingTx(tx)}
                                                className="p-1 text-gray-400 hover:text-blue-600 rounded"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                            </button>
                                            <button
                                                onClick={() => setDeletingTx(tx)}
                                                className="p-1 text-gray-400 hover:text-red-600 rounded"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                    <p className="text-sm font-bold text-gray-800 truncate">{tx.inventory?.catalog?.name || '-'}</p>
                                    <div className="flex items-center justify-between mt-1.5">
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <span>{tx.quantity}個 × {formatPrice(tx.unit_price)}</span>
                                            {tx.expenses > 0 && <span className="text-orange-600">費用{formatPrice(tx.expenses)}</span>}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-gray-900">{formatPrice(tx.total_price)}</span>
                                            {tx.type === 'sale' && tx.profit != null && (
                                                <span className={`text-xs font-bold ${tx.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                    {tx.profit > 0 ? '+' : ''}{formatPrice(tx.profit)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    {tx.notes && <p className="text-xs text-gray-400 mt-1 truncate">{tx.notes}</p>}
                                </div>
                            )
                        }) : (
                            <p className="text-center py-16 text-sm text-gray-400">取引がありません</p>
                        )}
                    </div>
                </div>
            )}

            {/* 編集モーダル */}
            {editingTx && (
                <TransactionEditModal
                    transaction={editingTx}
                    onClose={() => setEditingTx(null)}
                    onSaved={() => { setEditingTx(null); reload() }}
                />
            )}

            {/* 削除ダイアログ */}
            {deletingTx && (
                <TransactionDeleteDialog
                    transaction={deletingTx}
                    onClose={() => setDeletingTx(null)}
                    onDeleted={() => { setDeletingTx(null); reload() }}
                />
            )}
        </PosLayout>
    )
}
