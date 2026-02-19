'use client'

import { useState, useEffect, useMemo } from 'react'
import { getInventory, checkoutItem } from '@/lib/pos/api'
import { formatPrice, getCondition } from '@/lib/pos/constants'
import { getErrorMessage } from '@/lib/pos/utils'
import CardThumbnail from '@/components/pos/CardThumbnail'
import type { PosInventory } from '@/lib/pos/types'

interface Props {
    folderId: string
    onClose: () => void
    onAdded: () => void
}

export default function CheckoutAddItemModal({ folderId, onClose, onAdded }: Props) {
    const [stage, setStage] = useState<'search' | 'quantity'>('search')
    const [inventory, setInventory] = useState<PosInventory[]>([])
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [selectedInv, setSelectedInv] = useState<PosInventory | null>(null)
    const [quantity, setQuantity] = useState(1)
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    useEffect(() => {
        document.body.style.overflow = 'hidden'
        return () => { document.body.style.overflow = '' }
    }, [])

    useEffect(() => {
        getInventory()
            .then(res => setInventory(res.data.filter((i: PosInventory) => i.quantity > 0)))
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    const filtered = useMemo(() =>
        inventory
            .map(inv => ({ ...inv, cond: getCondition(inv.condition) }))
            .filter(inv => !search || inv.catalog?.name?.toLowerCase().includes(search.toLowerCase())),
        [inventory, search]
    )

    const grouped = useMemo(() =>
        filtered.reduce((acc, inv) => {
            const name = inv.catalog?.name || '不明'
            if (!acc[name]) acc[name] = { items: [], catalog: inv.catalog }
            acc[name].items.push(inv)
            return acc
        }, {} as Record<string, { items: typeof filtered; catalog: any }>),
        [filtered]
    )

    const handleSelect = (inv: PosInventory) => {
        setSelectedInv(inv)
        setQuantity(1)
        setError('')
        setStage('quantity')
    }

    const handleSubmit = async () => {
        if (!selectedInv) return
        setSubmitting(true)
        setError('')
        try {
            await checkoutItem({ folder_id: folderId, inventory_id: selectedInv.id, quantity })
            onAdded()
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
                    <h3 className="text-base font-bold text-gray-900">
                        {stage === 'search' ? 'カードを追加' : '数量を入力'}
                    </h3>
                    <div className="flex items-center gap-2">
                        {stage === 'quantity' && (
                            <button onClick={() => { setStage('search'); setSelectedInv(null) }} className="text-sm text-blue-600 font-bold">← 戻る</button>
                        )}
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg p-1">✕</button>
                    </div>
                </div>

                <div className="overflow-y-auto flex-1">
                    {stage === 'search' && (
                        <div className="p-5">
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="商品名で検索..."
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400 mb-4"
                                autoFocus
                            />
                            {loading ? (
                                <p className="text-center py-8 text-sm text-gray-400">読込中...</p>
                            ) : Object.keys(grouped).length === 0 ? (
                                <p className="text-center py-8 text-sm text-gray-400">在庫がありません</p>
                            ) : (
                                <div className="space-y-4">
                                    {Object.entries(grouped).map(([name, { items, catalog }]) => (
                                        <div key={name}>
                                            <div className="flex items-center gap-2 mb-2">
                                                <CardThumbnail url={catalog?.image_url} name={name} size="sm" />
                                                <p className="text-sm font-bold text-gray-800 truncate">{name}</p>
                                            </div>
                                            <div className="grid grid-cols-2 gap-2">
                                                {items.map(inv => {
                                                    const c = getCondition(inv.condition)
                                                    return (
                                                        <button
                                                            key={inv.id}
                                                            onClick={() => handleSelect(inv)}
                                                            className="text-left px-3 py-2.5 rounded-lg border border-gray-200 hover:border-gray-400 transition-colors"
                                                        >
                                                            <span className="text-xs font-bold" style={{ color: c.color }}>{inv.condition}</span>
                                                            <span className="text-xs text-gray-400 ml-2">{inv.quantity}点</span>
                                                            <p className="text-xs text-gray-500 mt-0.5">原価 {formatPrice(inv.avg_purchase_price)}</p>
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {stage === 'quantity' && selectedInv && (
                        <div className="p-5 space-y-4">
                            <div className="bg-gray-50 rounded-lg px-4 py-3">
                                <p className="text-sm font-bold text-gray-800 truncate">{selectedInv.catalog?.name || '-'}</p>
                                <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                                    <span className="font-bold" style={{ color: getCondition(selectedInv.condition).color }}>{selectedInv.condition}</span>
                                    <span>在庫 {selectedInv.quantity}点</span>
                                    <span>原価 {formatPrice(selectedInv.avg_purchase_price)}/個</span>
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-bold text-gray-600 mb-2 block">数量</label>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                        className="w-12 h-12 rounded-xl border border-gray-200 text-lg font-bold text-gray-600 hover:bg-gray-50"
                                    >-</button>
                                    <input
                                        type="number"
                                        value={quantity}
                                        onChange={e => {
                                            const v = parseInt(e.target.value)
                                            if (!isNaN(v) && v >= 1 && v <= selectedInv.quantity) setQuantity(v)
                                        }}
                                        className="flex-1 text-center text-lg font-bold py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-gray-400"
                                    />
                                    <button
                                        onClick={() => setQuantity(Math.min(selectedInv.quantity, quantity + 1))}
                                        className="w-12 h-12 rounded-xl border border-gray-200 text-lg font-bold text-gray-600 hover:bg-gray-50"
                                    >+</button>
                                </div>
                            </div>

                            <div className="bg-amber-50 rounded-xl px-4 py-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm text-amber-600 font-bold">ロック額</span>
                                    <span className="text-xl font-bold text-amber-700">{formatPrice(selectedInv.avg_purchase_price * quantity)}</span>
                                </div>
                            </div>

                            {error && <p className="text-sm text-red-500 font-bold">{error}</p>}
                        </div>
                    )}
                </div>

                {stage === 'quantity' && (
                    <div className="px-5 pb-8 pt-3 border-t border-gray-100 flex-shrink-0 safe-area-pb">
                        <button
                            onClick={handleSubmit}
                            disabled={submitting}
                            className={`w-full py-4 rounded-xl text-base font-bold transition-colors ${submitting ? 'bg-gray-200 text-gray-400' : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'}`}
                        >
                            {submitting ? '追加中...' : `📦 持ち出す（${formatPrice(selectedInv!.avg_purchase_price * quantity)}）`}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
