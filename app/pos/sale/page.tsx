'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import PosLayout from '@/components/pos/PosLayout'
import PosSpinner from '@/components/pos/PosSpinner'
import CardThumbnail from '@/components/pos/CardThumbnail'
import { getInventory, registerSale, getLots } from '@/lib/pos/api'
import { formatPrice, getCondition, getSourceType, getTrustLevel } from '@/lib/pos/constants'
import { getErrorMessage } from '@/lib/pos/utils'
import { calculateProfit } from '@/lib/pos/calculations'
import type { PosInventory, PosLot } from '@/lib/pos/types'

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
    const [selectedLot, setSelectedLot] = useState<PosLot | null>(null)
    const [availableLots, setAvailableLots] = useState<PosLot[]>([])
    const [showResult, setShowResult] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [loading, setLoading] = useState(true)

    const loadInventory = () => {
        setLoading(true)
        const params = catalogIdParam ? { catalog_id: catalogIdParam } : undefined
        getInventory(params)
            .then(res => {
                const inStock = res.data.filter((i: PosInventory) => i.quantity > 0)
                setInventory(inStock)
            })
            .catch(console.error)
            .finally(() => setLoading(false))
    }

    useEffect(() => { loadInventory() }, [])

    const filtered = useMemo(() => inventory
        .map(inv => ({ ...inv, cond: getCondition(inv.condition) }))
        .filter(inv => !search || inv.catalog?.name?.toLowerCase().includes(search.toLowerCase())),
        [inventory, search])

    // カタログIDでグループ化
    const grouped = filtered.reduce((acc, inv) => {
        const key = inv.catalog_id || inv.id
        if (!acc[key]) acc[key] = { items: [], catalog: inv.catalog }
        acc[key].items.push(inv)
        return acc
    }, {} as Record<string, { items: typeof filtered; catalog: any }>)

    const isLotMode = selectedInv?.catalog?.tracking_mode === 'lot'

    // LOTモード時: 在庫選択後にロットを読み込む
    useEffect(() => {
        if (selectedInv && isLotMode) {
            getLots({ inventory_id: selectedInv.id, has_remaining: true })
                .then(res => setAvailableLots(res.data))
                .catch(console.error)
        } else {
            setAvailableLots([])
            setSelectedLot(null)
        }
    }, [selectedInv?.id, isLotMode])

    const total = quantity * (parseInt(unitPrice) || 0)
    const profit = selectedInv
        ? selectedLot
            ? calculateProfit(parseInt(unitPrice) || 0, selectedLot.unit_cost, quantity, selectedLot.unit_expense || 0)
            : calculateProfit(parseInt(unitPrice) || 0, selectedInv.avg_purchase_price, quantity, selectedInv.avg_expense_per_unit || 0)
        : null

    const maxQuantity = selectedLot ? selectedLot.remaining_qty : (selectedInv?.quantity || 0)

    const handleSubmit = async () => {
        if (!selectedInv || unitPrice === '') return
        if (isLotMode && !selectedLot) {
            alert('LOTモードではロットを選択してください')
            return
        }
        setSubmitting(true)
        try {
            await registerSale({
                inventory_id: selectedInv.id,
                quantity,
                unit_price: parseInt(unitPrice) || 0,
                notes: notes || undefined,
                lot_id: selectedLot?.id,
            })
            setShowResult(true)
            setUnitPrice('')
            setQuantity(1)
            setNotes('')
            setSelectedLot(null)
            setAvailableLots([])
            loadInventory()
            setTimeout(() => {
                setShowResult(false)
                setSelectedInv(null)
                setSearch('')
            }, 2000)
        } catch (err) {
            alert(getErrorMessage(err))
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <PosLayout>
            <h2 className="text-xl font-bold text-gray-800 mb-5">🛒 販売登録</h2>

            {showResult && (
                <div className="mb-5 bg-green-50 border border-green-200 rounded-xl px-5 py-4 flex items-center gap-2">
                    <span className="text-green-600 text-lg">✅</span>
                    <p className="text-sm text-green-700 font-bold">販売を登録しました！</p>
                </div>
            )}

            {loading ? (
                <PosSpinner />
            ) : !selectedInv ? (
                <div>
                    <div className="relative mb-4">
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="在庫から検索..."
                            className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400 pl-10"
                        />
                        <span className="absolute left-3.5 top-4 text-gray-400 text-sm">🔍</span>
                    </div>

                    <div className="space-y-3">
                        {Object.entries(grouped).map(([name, { items, catalog }]) => (
                            <div key={name} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                                {/* 商品ヘッダー */}
                                <div className="px-4 py-3 flex items-center gap-3 border-b border-gray-50">
                                    <CardThumbnail url={catalog?.image_url} size="sm" name={catalog?.name} />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-gray-800 truncate">{name}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span className="text-xs text-gray-400">{catalog?.category || '-'}</span>
                                            {catalog?.fixed_price && (
                                                <span className="text-xs text-blue-500 font-bold">販売 {formatPrice(catalog.fixed_price)}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {/* 状態ごとの選択ボタン */}
                                <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {items.map(inv => (
                                        <button
                                            key={inv.id}
                                            onClick={() => {
                                                setSelectedInv(inv)
                                                setUnitPrice(String(inv.catalog?.fixed_price || ''))
                                            }}
                                            className="bg-gray-50 hover:bg-gray-100 border border-gray-100 rounded-lg px-3 py-3 transition-colors text-left"
                                        >
                                            <div className="flex items-center gap-2 mb-1.5">
                                                <span
                                                    className="text-xs px-2 py-0.5 rounded text-white font-bold"
                                                    style={{ backgroundColor: inv.cond?.color || '#6b7280' }}
                                                >
                                                    {inv.condition}
                                                </span>
                                                <span className="text-base font-bold text-gray-900">× {inv.quantity}</span>
                                            </div>
                                            <p className="text-xs text-gray-400">仕入 {formatPrice(inv.avg_purchase_price)}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                        {filtered.length === 0 && (
                            <p className="text-sm text-gray-400 text-center py-10">在庫がありません</p>
                        )}
                    </div>
                </div>
            ) : (
                <div>
                    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
                        <div className="flex items-center gap-3">
                            <CardThumbnail url={selectedInv.catalog?.image_url} size="lg" name={selectedInv.catalog?.name} />
                            <div className="flex-1">
                                <p className="text-base font-bold text-gray-800">{selectedInv.catalog?.name || '-'}</p>
                                <div className="flex items-center gap-2 text-sm text-gray-400 mt-1">
                                    <span
                                        className="px-2.5 py-1 rounded-full text-white text-xs font-bold"
                                        style={{ backgroundColor: selectedInv.cond?.color || '#6b7280' }}
                                    >
                                        {selectedInv.condition}
                                    </span>
                                    <span>在庫 {selectedInv.quantity}点</span>
                                    <span>仕入 {formatPrice(selectedInv.avg_purchase_price)}</span>
                                </div>
                            </div>
                            <button onClick={() => setSelectedInv(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
                        </div>
                    </div>

                    <div className="space-y-5">
                        {/* LOTモード: ロット選択 */}
                        {isLotMode && (
                            <div>
                                <div className="flex items-center gap-2 mb-3">
                                    <label className="text-sm font-bold text-gray-600">ロット選択</label>
                                    <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full font-bold">LOT必須</span>
                                </div>
                                {availableLots.length > 0 ? (
                                    <div className="space-y-2">
                                        {availableLots.map(lot => {
                                            const isSelected = selectedLot?.id === lot.id
                                            const st = lot.source ? getSourceType(lot.source.type) : null
                                            const tl = lot.source ? getTrustLevel(lot.source.trust_level) : null
                                            return (
                                                <button
                                                    key={lot.id}
                                                    onClick={() => {
                                                        setSelectedLot(lot)
                                                        setQuantity(1)
                                                    }}
                                                    className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${isSelected
                                                        ? 'border-blue-400 bg-blue-50'
                                                        : 'border-gray-100 bg-white hover:bg-gray-50'
                                                        }`}
                                                >
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="text-sm font-bold text-gray-800">{lot.lot_number}</span>
                                                        <span className="text-sm font-bold text-gray-600">残 {lot.remaining_qty}個</span>
                                                    </div>
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        {lot.source && (
                                                            <span className="text-xs text-gray-500">{lot.source.name}</span>
                                                        )}
                                                        {st && (
                                                            <span className="text-xs px-1.5 py-0.5 rounded text-white font-bold" style={{ backgroundColor: st.color }}>{st.label}</span>
                                                        )}
                                                        {tl && (
                                                            <span className="text-xs px-1.5 py-0.5 rounded text-white font-bold" style={{ backgroundColor: tl.color }}>{tl.label}</span>
                                                        )}
                                                        <span className="text-xs text-gray-400">仕入 {formatPrice(lot.unit_cost)}</span>
                                                        <span className="text-xs text-gray-400">{new Date(lot.purchase_date).toLocaleDateString('ja-JP')}</span>
                                                    </div>
                                                </button>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-400 text-center py-4 bg-gray-50 rounded-xl">在庫のあるロットがありません</p>
                                )}
                            </div>
                        )}

                        {/* 数量 */}
                        <div>
                            <label className="text-sm font-bold text-gray-600 mb-3 block">数量（最大 {maxQuantity}点）</label>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                    className="w-12 h-12 bg-gray-100 rounded-lg text-xl font-bold text-gray-600 hover:bg-gray-200 transition-colors"
                                >-</button>
                                <input
                                    type="number"
                                    value={quantity || ''}
                                    onChange={e => setQuantity(parseInt(e.target.value) || 0)}
                                    onBlur={() => { if (quantity < 1) setQuantity(1); if (quantity > maxQuantity) setQuantity(maxQuantity) }}
                                    className="w-20 text-center text-2xl font-bold text-gray-900 border border-gray-200 rounded-lg py-2 focus:outline-none focus:border-gray-400"
                                    min={1}
                                    max={maxQuantity}
                                />
                                <button
                                    onClick={() => setQuantity(Math.min(maxQuantity, quantity + 1))}
                                    className="w-12 h-12 bg-gray-100 rounded-lg text-xl font-bold text-gray-600 hover:bg-gray-200 transition-colors"
                                >+</button>
                            </div>
                        </div>

                        {/* 販売単価 */}
                        <div>
                            <label className="text-sm font-bold text-gray-600 mb-3 block">販売単価</label>
                            <div className="relative">
                                <span className="absolute left-4 top-3.5 text-gray-400 text-sm">¥</span>
                                <input
                                    type="number"
                                    value={unitPrice}
                                    onChange={e => setUnitPrice(e.target.value)}
                                    placeholder="0"
                                    className="w-full px-4 py-3.5 pl-9 border border-gray-200 rounded-xl text-lg font-bold text-right focus:outline-none focus:border-gray-400"
                                />
                            </div>
                        </div>

                        {/* メモ */}
                        <div>
                            <label className="text-sm font-bold text-gray-600 mb-3 block">メモ（任意）</label>
                            <input
                                type="text"
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="販売先など"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400"
                            />
                        </div>

                        {/* 合計 + 利益 */}
                        <div className="bg-gray-50 rounded-xl px-5 py-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500 font-bold">合計金額</span>
                                <span className="text-2xl font-bold text-gray-900">{formatPrice(total)}</span>
                            </div>
                            {profit && (
                                <>
                                    <div className="flex items-center justify-between border-t border-gray-200 pt-3">
                                        <span className="text-sm text-gray-500 font-bold">粗利益</span>
                                        <span className={`text-lg font-bold ${profit.total >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                            {profit.total >= 0 ? '+' : ''}{formatPrice(profit.total)}
                                            <span className="text-xs text-gray-400 ml-1">({profit.rate > 0 ? '+' : ''}{profit.rate}%)</span>
                                        </span>
                                    </div>
                                    {profit.expenseTotal > 0 && (
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-400">仕入れ費用</span>
                                            <span className="text-sm text-orange-600 font-bold">-{formatPrice(profit.expenseTotal)}</span>
                                        </div>
                                    )}
                                    <div className="flex items-center justify-between border-t border-gray-200 pt-2">
                                        <span className="text-sm text-gray-500 font-bold">
                                            {profit.expenseTotal > 0 ? '実利益' : '利益'}
                                        </span>
                                        <span className={`text-xl font-bold ${profit.netTotal >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                            {profit.netTotal >= 0 ? '+' : ''}{formatPrice(profit.netTotal)}
                                            <span className="text-xs text-gray-400 ml-1">({profit.netRate > 0 ? '+' : ''}{profit.netRate}%)</span>
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* 登録ボタン */}
                        <button
                            onClick={handleSubmit}
                            disabled={unitPrice === '' || quantity > maxQuantity || submitting || (isLotMode && !selectedLot)}
                            className={`w-full py-4 rounded-xl text-base font-bold transition-colors ${unitPrice !== '' && quantity <= maxQuantity && !submitting && (!isLotMode || selectedLot)
                                ? 'bg-green-600 text-white hover:bg-green-700 active:scale-[0.98]'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                }`}
                        >
                            {submitting ? '登録中...' : `🛒 販売登録（利益 ${profit ? formatPrice(profit.netTotal) : '¥0'}）`}
                        </button>
                    </div>
                </div>
            )}
        </PosLayout>
    )
}
