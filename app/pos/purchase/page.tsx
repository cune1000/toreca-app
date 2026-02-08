'use client'

import { useState, useEffect } from 'react'
import PosLayout from '@/components/pos/PosLayout'
import { getCatalogs, registerPurchase } from '@/lib/pos/api'
import { CONDITIONS, formatPrice } from '@/lib/pos/constants'
import type { PosCatalog } from '@/lib/pos/types'

export default function PurchasePage() {
    const [catalogs, setCatalogs] = useState<PosCatalog[]>([])
    const [search, setSearch] = useState('')
    const [selectedCatalog, setSelectedCatalog] = useState<PosCatalog | null>(null)
    const [condition, setCondition] = useState('A')
    const [quantity, setQuantity] = useState(1)
    const [unitPrice, setUnitPrice] = useState('')
    const [notes, setNotes] = useState('')
    const [showResult, setShowResult] = useState(false)
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        getCatalogs({ search }).then(res => setCatalogs(res.data)).catch(console.error)
    }, [search])

    const total = quantity * (parseInt(unitPrice) || 0)

    const handleSubmit = async () => {
        if (!selectedCatalog || !unitPrice || total === 0) return
        setSubmitting(true)
        try {
            await registerPurchase({
                catalog_id: selectedCatalog.id,
                condition,
                quantity,
                unit_price: parseInt(unitPrice),
                notes: notes || undefined,
            })
            setShowResult(true)
            setTimeout(() => setShowResult(false), 3000)
            setSelectedCatalog(null)
            setUnitPrice('')
            setQuantity(1)
            setNotes('')
            setSearch('')
        } catch (err: any) {
            alert(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <PosLayout>
            <h2 className="text-lg font-bold text-gray-800 mb-4">💰 仕入れ登録</h2>

            {showResult && (
                <div className="mb-4 bg-green-50 border border-green-200 rounded-xl px-4 py-3 flex items-center gap-2">
                    <span className="text-green-600 text-lg">✅</span>
                    <p className="text-sm text-green-700 font-medium">仕入れを登録しました！</p>
                </div>
            )}

            {!selectedCatalog ? (
                <div>
                    <div className="relative mb-3">
                        <input
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="カタログから検索..."
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400 pl-9"
                        />
                        <span className="absolute left-3 top-3.5 text-gray-400 text-sm">🔍</span>
                    </div>

                    <div className="space-y-1.5">
                        {catalogs.map(cat => (
                            <button
                                key={cat.id}
                                onClick={() => setSelectedCatalog(cat)}
                                className="w-full bg-white border border-gray-100 rounded-lg px-3 py-2.5 flex items-center gap-3 hover:bg-gray-50 text-left"
                            >
                                {cat.image_url ? (
                                    <img src={cat.image_url} alt="" className="w-10 h-14 object-cover rounded" />
                                ) : (
                                    <div className="w-10 h-14 bg-gray-100 rounded flex items-center justify-center text-lg">🎴</div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-800 truncate">{cat.name}</p>
                                    <p className="text-[10px] text-gray-400">{cat.category || '-'} / {cat.rarity || '-'}</p>
                                </div>
                                {cat.source_type === 'api' && <span className="text-[10px] text-blue-400">🔗API</span>}
                            </button>
                        ))}
                        {catalogs.length === 0 && (
                            <p className="text-sm text-gray-400 text-center py-8">カタログがありません</p>
                        )}
                    </div>
                </div>
            ) : (
                <div>
                    {/* 選択中の商品 */}
                    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
                        <div className="flex items-center gap-3 mb-3">
                            {selectedCatalog.image_url ? (
                                <img src={selectedCatalog.image_url} alt="" className="w-14 h-20 object-cover rounded" />
                            ) : (
                                <div className="w-14 h-20 bg-gray-100 rounded flex items-center justify-center text-2xl">🎴</div>
                            )}
                            <div className="flex-1">
                                <p className="text-base font-bold text-gray-800">{selectedCatalog.name}</p>
                                <p className="text-xs text-gray-400">
                                    {selectedCatalog.category || '-'} / {selectedCatalog.rarity || '-'}
                                    {selectedCatalog.card_number && ` / ${selectedCatalog.card_number}`}
                                </p>
                            </div>
                            <button onClick={() => setSelectedCatalog(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        {selectedCatalog.fixed_price && (
                            <div className="bg-blue-50 rounded-lg px-3 py-2 text-xs text-blue-600">
                                📊 販売設定価格: {formatPrice(selectedCatalog.fixed_price)}
                            </div>
                        )}
                    </div>

                    {/* 入力フォーム */}
                    <div className="space-y-4">
                        {/* 状態 */}
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-2 block">状態</label>
                            <div className="grid grid-cols-3 gap-1.5">
                                {CONDITIONS.map(c => (
                                    <button
                                        key={c.code}
                                        onClick={() => setCondition(c.code)}
                                        className={`py-2 rounded-lg text-xs font-medium transition-colors ${condition === c.code
                                                ? 'text-white'
                                                : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                                            }`}
                                        style={condition === c.code ? { backgroundColor: c.color } : {}}
                                    >
                                        {c.code} {c.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 数量 */}
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-2 block">数量</label>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                                    className="w-10 h-10 bg-gray-100 rounded-lg text-lg font-bold text-gray-600 hover:bg-gray-200"
                                >-</button>
                                <span className="text-2xl font-bold text-gray-900 w-12 text-center">{quantity}</span>
                                <button
                                    onClick={() => setQuantity(quantity + 1)}
                                    className="w-10 h-10 bg-gray-100 rounded-lg text-lg font-bold text-gray-600 hover:bg-gray-200"
                                >+</button>
                            </div>
                        </div>

                        {/* 仕入れ単価 */}
                        <div>
                            <label className="text-xs font-medium text-gray-600 mb-2 block">仕入れ単価</label>
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-gray-400 text-sm">¥</span>
                                <input
                                    type="number"
                                    value={unitPrice}
                                    onChange={e => setUnitPrice(e.target.value)}
                                    placeholder="0"
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
                                placeholder="仕入れ先など"
                                className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400"
                            />
                        </div>

                        {/* 合計 */}
                        <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between">
                            <span className="text-sm text-gray-500">合計金額</span>
                            <span className="text-xl font-bold text-gray-900">{formatPrice(total)}</span>
                        </div>

                        {/* 登録ボタン */}
                        <button
                            onClick={handleSubmit}
                            disabled={!unitPrice || total === 0 || submitting}
                            className={`w-full py-3.5 rounded-xl text-sm font-bold transition-colors ${unitPrice && total > 0 && !submitting
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
