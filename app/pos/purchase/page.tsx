'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import PosLayout from '@/components/pos/PosLayout'
import { getCatalogs, getCatalog, registerPurchase } from '@/lib/pos/api'
import { CONDITIONS, formatPrice } from '@/lib/pos/constants'
import type { PosCatalog } from '@/lib/pos/types'

export default function PurchasePageWrapper() {
    return <Suspense fallback={<PosLayout><div className="py-12 text-center"><div className="inline-block w-8 h-8 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" /></div></PosLayout>}><PurchasePage /></Suspense>
}

function PurchasePage() {
    const searchParams = useSearchParams()
    const catalogIdParam = searchParams.get('catalog_id')

    const [catalogs, setCatalogs] = useState<PosCatalog[]>([])
    const [search, setSearch] = useState('')
    const [selectedCatalog, setSelectedCatalog] = useState<PosCatalog | null>(null)
    const [condition, setCondition] = useState('A')
    const [customCondition, setCustomCondition] = useState('')
    const [useCustomCondition, setUseCustomCondition] = useState(false)
    const [quantity, setQuantity] = useState(1)
    const [priceMode, setPriceMode] = useState<'unit' | 'total'>('unit')
    const [priceInput, setPriceInput] = useState('')
    const [expenseMode, setExpenseMode] = useState<'total' | 'unit'>('total')
    const [expensesInput, setExpensesInput] = useState('')
    const [notes, setNotes] = useState('')
    const [showResult, setShowResult] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    // URLパラメータからカタログ直接選択
    useEffect(() => {
        if (catalogIdParam) {
            getCatalog(catalogIdParam)
                .then(res => setSelectedCatalog(res.data))
                .catch(console.error)
        }
    }, [catalogIdParam])

    useEffect(() => {
        if (!selectedCatalog) {
            getCatalogs({ search }).then(res => setCatalogs(res.data)).catch(console.error)
        }
    }, [search, selectedCatalog])

    // 単価計算
    const effectiveCondition = useCustomCondition ? customCondition : condition
    const unitPrice = priceMode === 'unit'
        ? (parseInt(priceInput) || 0)
        : quantity > 0 ? Math.round((parseInt(priceInput) || 0) / quantity) : 0
    const total = priceMode === 'unit'
        ? quantity * (parseInt(priceInput) || 0)
        : (parseInt(priceInput) || 0)
    const totalExpenses = expenseMode === 'total'
        ? (parseInt(expensesInput) || 0)
        : quantity * (parseInt(expensesInput) || 0)
    const expensePerUnit = expenseMode === 'unit'
        ? (parseInt(expensesInput) || 0)
        : quantity > 0 ? Math.round((parseInt(expensesInput) || 0) / quantity) : 0

    const handleSubmit = async () => {
        if (!selectedCatalog || !effectiveCondition || priceInput === '') return
        setSubmitting(true)
        try {
            await registerPurchase({
                catalog_id: selectedCatalog.id,
                condition: effectiveCondition,
                quantity,
                unit_price: unitPrice,
                expenses: totalExpenses || undefined,
                notes: notes || undefined,
            })
            setShowResult(true)
            setTimeout(() => setShowResult(false), 3000)
            setSelectedCatalog(null)
            setPriceInput('')
            setQuantity(1)
            setNotes('')
            setExpensesInput('')
            setSearch('')
            setCustomCondition('')
            setUseCustomCondition(false)
        } catch (err: any) {
            alert(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <PosLayout>
            <h2 className="text-xl font-bold text-gray-800 mb-5">💰 仕入れ登録</h2>

            {showResult && (
                <div className="mb-5 bg-green-50 border border-green-200 rounded-xl px-5 py-4 flex items-center gap-2">
                    <span className="text-green-600 text-lg">✅</span>
                    <p className="text-sm text-green-700 font-bold">仕入れを登録しました！</p>
                </div>
            )}

            {!selectedCatalog ? (
                <div>
                    <div className="relative mb-4">
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="カタログから検索..."
                            className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400 pl-10"
                        />
                        <span className="absolute left-3.5 top-4 text-gray-400 text-sm">🔍</span>
                    </div>

                    <div className="space-y-2">
                        {catalogs.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCatalog(cat)}
                                className="w-full bg-white border border-gray-100 rounded-lg px-4 py-3.5 flex items-center gap-3 hover:bg-gray-50 text-left transition-colors"
                            >
                                {cat.image_url ? (
                                    <img src={cat.image_url} alt="" className="w-10 h-14 object-cover rounded" />
                                ) : (
                                    <div className="w-10 h-14 bg-gray-100 rounded flex items-center justify-center text-lg">🎴</div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-bold text-gray-800 truncate">{cat.name}</p>
                                    <p className="text-xs text-gray-400">{cat.category || '-'} / {cat.rarity || '-'}</p>
                                </div>
                                {cat.source_type === 'api' && <span className="text-xs text-blue-400">🔗API</span>}
                            </button>
                        ))}
                        {catalogs.length === 0 && (
                            <p className="text-sm text-gray-400 text-center py-10">カタログがありません</p>
                        )}
                    </div>
                </div>
            ) : (
                <div>
                    {/* 選択中の商品 */}
                    <div className="bg-white border border-gray-200 rounded-xl p-5 mb-5">
                        <div className="flex items-center gap-3 mb-3">
                            {selectedCatalog.image_url ? (
                                <img src={selectedCatalog.image_url} alt="" className="w-14 h-20 object-cover rounded" />
                            ) : (
                                <div className="w-14 h-20 bg-gray-100 rounded flex items-center justify-center text-2xl">🎴</div>
                            )}
                            <div className="flex-1">
                                <p className="text-base font-bold text-gray-800">{selectedCatalog.name}</p>
                                <p className="text-sm text-gray-400">
                                    {selectedCatalog.category || '-'} / {selectedCatalog.rarity || '-'}
                                    {selectedCatalog.card_number && ` / ${selectedCatalog.card_number}`}
                                </p>
                            </div>
                            <button onClick={() => setSelectedCatalog(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
                        </div>
                        {selectedCatalog.fixed_price && (
                            <div className="bg-blue-50 rounded-lg px-4 py-2.5 text-sm text-blue-600">
                                📊 販売設定価格: {formatPrice(selectedCatalog.fixed_price)}
                            </div>
                        )}
                    </div>

                    {/* 入力フォーム */}
                    <div className="space-y-5">
                        {/* 状態（プリセット＋その他） */}
                        <div>
                            <label className="text-sm font-bold text-gray-600 mb-3 block">状態</label>
                            {!useCustomCondition ? (
                                <div className="space-y-2">
                                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                                        {CONDITIONS.map(c => (
                                            <button
                                                key={c.code}
                                                onClick={() => setCondition(c.code)}
                                                className={`py-3 rounded-lg text-sm font-bold transition-colors ${condition === c.code
                                                    ? 'text-white shadow-sm'
                                                    : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                                                    }`}
                                                style={condition === c.code ? { backgroundColor: c.color } : {}}
                                            >
                                                {c.code}
                                            </button>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => { setUseCustomCondition(true); setCondition('') }}
                                        className={`w-full py-3 rounded-lg text-sm font-bold transition-colors border-2 border-dashed ${
                                            useCustomCondition ? 'border-gray-400 bg-gray-100' : 'border-gray-200 text-gray-400 hover:border-gray-300 hover:text-gray-600'
                                        }`}
                                    >
                                        その他（記述式）
                                    </button>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={customCondition}
                                        onChange={e => setCustomCondition(e.target.value)}
                                        placeholder="例: PSA8, BGS9.5, 未開封BOX..."
                                        className="flex-1 px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-400"
                                        autoFocus
                                    />
                                    <button
                                        onClick={() => { setUseCustomCondition(false); setCustomCondition(''); setCondition('A') }}
                                        className="px-4 py-3 bg-gray-100 text-gray-500 rounded-lg text-sm font-bold hover:bg-gray-200"
                                    >
                                        戻る
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* 数量 */}
                        <div>
                            <label className="text-sm font-bold text-gray-600 mb-3 block">数量</label>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                    className="w-12 h-12 bg-gray-100 rounded-lg text-xl font-bold text-gray-600 hover:bg-gray-200 transition-colors"
                                >-</button>
                                <input
                                    type="number"
                                    value={quantity || ''}
                                    onChange={e => setQuantity(parseInt(e.target.value) || 0)}
                                    onBlur={() => { if (quantity < 1) setQuantity(1) }}
                                    className="w-20 text-center text-2xl font-bold text-gray-900 border border-gray-200 rounded-lg py-2 focus:outline-none focus:border-gray-400"
                                    min={1}
                                />
                                <button
                                    onClick={() => setQuantity(quantity + 1)}
                                    className="w-12 h-12 bg-gray-100 rounded-lg text-xl font-bold text-gray-600 hover:bg-gray-200 transition-colors"
                                >+</button>
                            </div>
                        </div>

                        {/* 仕入れ単価 / 合計切替 */}
                        <div>
                            <div className="flex items-center justify-between mb-3">
                                <label className="text-sm font-bold text-gray-600">
                                    {priceMode === 'unit' ? '仕入れ単価（1個あたり）' : '仕入れ合計金額'}
                                </label>
                                <button
                                    onClick={() => {
                                        setPriceMode(prev => prev === 'unit' ? 'total' : 'unit')
                                        setPriceInput('')
                                    }}
                                    className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 font-bold"
                                >
                                    {priceMode === 'unit' ? '🔄 合計入力に切替' : '🔄 単価入力に切替'}
                                </button>
                            </div>
                            <div className="relative">
                                <span className="absolute left-4 top-3.5 text-gray-400 text-sm">¥</span>
                                <input
                                    type="number"
                                    value={priceInput}
                                    onChange={e => setPriceInput(e.target.value)}
                                    placeholder="0"
                                    className="w-full px-4 py-3.5 pl-9 border border-gray-200 rounded-xl text-lg font-bold text-right focus:outline-none focus:border-gray-400"
                                />
                            </div>
                            {priceMode === 'total' && quantity > 0 && priceInput && (
                                <p className="text-sm text-gray-400 mt-1.5 text-right">
                                    → 1個あたり {formatPrice(unitPrice)}
                                </p>
                            )}
                        </div>

                        {/* 仕入れにかかった費用 */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-sm font-bold text-gray-600">
                                    {expenseMode === 'total' ? '仕入れにかかった費用（合計）' : '仕入れにかかった費用（1個あたり）'}
                                </label>
                                <button
                                    onClick={() => {
                                        setExpenseMode(prev => prev === 'total' ? 'unit' : 'total')
                                        setExpensesInput('')
                                    }}
                                    className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200 font-bold"
                                >
                                    {expenseMode === 'total' ? '🔄 単価入力に切替' : '🔄 合計入力に切替'}
                                </button>
                            </div>
                            <p className="text-xs text-gray-400 mb-3">交通費・送料・消耗品費など。在庫原価には含めず、利益計算で別途差し引きます。</p>
                            <div className="relative">
                                <span className="absolute left-4 top-3.5 text-gray-400 text-sm">¥</span>
                                <input
                                    type="number"
                                    value={expensesInput}
                                    onChange={e => setExpensesInput(e.target.value)}
                                    placeholder="0"
                                    className="w-full px-4 py-3.5 pl-9 border border-gray-200 rounded-xl text-lg font-bold text-right focus:outline-none focus:border-gray-400"
                                />
                            </div>
                            {expenseMode === 'total' && totalExpenses > 0 && quantity > 1 && (
                                <p className="text-sm text-gray-400 mt-1.5 text-right">
                                    → 1個あたり {formatPrice(expensePerUnit)}
                                </p>
                            )}
                            {expenseMode === 'unit' && totalExpenses > 0 && quantity > 1 && (
                                <p className="text-sm text-gray-400 mt-1.5 text-right">
                                    → 合計 {formatPrice(totalExpenses)}
                                </p>
                            )}
                        </div>

                        {/* メモ */}
                        <div>
                            <label className="text-sm font-bold text-gray-600 mb-3 block">メモ（任意）</label>
                            <input
                                type="text"
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="仕入れ先など"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400"
                            />
                        </div>

                        {/* 合計 */}
                        <div className="bg-gray-50 rounded-xl px-5 py-4 space-y-2">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-gray-500 font-bold">仕入れ金額</span>
                                <span className="text-2xl font-bold text-gray-900">{formatPrice(total)}</span>
                            </div>
                            {priceMode === 'unit' && quantity > 1 && (
                                <p className="text-xs text-gray-400 text-right">
                                    {formatPrice(parseInt(priceInput) || 0)} × {quantity}個
                                </p>
                            )}
                            {totalExpenses > 0 && (
                                <>
                                    <div className="flex items-center justify-between border-t border-gray-200 pt-2">
                                        <span className="text-sm text-gray-400">仕入れ費用</span>
                                        <span className="text-sm text-orange-600 font-bold">{formatPrice(totalExpenses)}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-500 font-bold">合計支出</span>
                                        <span className="text-lg font-bold text-gray-900">{formatPrice(total + totalExpenses)}</span>
                                    </div>
                                </>
                            )}
                        </div>

                        {/* 登録ボタン */}
                        <button
                            onClick={handleSubmit}
                            disabled={priceInput === '' || !effectiveCondition || submitting}
                            className={`w-full py-4 rounded-xl text-base font-bold transition-colors ${priceInput !== '' && effectiveCondition && !submitting
                                ? 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'
                                : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                }`}
                        >
                            {submitting ? '登録中...' : `💰 仕入れ登録（${formatPrice(total)}）`}
                        </button>
                    </div>
                </div>
            )}
        </PosLayout>
    )
}
