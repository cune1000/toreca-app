'use client'

import { useState, useEffect } from 'react'
import { sellCheckoutItem } from '@/lib/pos/api'
import { formatPrice, getCondition } from '@/lib/pos/constants'
import { getErrorMessage } from '@/lib/pos/utils'
import type { PosCheckoutItem } from '@/lib/pos/types'

interface Props {
    item: PosCheckoutItem
    onClose: () => void
    onSold: () => void
}

export default function CheckoutSellModal({ item, onClose, onSold }: Props) {
    const [unitPrice, setUnitPrice] = useState('')
    const [saleExpenses, setSaleExpenses] = useState('')
    const [expenseMode, setExpenseMode] = useState<'per_unit' | 'total'>('total')
    const [sellQty, setSellQty] = useState(item.quantity)
    const [notes, setNotes] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = '' }
    }, [])

    const price = parseInt(unitPrice) || 0
    const rawExpense = parseInt(saleExpenses) || 0
    const expenses = expenseMode === 'per_unit' ? rawExpense * sellQty : rawExpense
    const perUnitExpense = expenseMode === 'per_unit' ? rawExpense : (sellQty > 0 ? Math.round(rawExpense / sellQty) : 0)
    const totalSale = price * sellQty
    const profit = (price - item.unit_cost) * sellQty - expenses

    const handleSell = async () => {
        if (!price) { setError('売却単価を入力してください'); return }
        setSubmitting(true)
        setError('')
        try {
            await sellCheckoutItem(item.id, {
                unit_price: price,
                sale_expenses: expenses || undefined,
                notes: notes.trim() || undefined,
                resolve_quantity: sellQty < item.quantity ? sellQty : undefined,
            })
            onSold()
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
                className="bg-white w-full md:max-w-lg md:rounded-xl rounded-t-2xl max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                    <h3 className="text-base font-bold text-gray-900">売却</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg p-1">✕</button>
                </div>

                <div className="p-5 space-y-4 overflow-y-auto flex-1">
                    <div className="bg-green-50 rounded-lg px-4 py-3">
                        <p className="text-sm font-bold text-gray-800 truncate">{item.inventory?.catalog?.name || '-'}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                            <span className="font-bold" style={{ color: cond.color }}>{item.inventory?.condition}</span>
                            <span>{item.quantity}点</span>
                            <span>原価 {formatPrice(item.unit_cost)}/個</span>
                        </div>
                    </div>

                    {item.quantity > 1 && (
                        <div>
                            <label className="text-sm font-bold text-gray-600 mb-2 block">売却数量</label>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setSellQty(Math.max(1, sellQty - 1))}
                                    className="w-10 h-10 rounded-xl border border-gray-200 text-lg font-bold text-gray-600 hover:bg-gray-50"
                                >-</button>
                                <input
                                    type="number"
                                    value={sellQty}
                                    onChange={e => {
                                        const v = parseInt(e.target.value)
                                        if (!isNaN(v) && v >= 1 && v <= item.quantity) setSellQty(v)
                                    }}
                                    className="flex-1 text-center text-lg font-bold py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400"
                                />
                                <button
                                    onClick={() => setSellQty(Math.min(item.quantity, sellQty + 1))}
                                    className="w-10 h-10 rounded-xl border border-gray-200 text-lg font-bold text-gray-600 hover:bg-gray-50"
                                >+</button>
                            </div>
                            {sellQty < item.quantity && (
                                <p className="text-xs text-gray-400 mt-1">{item.quantity}点中 {sellQty}点を売却（残り{item.quantity - sellQty}点は保留のまま）</p>
                            )}
                        </div>
                    )}

                    <div>
                        <label className="text-sm font-bold text-gray-600 mb-2 block">売却単価</label>
                        <div className="relative">
                            <span className="absolute left-4 top-3.5 text-gray-400 text-sm">¥</span>
                            <input
                                type="number"
                                value={unitPrice}
                                onChange={e => setUnitPrice(e.target.value)}
                                className="w-full px-4 py-3 pl-9 border border-gray-200 rounded-xl text-lg font-bold text-right focus:outline-none focus:border-gray-400"
                                autoFocus
                            />
                        </div>
                    </div>

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-bold text-gray-600">手数料・送料</label>
                            <div className="flex bg-gray-100 rounded-lg p-0.5">
                                <button
                                    onClick={() => { setExpenseMode('per_unit'); setSaleExpenses('') }}
                                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${expenseMode === 'per_unit' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
                                >1点あたり</button>
                                <button
                                    onClick={() => { setExpenseMode('total'); setSaleExpenses('') }}
                                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${expenseMode === 'total' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
                                >合計</button>
                            </div>
                        </div>
                        <div className="relative">
                            <span className="absolute left-4 top-3.5 text-gray-400 text-sm">¥</span>
                            <input
                                type="number"
                                value={saleExpenses}
                                onChange={e => setSaleExpenses(e.target.value)}
                                placeholder="0"
                                className="w-full px-4 py-3 pl-9 border border-gray-200 rounded-xl text-lg font-bold text-right focus:outline-none focus:border-gray-400"
                            />
                        </div>
                        {rawExpense > 0 && sellQty > 1 && (
                            <p className="text-xs text-gray-500 mt-1">
                                {expenseMode === 'per_unit'
                                    ? `${sellQty}点 × ¥${rawExpense.toLocaleString()} = 合計 ¥${expenses.toLocaleString()}`
                                    : `合計 ¥${rawExpense.toLocaleString()} ÷ ${sellQty}点 = 1点あたり ¥${perUnitExpense.toLocaleString()}`
                                }
                            </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">販売手数料、送料、梱包資材費など</p>
                    </div>

                    <div>
                        <label className="text-sm font-bold text-gray-600 mb-2 block">メモ</label>
                        <input
                            type="text"
                            value={notes}
                            onChange={e => setNotes(e.target.value)}
                            placeholder="売却先など（任意）"
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400"
                        />
                    </div>

                    {/* 利益プレビュー */}
                    {price > 0 && (
                        <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1.5">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">売上</span>
                                <span className="font-bold">{formatPrice(totalSale)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-500">原価</span>
                                <span className="text-gray-600">-{formatPrice(item.unit_cost * sellQty)}</span>
                            </div>
                            {expenses > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-500">手数料</span>
                                    <span className="text-gray-600">-{formatPrice(expenses)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-sm pt-1.5 border-t border-gray-200">
                                <span className="font-bold text-gray-700">利益</span>
                                <span className={`text-lg font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                    {profit > 0 ? '+' : ''}{formatPrice(profit)}
                                </span>
                            </div>
                        </div>
                    )}

                    {error && <p className="text-sm text-red-500 font-bold">{error}</p>}
                </div>

                <div className="px-5 pb-8 pt-3 border-t border-gray-100 flex-shrink-0 safe-area-pb">
                    <button
                        onClick={handleSell}
                        disabled={!price || submitting}
                        className={`w-full py-4 rounded-xl text-base font-bold transition-colors ${!price || submitting ? 'bg-gray-200 text-gray-400' : 'bg-green-600 text-white hover:bg-green-700 active:scale-[0.98]'}`}
                    >
                        {submitting ? '処理中...' : '売却確定'}
                    </button>
                </div>
            </div>
        </div>
    )
}
