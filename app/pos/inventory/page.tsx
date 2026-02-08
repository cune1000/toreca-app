'use client'

import { useState, useEffect, useMemo } from 'react'
import PosLayout from '@/components/pos/PosLayout'
import { getInventory } from '@/lib/pos/api'
import { formatPrice, getCondition } from '@/lib/pos/constants'
import { calculateProfit } from '@/lib/pos/calculations'
import type { PosInventory } from '@/lib/pos/types'

export default function InventoryPage() {
    const [inventory, setInventory] = useState<PosInventory[]>([])
    const [filter, setFilter] = useState('all')
    const [sort, setSort] = useState('profit_desc')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        getInventory()
            .then(res => setInventory(res.data))
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    const categories = useMemo(() => {
        const cats = new Set(inventory.map(i => i.catalog?.category).filter(Boolean))
        return ['all', ...Array.from(cats)] as string[]
    }, [inventory])

    const sorted = useMemo(() => {
        let items = inventory
            .filter(i => filter === 'all' || i.catalog?.category === filter)
            .map(inv => {
                const cond = getCondition(inv.condition)
                const sellPrice = inv.catalog?.fixed_price || inv.avg_purchase_price
                const profit = calculateProfit(sellPrice, inv.avg_purchase_price, inv.quantity)
                return { ...inv, cond, sellPrice, profit }
            })

        switch (sort) {
            case 'profit_desc': items.sort((a, b) => b.profit.total - a.profit.total); break
            case 'value_desc': items.sort((a, b) => (b.avg_purchase_price * b.quantity) - (a.avg_purchase_price * a.quantity)); break
            case 'quantity_desc': items.sort((a, b) => b.quantity - a.quantity); break
        }
        return items
    }, [inventory, filter, sort])

    return (
        <PosLayout>
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800">📦 在庫一覧</h2>
                <span className="text-xs text-gray-400">{sorted.length}件</span>
            </div>

            {/* フィルタ・ソート */}
            <div className="flex gap-2 mb-4 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setFilter(cat)}
                        className={`px-3 py-1.5 rounded-full text-xs whitespace-nowrap ${filter === cat ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500'
                            }`}
                    >
                        {cat === 'all' ? 'すべて' : cat}
                    </button>
                ))}
                <select
                    value={sort}
                    onChange={e => setSort(e.target.value)}
                    className="ml-auto px-2 py-1 text-xs border border-gray-200 rounded-lg bg-white text-gray-600 shrink-0"
                >
                    <option value="profit_desc">利益見込み順</option>
                    <option value="value_desc">在庫金額順</option>
                    <option value="quantity_desc">在庫数順</option>
                </select>
            </div>

            {loading ? (
                <div className="py-12 text-center">
                    <div className="inline-block w-8 h-8 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
                </div>
            ) : (
                <div className="space-y-2">
                    {sorted.length > 0 ? sorted.map(inv => (
                        <div key={inv.id} className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                            <div className="flex gap-3">
                                {inv.catalog?.image_url ? (
                                    <img src={inv.catalog.image_url} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
                                ) : (
                                    <div className="w-14 h-14 rounded-lg bg-gray-50 flex items-center justify-center text-2xl flex-shrink-0">🎴</div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-sm font-bold text-gray-800 truncate">{inv.catalog?.name || '-'}</p>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span
                                                    className="text-[10px] px-1.5 py-0.5 rounded-full text-white font-medium"
                                                    style={{ backgroundColor: inv.cond?.color }}
                                                >
                                                    {inv.cond?.name}
                                                </span>
                                                <span className="text-[10px] text-gray-400">{inv.catalog?.rarity || '-'}</span>
                                                {inv.catalog?.source_type === 'api' && (
                                                    <span className="text-[10px] text-blue-400">🔗API</span>
                                                )}
                                            </div>
                                        </div>
                                        <span className="text-lg font-bold text-gray-900">
                                            {inv.quantity}<span className="text-xs text-gray-400 ml-0.5">点</span>
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                                        <div>
                                            <p className="text-[10px] text-gray-400">平均仕入れ</p>
                                            <p className="text-xs font-bold text-gray-700">{formatPrice(inv.avg_purchase_price)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-400">販売価格</p>
                                            <p className="text-xs font-bold text-gray-700">{formatPrice(inv.sellPrice)}</p>
                                        </div>
                                        <div>
                                            <p className="text-[10px] text-gray-400">利益見込み</p>
                                            <p className={`text-xs font-bold ${inv.profit.total >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                {formatPrice(inv.profit.total)}
                                                <span className="text-[10px] ml-0.5">
                                                    ({inv.profit.rate > 0 ? '+' : ''}{inv.profit.rate}%)
                                                </span>
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )) : (
                        <p className="text-sm text-gray-400 text-center py-8">在庫データがありません</p>
                    )}
                </div>
            )}
        </PosLayout>
    )
}
