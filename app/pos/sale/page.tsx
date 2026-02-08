'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import PosLayout from '@/components/pos/PosLayout'
import { getInventory, registerSale } from '@/lib/pos/api'
import { formatPrice, getCondition } from '@/lib/pos/constants'
import { calculateProfit } from '@/lib/pos/calculations'
import type { PosInventory } from '@/lib/pos/types'

export default function SalePageWrapper() {
    return <Suspense fallback={<PosLayout><div className="py-12 text-center"><div className="inline-block w-8 h-8 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" /></div></PosLayout>}><SalePage /></Suspense>
}

function SalePage() {
    const searchParams = useSearchParams()
    const catalogIdParam = searchParams.get('catalog_id')

    const [inventory, setInventory] = useState<PosInventory[]>([])
    const [search, setSearch] = useState('')
    const [selectedInv, setSelectedInv] = useState<(PosInventory & { cond?: any }) | null>(null)
    const [quantity, setQuantity] = useState(1)
    const [unitPrice, setUnitPrice] = useState('')
    const [notes, setNotes] = useState('')
    const [showResult, setShowResult] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [loading, setLoading] = useState(true)

    const loadInventory = () => {
        setLoading(true)
        getInventory()
            .then(res => {
                const inStock = res.data.filter((i: PosInventory) => i.quantity > 0)
                setInventory(inStock)

                // catalog_id パラメータが指定されている場合、該当する在庫を自動選択
                if (catalogIdParam && inStock.length > 0) {
                    const match = inStock.find((i: PosInventory) => i.catalog_id === catalogIdParam)
                    if (match) {
                        const cond = getCondition(match.condition)
                        setSelectedInv({ ...match, cond })
                        setUnitPrice(String(match.catalog?.fixed_price || ''))
                    }
                }
            })
            .catch(console.error)
            .finally(() => setLoading(false))
    }

    useEffect(() => { loadInventory() }, [])

    const filtered = inventory
        .map(inv => ({ ...inv, cond: getCondition(inv.condition) }))
        .filter(inv => !search || inv.catalog?.name?.toLowerCase().includes(search.toLowerCase()))

    const total = quantity * (parseInt(unitPrice) || 0)
    const profit = selectedInv
        ? calculateProfit(parseInt(unitPrice) || 0, selectedInv.avg_purchase_price, quantity)
        : null

    const handleSubmit = async () => {
        if (!selectedInv || !unitPrice || total === 0) return
        setSubmitting(true)
        try {
            await registerSale({
                inventory_id: selectedInv.id,
                quantity,
                unit_price: parseInt(unitPrice),
                notes: notes || undefined,
            })
            setShowResult(true)
            setTimeout(() => setShowResult(false), 3000)
            setSelectedInv(null)
            setUnitPrice('')
            setQuantity(1)
            setNotes('')
            setSearch('')
            loadInventory()
        } catch (err: any) {
            alert(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <PosLayout>
            <h2 className="text-lg font-bold text-gray-800 mb-4">🛒 販売登録</h2>

            {showResult && (
                <div className="mb-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2">
                    <span className="text-green-600 text-lg">✅</span>
                    <p className="text-sm text-green-700 font-medium">販売を登録しました！</p>
                </div>
            )}

            {loading ? (
                <div className="py-12 text-center">
                    <div className="inline-block w-8 h-8 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
                </div>
            ) : !selectedInv ? (
                <div>
                    <div className="relative mb-3">
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="在庫から検索..."
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400 pl-9"
                        />
                        <span className="absolute left-3 top-3.5 text-gray-400 text-sm">🔍</span>
                    </div>

                    <div className="space-y-1.5">
                        {filtered.map(inv => (
                            <button
                                key={inv.id}
                                onClick={() => {
                                    setSelectedInv(inv)
                                    setUnitPrice(String(inv.catalog?.fixed_price || ''))
                                }}
                                className="w-full bg-white border border-gray-100 rounded-lg px-3 py-2.5 flex items-center gap-3 hover:bg-gray-50 text-left"
                            >
                                {inv.catalog?.image_url ? (
                                    <img src={inv.catalog.image_url} alt="" className="w-10 h-14 object-cover rounded" />
                                ) : (
                                    <div className="w-10 h-14 bg-gray-100 rounded flex items-center justify-center text-lg">🎴</div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-800 truncate">{inv.catalog?.name || '-'}</p>
                                    <div className="flex items-center gap-1.5">
                                        <span
                                            className="text-[10px] px-1.5 py-0.5 rounded-full text-white"
                                            style={{ backgroundColor: inv.cond?.color || '#6b7280' }}
                                        >
                                            {inv.cond?.name || inv.condition}
                                        </span>
                                        <span className="text-[10px] text-gray-400">在庫 {inv.quantity}点</span>
                                        <span className="text-[10px] text-gray-400">仕入 {formatPrice(inv.avg_purchase_price)}</span>
                                    </div>
                                </div>
                                <span className="text-sm font-bold text-gray-700">
                                    {formatPrice(inv.catalog?.fixed_price)}
                                </span>
                            </button>
                        ))}
                        {filtered.length === 0 && (
                            <p className="text-sm text-gray-400 text-center py-8">在庫がありません</p>
                        )}
                    </div>
                </div>
            ) : (
                <div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
                        <div className="flex items-center gap-3">
                            {selectedInv.catalog?.image_url ? (
                                <img src={selectedInv.catalog.image_url} alt="" className="w-14 h-20 object-cover rounded" />
                            ) : (
                                <div className="w-14 h-20 bg-gray-100 rounded flex items-center justify-center text-2xl">🎴</div>
                            )}
                            <div className="flex-1">
                                <p className="text-base font-bold text-gray-800">{selectedInv.catalog?.name || '-'}</p>
                                <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                                    <span
                                        className="px-1.5 py-0.5 rounded-full text-white text-[10px]"
                                        style={{ backgroundColor: selectedInv.cond?.color || '#6b7280' }}
                                    >
                                        {selectedInv.cond?.name || selectedInv.condition}
                                    </span>
                                    <span>在庫 {selectedInv.quantity}点</span>
                                    <span>仕入 {formatPrice(selectedInv.avg_purchase_price)}</span>
                                </div>
                            </div>
                            <button onClick={() => setSelectedInv(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {/* 数量 */}
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-2 block">数量（最大 {selectedInv.quantity}点）</label>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                    className="w-10 h-10 bg-gray-100 rounded-lg text-lg font-bold text-gray-600 hover:bg-gray-200"
                                >-</button>
                                <input
                                    type="number"
                                    value={quantity}
                                    onChange={e => setQuantity(Math.max(1, Math.min(selectedInv.quantity, parseInt(e.target.value) || 1)))}
                                    className="w-16 text-center text-2xl font-bold text-gray-900 border border-gray-200 rounded-lg py-1 focus:outline-none focus:border-gray-400"
                                    min={1}
                                    max={selectedInv.quantity}
                                />
                                <button
                                    onClick={() => setQuantity(Math.min(selectedInv.quantity, quantity + 1))}
                                    className="w-10 h-10 bg-gray-100 rounded-lg text-lg font-bold text-gray-600 hover:bg-gray-200"
                                >+</button>
                            </div>
                        </div>

                        {/* 販売単価 */}
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-2 block">販売単価</label>
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-gray-400 text-sm">¥</span>
                                <input
                                    type="number"
                                    value={unitPrice}
                                    onChange={e => setUnitPrice(e.target.value)}
                                    className="w-full px-4 py-3 pl-8 border border-gray-200 rounded-xl text-lg font-bold text-right focus:outline-none focus:border-gray-400"
                                />
                            </div>
                        </div>

                        {/* メモ */}
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-2 block">メモ（任意）</label>
                            <input
                                type="text"
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="販売先など"
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400"
                            />
                        </div>

                        {/* 合計 + 利益 */}
                        <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500">合計金額</span>
                                <span className="text-xl font-bold text-gray-900">{formatPrice(total)}</span>
                            </div>
                            {profit && (
                                <>
                                    <div className="flex items-center justify-between border-t border-gray-200 pt-2">
                                        <span className="text-sm text-gray-500">利益</span>
                                        <span className={`text-lg font-bold ${profit.total >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                            {profit.total >= 0 ? '+' : ''}{formatPrice(profit.total)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-gray-400">利益率</span>
                                        <span className={`text-sm font-bold ${profit.rate >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                            {profit.rate > 0 ? '+' : ''}{profit.rate}%
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* 登録ボタン */}
                        <button
                            onClick={handleSubmit}
                            disabled={!unitPrice || total === 0 || quantity > selectedInv.quantity || submitting}
                            className={`w-full py-3.5 rounded-xl text-sm font-bold transition-colors ${unitPrice && total > 0 && quantity <= selectedInv.quantity && !submitting
                                ? 'bg-green-600 text-white hover:bg-green-700 active:scale-[0.98]'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                }`}
                        >
                            {submitting ? '登録中...' : `🛒 販売登録（利益 ${profit ? formatPrice(profit.total) : '¥0'}）`}
                        </button>
                    </div>
                </div>
            )}
        </PosLayout>
    )
}
