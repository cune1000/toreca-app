'use client'

import { useState, useEffect } from 'react'
import { returnCheckoutItem } from '@/lib/pos/api'
import { formatPrice, getCondition } from '@/lib/pos/constants'
import { getErrorMessage } from '@/lib/pos/utils'
import type { PosCheckoutItem } from '@/lib/pos/types'

interface Props {
    item: PosCheckoutItem
    onClose: () => void
    onReturned: () => void
}

export default function CheckoutReturnModal({ item, onClose, onReturned }: Props) {
    const [notes, setNotes] = useState('')
    const [returnQty, setReturnQty] = useState(item.quantity)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = '' }
    }, [])

    const handleReturn = async () => {
        setSubmitting(true)
        setError('')
        try {
            await returnCheckoutItem(item.id, {
                notes: notes.trim() || undefined,
                resolve_quantity: returnQty < item.quantity ? returnQty : undefined,
            })
            onReturned()
        } catch (err) {
            setError(getErrorMessage(err))
        } finally {
            setSubmitting(false)
        }
    }

    const cond = getCondition(item.inventory?.condition || '')

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end md:items-center justify-center" onClick={onClose}>
            <div
                className="bg-white w-full md:max-w-md md:rounded-xl rounded-t-2xl max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                    <h3 className="text-base font-bold text-gray-900">返却</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg p-1">✕</button>
                </div>

                <div className="p-5 space-y-4 overflow-y-auto flex-1">
                    <div className="bg-blue-50 rounded-lg px-4 py-3">
                        <p className="text-sm font-bold text-gray-800 truncate">{item.inventory?.catalog?.name || '-'}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                            <span className="font-bold" style={{ color: cond.color }}>{item.inventory?.condition}</span>
                            <span>{item.quantity}点</span>
                            <span>原価 {formatPrice(item.unit_cost * item.quantity)}</span>
                        </div>
                    </div>

                    {item.quantity > 1 ? (
                        <div>
                            <label className="text-sm font-bold text-gray-600 mb-2 block">返却数量</label>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setReturnQty(Math.max(1, returnQty - 1))}
                                    className="w-10 h-10 rounded-xl border border-gray-200 text-lg font-bold text-gray-600 hover:bg-gray-50"
                                >-</button>
                                <input
                                    type="number"
                                    value={returnQty}
                                    onChange={e => {
                                        const v = parseInt(e.target.value)
                                        if (!isNaN(v) && v >= 1 && v <= item.quantity) setReturnQty(v)
                                    }}
                                    className="flex-1 text-center text-lg font-bold py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400"
                                />
                                <button
                                    onClick={() => setReturnQty(Math.min(item.quantity, returnQty + 1))}
                                    className="w-10 h-10 rounded-xl border border-gray-200 text-lg font-bold text-gray-600 hover:bg-gray-50"
                                >+</button>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">{item.quantity}点中 {returnQty}点を返却{returnQty < item.quantity ? `（残り${item.quantity - returnQty}点は保留のまま）` : ''}</p>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-600">在庫に {item.quantity}点 を戻します。</p>
                    )}

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

                    {error && <p className="text-sm text-red-500 font-bold">{error}</p>}
                </div>

                <div className="px-5 pb-8 pt-3 border-t border-gray-100 flex-shrink-0 safe-area-pb">
                    <button
                        onClick={handleReturn}
                        disabled={submitting}
                        className={`w-full py-4 rounded-xl text-base font-bold transition-colors ${submitting ? 'bg-gray-200 text-gray-400' : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'}`}
                    >
                        {submitting ? '処理中...' : '返却する'}
                    </button>
                </div>
            </div>
        </div>
    )
}
