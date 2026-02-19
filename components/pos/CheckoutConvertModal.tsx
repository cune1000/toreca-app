'use client'

import { useState, useEffect } from 'react'
import { convertCheckoutItem } from '@/lib/pos/api'
import { formatPrice, getCondition, CONDITIONS } from '@/lib/pos/constants'
import { getErrorMessage } from '@/lib/pos/utils'
import type { PosCheckoutItem } from '@/lib/pos/types'

interface Props {
    item: PosCheckoutItem
    onClose: () => void
    onConverted: () => void
}

export default function CheckoutConvertModal({ item, onClose, onConverted }: Props) {
    const [newCondition, setNewCondition] = useState('')
    const [customCondition, setCustomCondition] = useState('')
    const [expenses, setExpenses] = useState('')
    const [expenseMode, setExpenseMode] = useState<'per_unit' | 'total'>('per_unit')
    const [convertQty, setConvertQty] = useState(item.quantity)
    const [notes, setNotes] = useState('')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = '' }
    }, [])

    const effectiveCondition = newCondition === '__custom__' ? customCondition.trim() : newCondition

    const handleConvert = async () => {
        if (!effectiveCondition) { setError('変換先の状態を選択してください'); return }
        setSubmitting(true)
        setError('')
        try {
            await convertCheckoutItem(item.id, {
                new_condition: effectiveCondition,
                expenses: totalExpenses || undefined,
                notes: notes.trim() || undefined,
                resolve_quantity: convertQty < item.quantity ? convertQty : undefined,
            })
            onConverted()
        } catch (err) {
            setError(getErrorMessage(err))
        } finally {
            setSubmitting(false)
        }
    }

    const cond = getCondition(item.inventory?.condition || '')
    const rawExpense = parseInt(expenses) || 0
    const totalExpenses = expenseMode === 'per_unit' ? rawExpense * convertQty : rawExpense
    const perUnitExpense = expenseMode === 'per_unit' ? rawExpense : (convertQty > 0 ? Math.round(rawExpense / convertQty) : 0)

    return (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-end md:items-center justify-center" onClick={onClose}>
            <div
                className="bg-white w-full md:max-w-lg md:rounded-xl rounded-t-2xl max-h-[90vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                    <h3 className="text-base font-bold text-gray-900">変換（状態変更）</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg p-1">✕</button>
                </div>

                <div className="p-5 space-y-4 overflow-y-auto flex-1">
                    <div className="bg-purple-50 rounded-lg px-4 py-3">
                        <p className="text-sm font-bold text-gray-800 truncate">{item.inventory?.catalog?.name || '-'}</p>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                            <span className="font-bold" style={{ color: cond.color }}>{item.inventory?.condition}</span>
                            <span>{item.quantity}点</span>
                            <span>原価 {formatPrice(item.unit_cost)}/個</span>
                        </div>
                    </div>

                    {item.quantity > 1 && (
                        <div>
                            <label className="text-sm font-bold text-gray-600 mb-2 block">変換数量</label>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setConvertQty(Math.max(1, convertQty - 1))}
                                    className="w-10 h-10 rounded-xl border border-gray-200 text-lg font-bold text-gray-600 hover:bg-gray-50"
                                >-</button>
                                <input
                                    type="number"
                                    value={convertQty}
                                    onChange={e => {
                                        const v = parseInt(e.target.value)
                                        if (!isNaN(v) && v >= 1 && v <= item.quantity) setConvertQty(v)
                                    }}
                                    className="flex-1 text-center text-lg font-bold py-2 border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400"
                                />
                                <button
                                    onClick={() => setConvertQty(Math.min(item.quantity, convertQty + 1))}
                                    className="w-10 h-10 rounded-xl border border-gray-200 text-lg font-bold text-gray-600 hover:bg-gray-50"
                                >+</button>
                            </div>
                            {convertQty < item.quantity && (
                                <p className="text-xs text-gray-400 mt-1">{item.quantity}点中 {convertQty}点を変換（残り{item.quantity - convertQty}点は保留のまま）</p>
                            )}
                        </div>
                    )}

                    <div>
                        <label className="text-sm font-bold text-gray-600 mb-2 block">変換先の状態</label>
                        <div className="grid grid-cols-4 gap-2">
                            {CONDITIONS.map(c => (
                                <button
                                    key={c.code}
                                    onClick={() => { setNewCondition(c.code); setError('') }}
                                    disabled={c.code === item.inventory?.condition}
                                    className={`py-2.5 rounded-lg text-sm font-bold transition-colors ${
                                        newCondition === c.code
                                            ? 'ring-2 ring-offset-1'
                                            : c.code === item.inventory?.condition
                                            ? 'opacity-30 cursor-not-allowed'
                                            : 'border border-gray-200 hover:border-gray-400'
                                    }`}
                                    style={newCondition === c.code ? { backgroundColor: `${c.color}20`, color: c.color, borderColor: c.color } : {}}
                                >{c.code}</button>
                            ))}
                        </div>
                        <button
                            onClick={() => setNewCondition('__custom__')}
                            className={`mt-2 w-full py-2.5 rounded-lg text-sm font-bold border border-dashed transition-colors ${newCondition === '__custom__' ? 'border-gray-600 bg-gray-50' : 'border-gray-300 text-gray-500 hover:border-gray-400'}`}
                        >その他</button>
                        {newCondition === '__custom__' && (
                            <input
                                type="text"
                                value={customCondition}
                                onChange={e => setCustomCondition(e.target.value)}
                                placeholder="状態を入力"
                                className="w-full mt-2 px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400"
                                autoFocus
                            />
                        )}
                    </div>

                    {effectiveCondition && (
                        <div className="bg-purple-50 rounded-xl px-4 py-3 flex items-center gap-2 text-sm">
                            <span className="font-bold" style={{ color: cond.color }}>{item.inventory?.condition}</span>
                            <span className="text-gray-400">→</span>
                            <span className="font-bold" style={{ color: getCondition(effectiveCondition).color }}>{effectiveCondition}</span>
                        </div>
                    )}

                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-sm font-bold text-gray-600">経費（鑑定費用など）</label>
                            <div className="flex bg-gray-100 rounded-lg p-0.5">
                                <button
                                    onClick={() => { setExpenseMode('per_unit'); setExpenses('') }}
                                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${expenseMode === 'per_unit' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
                                >1点あたり</button>
                                <button
                                    onClick={() => { setExpenseMode('total'); setExpenses('') }}
                                    className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors ${expenseMode === 'total' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
                                >合計</button>
                            </div>
                        </div>
                        <div className="relative">
                            <span className="absolute left-4 top-3.5 text-gray-400 text-sm">¥</span>
                            <input
                                type="number"
                                value={expenses}
                                onChange={e => setExpenses(e.target.value)}
                                placeholder="0"
                                className="w-full px-4 py-3 pl-9 border border-gray-200 rounded-xl text-lg font-bold text-right focus:outline-none focus:border-gray-400"
                            />
                        </div>
                        {rawExpense > 0 && convertQty > 1 && (
                            <p className="text-xs text-gray-500 mt-1">
                                {expenseMode === 'per_unit'
                                    ? `${convertQty}点 × ¥${rawExpense.toLocaleString()} = 合計 ¥${totalExpenses.toLocaleString()}`
                                    : `合計 ¥${rawExpense.toLocaleString()} ÷ ${convertQty}点 = 1点あたり ¥${perUnitExpense.toLocaleString()}`
                                }
                            </p>
                        )}
                        <p className="text-xs text-gray-400 mt-1">鑑定料・送料等。変換先の在庫経費に加算されます</p>
                    </div>

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

                    {/* プレビュー */}
                    {effectiveCondition && (
                        <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1.5 text-sm">
                            <p className="font-bold text-gray-700">変換後の在庫</p>
                            <div className="flex justify-between">
                                <span className="text-gray-500">商品</span>
                                <span>{item.inventory?.catalog?.name}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">状態</span>
                                <span className="font-bold" style={{ color: getCondition(effectiveCondition).color }}>{effectiveCondition}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500">原価（引き継ぎ）</span>
                                <span>{formatPrice(item.unit_cost)}/個</span>
                            </div>
                            {totalExpenses > 0 && (
                                <div className="flex justify-between">
                                    <span className="text-gray-500">経費加算</span>
                                    <span className="text-orange-600">+{formatPrice(totalExpenses)}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {error && <p className="text-sm text-red-500 font-bold">{error}</p>}
                </div>

                <div className="px-5 pb-8 pt-3 border-t border-gray-100 flex-shrink-0 safe-area-pb">
                    <button
                        onClick={handleConvert}
                        disabled={!effectiveCondition || submitting}
                        className={`w-full py-4 rounded-xl text-base font-bold transition-colors ${!effectiveCondition || submitting ? 'bg-gray-200 text-gray-400' : 'bg-purple-600 text-white hover:bg-purple-700 active:scale-[0.98]'}`}
                    >
                        {submitting ? '処理中...' : '変換確定'}
                    </button>
                </div>
            </div>
        </div>
    )
}
