'use client'

import { useState } from 'react'
import { deleteTransaction } from '@/lib/pos/api'
import { formatPrice } from '@/lib/pos/constants'
import type { PosTransaction } from '@/lib/pos/types'

interface Props {
    transaction: PosTransaction
    onClose: () => void
    onDeleted: () => void
}

export default function TransactionDeleteDialog({ transaction: tx, onClose, onDeleted }: Props) {
    const [reason, setReason] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    const handleDelete = async () => {
        if (!reason.trim()) { setError('削除理由を入力してください'); return }
        setSubmitting(true)
        setError('')
        try {
            await deleteTransaction(tx.id, reason)
            onDeleted()
        } catch (err: any) {
            setError(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center" onClick={onClose}>
            <div
                className="bg-white w-full md:max-w-md md:rounded-xl rounded-t-2xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-base font-bold text-red-600">取引を削除</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg p-1">✕</button>
                </div>

                <div className="p-5 space-y-4">
                    {/* 対象取引の情報 */}
                    <div className="bg-red-50 rounded-lg px-4 py-3">
                        <p className="text-sm font-bold text-gray-800 truncate">{tx.inventory?.catalog?.name || '-'}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                            <span className={`px-2 py-0.5 rounded-full font-bold ${tx.type === 'purchase' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>
                                {tx.type === 'purchase' ? '仕入れ' : '販売'}
                            </span>
                            <span>{tx.quantity}個 × {formatPrice(tx.unit_price)}</span>
                            <span className="font-bold text-gray-700">{formatPrice(tx.total_price)}</span>
                        </div>
                    </div>

                    {/* 警告 */}
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3">
                        <p className="text-sm text-yellow-800 font-bold">注意</p>
                        <p className="text-xs text-yellow-700 mt-1">この操作は取り消せません。在庫数量と平均仕入価格が再計算されます。</p>
                    </div>

                    {/* 削除理由（必須） */}
                    <div>
                        <label className="text-sm font-bold text-gray-600 mb-2 block">削除理由 <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            value={reason}
                            onChange={e => { setReason(e.target.value); setError('') }}
                            placeholder="例: 誤入力のため削除"
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400"
                        />
                    </div>

                    {error && <p className="text-sm text-red-500 font-bold">{error}</p>}

                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="flex-1 py-3.5 rounded-xl text-sm font-bold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                        >
                            キャンセル
                        </button>
                        <button
                            onClick={handleDelete}
                            disabled={submitting}
                            className={`flex-1 py-3.5 rounded-xl text-sm font-bold transition-colors ${submitting ? 'bg-gray-200 text-gray-400' : 'bg-red-600 text-white hover:bg-red-700 active:scale-[0.98]'}`}
                        >
                            {submitting ? '削除中...' : '削除する'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
