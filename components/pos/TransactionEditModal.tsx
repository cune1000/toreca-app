'use client'

import { useState, useEffect } from 'react'
import { updateTransaction } from '@/lib/pos/api'
import { formatPrice } from '@/lib/pos/constants'
import { getErrorMessage } from '@/lib/pos/utils'
import TransactionTypeBadge from '@/components/pos/TransactionTypeBadge'
import type { PosTransaction } from '@/lib/pos/types'

interface Props {
    transaction: PosTransaction
    onClose: () => void
    onSaved: () => void
}

export default function TransactionEditModal({ transaction: tx, onClose, onSaved }: Props) {
    const [quantity, setQuantity] = useState(String(tx.quantity))
    const [unitPrice, setUnitPrice] = useState(String(tx.unit_price))
    const [expenses, setExpenses] = useState(String(tx.expenses || 0))
    const [notes, setNotes] = useState(tx.notes || '')
    const [txDate, setTxDate] = useState(tx.transaction_date)
    const [reason, setReason] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = '' }
    }, [])

    const handleSave = async () => {
        if (!reason.trim()) { setError('修正理由を入力してください'); return }
        setSubmitting(true)
        setError('')
        try {
            await updateTransaction(tx.id, {
                quantity: Number.isNaN(parseInt(quantity, 10)) ? tx.quantity : parseInt(quantity, 10),
                unit_price: Number.isNaN(parseInt(unitPrice, 10)) ? tx.unit_price : parseInt(unitPrice, 10),
                expenses: tx.type === 'purchase' ? (Number.isNaN(parseInt(expenses, 10)) ? 0 : parseInt(expenses, 10)) : undefined,
                notes,
                transaction_date: txDate,
                reason,
            })
            onSaved()
        } catch (err) {
            setError(getErrorMessage(err))
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end md:items-center justify-center" onClick={onClose}>
            <div
                className="bg-white w-full md:max-w-lg md:rounded-xl rounded-t-2xl max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                    <h3 className="text-base font-bold text-gray-900">取引を編集</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg p-1">✕</button>
                </div>

                <div className="p-5 space-y-4 overflow-y-auto flex-1">
                    {/* 商品情報（読取専用） */}
                    <div className="bg-gray-50 rounded-lg px-4 py-3">
                        <p className="text-sm font-bold text-gray-800 truncate">{tx.inventory?.catalog?.name || '-'}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                            <TransactionTypeBadge type={tx.type} size="sm" />
                            <span>{tx.inventory?.condition}</span>
                        </div>
                    </div>

                    {/* 日付 */}
                    <div>
                        <label className="text-sm font-bold text-gray-600 mb-2 block">取引日</label>
                        <input
                            type="date"
                            value={txDate}
                            onChange={e => setTxDate(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400"
                        />
                    </div>

                    {/* 数量 */}
                    <div>
                        <label className="text-sm font-bold text-gray-600 mb-2 block">数量</label>
                        <input
                            type="number"
                            value={quantity}
                            onChange={e => setQuantity(e.target.value)}
                            min={1}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-lg font-bold text-right focus:outline-none focus:border-gray-400"
                        />
                    </div>

                    {/* 単価 */}
                    <div>
                        <label className="text-sm font-bold text-gray-600 mb-2 block">単価</label>
                        <div className="relative">
                            <span className="absolute left-4 top-3.5 text-gray-400 text-sm">¥</span>
                            <input
                                type="number"
                                value={unitPrice}
                                onChange={e => setUnitPrice(e.target.value)}
                                className="w-full px-4 py-3 pl-9 border border-gray-200 rounded-xl text-lg font-bold text-right focus:outline-none focus:border-gray-400"
                            />
                        </div>
                    </div>

                    {/* 費用（仕入れのみ） */}
                    {tx.type === 'purchase' && (
                        <div>
                            <label className="text-sm font-bold text-gray-600 mb-2 block">仕入れ費用</label>
                            <div className="relative">
                                <span className="absolute left-4 top-3.5 text-gray-400 text-sm">¥</span>
                                <input
                                    type="number"
                                    value={expenses}
                                    onChange={e => setExpenses(e.target.value)}
                                    className="w-full px-4 py-3 pl-9 border border-gray-200 rounded-xl text-lg font-bold text-right focus:outline-none focus:border-gray-400"
                                />
                            </div>
                        </div>
                    )}

                    {/* メモ */}
                    <div>
                        <label className="text-sm font-bold text-gray-600 mb-2 block">メモ</label>
                        <input
                            type="text"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="任意"
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400"
                        />
                    </div>

                    {/* 合計プレビュー */}
                    <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
                        <span className="text-sm text-gray-500 font-bold">合計金額</span>
                        <span className="text-xl font-bold text-gray-900">{formatPrice((parseInt(quantity) || 0) * (parseInt(unitPrice) || 0))}</span>
                    </div>

                    {/* 修正理由（必須） */}
                    <div>
                        <label className="text-sm font-bold text-gray-600 mb-2 block">修正理由 <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            value={reason}
                            onChange={e => { setReason(e.target.value); setError('') }}
                            placeholder="例: 入力ミスの修正"
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400"
                        />
                    </div>

                    {error && <p className="text-sm text-red-500 font-bold">{error}</p>}
                </div>

                <div className="px-5 pb-8 pt-3 border-t border-gray-100 flex-shrink-0 safe-area-pb">
                    <button
                        onClick={handleSave}
                        disabled={submitting}
                        className={`w-full py-4 rounded-xl text-base font-bold transition-colors ${submitting ? 'bg-gray-200 text-gray-400' : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'}`}
                    >
                        {submitting ? '保存中...' : '保存する'}
                    </button>
                </div>
            </div>
        </div>
    )
}
