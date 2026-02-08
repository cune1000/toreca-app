'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import PosLayout from '@/components/pos/PosLayout'
import { getCatalogs, createCatalog, deleteCatalog, searchCatalogFromAPI, getInventory } from '@/lib/pos/api'
import { formatPrice, getCondition } from '@/lib/pos/constants'
import { calculateProfit } from '@/lib/pos/calculations'
import type { PosCatalog, PosInventory } from '@/lib/pos/types'

export default function CatalogPage() {
    const router = useRouter()
    const [catalogs, setCatalogs] = useState<PosCatalog[]>([])
    const [inventory, setInventory] = useState<PosInventory[]>([])
    const [search, setSearch] = useState('')
    const [stockFilter, setStockFilter] = useState<'all' | 'instock' | 'nostock'>('all')
    const [loading, setLoading] = useState(true)
    const [showCreate, setShowCreate] = useState(false)
    const [showApiSearch, setShowApiSearch] = useState(false)
    const [apiQuery, setApiQuery] = useState('')
    const [apiResults, setApiResults] = useState<any[]>([])
    const [apiSearching, setApiSearching] = useState(false)

    const [form, setForm] = useState({
        name: '', category: '', subcategory: '', card_number: '', rarity: '', fixed_price: '',
    })

    const load = async () => {
        try {
            const [catRes, invRes] = await Promise.all([
                getCatalogs({ search }),
                getInventory(),
            ])
            setCatalogs(catRes.data)
            setInventory(invRes.data)
        } catch (err) { console.error(err) }
        finally { setLoading(false) }
    }

    useEffect(() => { load() }, [search])

    // カタログごとの在庫をマッピング
    const catalogWithStock = useMemo(() => {
        const invByCatalog: Record<string, PosInventory[]> = {}
        for (const inv of inventory) {
            const cid = inv.catalog_id
            if (!invByCatalog[cid]) invByCatalog[cid] = []
            invByCatalog[cid].push(inv)
        }

        return catalogs.map(cat => {
            const items = invByCatalog[cat.id] || []
            const totalQty = items.reduce((s, i) => s + i.quantity, 0)
            const totalCost = items.reduce((s, i) => s + i.avg_purchase_price * i.quantity, 0)
            const sellPrice = cat.fixed_price || 0
            const estimatedProfit = sellPrice > 0 ? (sellPrice * totalQty) - totalCost : 0
            return { ...cat, inventoryItems: items, totalQty, totalCost, estimatedProfit }
        })
    }, [catalogs, inventory])

    // フィルタ適用
    const filtered = useMemo(() => {
        let items = catalogWithStock
        if (stockFilter === 'instock') items = items.filter(c => c.totalQty > 0)
        if (stockFilter === 'nostock') items = items.filter(c => c.totalQty === 0)
        return items
    }, [catalogWithStock, stockFilter])

    const handleCreate = async () => {
        if (!form.name.trim()) return
        try {
            await createCatalog({
                name: form.name,
                category: form.category || null,
                subcategory: form.subcategory || null,
                card_number: form.card_number || null,
                rarity: form.rarity || null,
                fixed_price: form.fixed_price ? parseInt(form.fixed_price) : null,
            })
            setForm({ name: '', category: '', subcategory: '', card_number: '', rarity: '', fixed_price: '' })
            setShowCreate(false)
            load()
        } catch (err: any) { alert(err.message) }
    }

    const handleApiSearch = async () => {
        if (!apiQuery.trim()) return
        setApiSearching(true)
        try {
            const res = await searchCatalogFromAPI(apiQuery)
            setApiResults(res.data)
        } catch (err: any) { alert(err.message) }
        finally { setApiSearching(false) }
    }

    const handleImportFromApi = async (item: any) => {
        try {
            await createCatalog({
                name: item.name,
                image_url: item.image_url,
                category: item.category,
                rarity: item.rarity,
                source_type: 'api',
                api_card_id: item.api_card_id,
            })
            setApiResults(prev => prev.filter(r => r.api_card_id !== item.api_card_id))
            load()
        } catch (err: any) { alert(err.message) }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('このカタログを削除しますか？')) return
        try { await deleteCatalog(id); load() }
        catch (err: any) { alert(err.message) }
    }

    return (
        <PosLayout>
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-800">📋 カタログ</h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => { setShowApiSearch(!showApiSearch); setShowCreate(false) }}
                        className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium"
                    >🔗 API検索</button>
                    <button
                        onClick={() => { setShowCreate(!showCreate); setShowApiSearch(false) }}
                        className="px-3 py-1.5 bg-gray-800 text-white rounded-lg text-xs font-medium"
                    >+ 新規作成</button>
                </div>
            </div>

            {/* API検索パネル */}
            {showApiSearch && (
                <div className="mb-4 bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <h3 className="text-sm font-bold text-blue-800 mb-2">🔗 APIからカード検索</h3>
                    <div className="flex gap-2 mb-3">
                        <input
                            type="text"
                            value={apiQuery}
                            onChange={e => setApiQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleApiSearch()}
                            placeholder="カード名で検索..."
                            className="flex-1 px-3 py-2 border border-blue-200 rounded-lg text-sm focus:outline-none"
                        />
                        <button
                            onClick={handleApiSearch}
                            disabled={apiSearching}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
                        >{apiSearching ? '...' : '検索'}</button>
                    </div>
                    {apiResults.length > 0 && (
                        <div className="space-y-1.5 max-h-60 overflow-y-auto">
                            {apiResults.map((item: any) => (
                                <div key={item.api_card_id} className="bg-white rounded-lg px-3 py-2 flex items-center gap-3">
                                    {item.image_url && (
                                        <img src={item.image_url} alt="" className="w-10 h-14 object-cover rounded" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                                        <p className="text-[10px] text-gray-400">{item.category} / {item.rarity}</p>
                                    </div>
                                    <button
                                        onClick={() => handleImportFromApi(item)}
                                        className="px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium"
                                    >追加</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* 手動新規作成 */}
            {showCreate && (
                <div className="mb-4 bg-white border border-gray-200 rounded-xl p-4">
                    <h3 className="text-sm font-bold text-gray-700 mb-3">✏️ 手動登録</h3>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                        <input placeholder="商品名 *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                            className="col-span-2 px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                        <input placeholder="カテゴリ" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                        <input placeholder="サブカテ" value={form.subcategory} onChange={e => setForm({ ...form, subcategory: e.target.value })}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                        <input placeholder="カード番号" value={form.card_number} onChange={e => setForm({ ...form, card_number: e.target.value })}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                        <input placeholder="レアリティ" value={form.rarity} onChange={e => setForm({ ...form, rarity: e.target.value })}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                        <input placeholder="販売価格" type="number" value={form.fixed_price} onChange={e => setForm({ ...form, fixed_price: e.target.value })}
                            className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                    </div>
                    <button onClick={handleCreate} className="w-full py-2 bg-gray-800 text-white rounded-lg text-sm font-medium">登録</button>
                </div>
            )}

            {/* 検索 + フィルタ */}
            <div className="relative mb-3">
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="カタログを検索..."
                    className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400 pl-9"
                />
                <span className="absolute left-3 top-3 text-gray-400 text-sm">🔍</span>
            </div>

            {/* 在庫フィルタ */}
            <div className="flex gap-2 mb-4">
                {[
                    { key: 'all' as const, label: 'すべて' },
                    { key: 'instock' as const, label: '在庫あり' },
                    { key: 'nostock' as const, label: '在庫なし' },
                ].map(f => (
                    <button
                        key={f.key}
                        onClick={() => setStockFilter(f.key)}
                        className={`px-3 py-1.5 rounded-full text-xs ${stockFilter === f.key ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500'
                            }`}
                    >
                        {f.label}
                    </button>
                ))}
                <span className="text-xs text-gray-400 ml-auto self-center">{filtered.length}件</span>
            </div>

            {/* 一覧 */}
            {loading ? (
                <div className="py-12 text-center">
                    <div className="inline-block w-8 h-8 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
                </div>
            ) : (
                <div className="space-y-2">
                    {filtered.length > 0 ? filtered.map(cat => (
                        <div key={cat.id} className="bg-white border border-gray-100 rounded-xl p-3 shadow-sm">
                            <div className="flex gap-3">
                                {cat.image_url ? (
                                    <img src={cat.image_url} alt="" className="w-12 h-16 object-cover rounded flex-shrink-0" />
                                ) : (
                                    <div className="w-12 h-16 bg-gray-100 rounded flex items-center justify-center text-xl flex-shrink-0">🎴</div>
                                )}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <p className="text-sm font-bold text-gray-800 truncate">{cat.name}</p>
                                            <div className="flex items-center gap-1.5 mt-0.5">
                                                <span className="text-[10px] text-gray-400">{cat.category || '-'}</span>
                                                <span className="text-[10px] text-gray-400">·</span>
                                                <span className="text-[10px] text-gray-400">{cat.rarity || '-'}</span>
                                                {cat.source_type === 'api' ? (
                                                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-500 rounded-full ml-1">API</span>
                                                ) : (
                                                    <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded-full ml-1">独自</span>
                                                )}
                                            </div>
                                        </div>
                                        {cat.totalQty > 0 && (
                                            <span className="text-base font-bold text-gray-900">
                                                {cat.totalQty}<span className="text-[10px] text-gray-400 ml-0.5">点</span>
                                            </span>
                                        )}
                                    </div>

                                    {/* 在庫情報（在庫がある場合） */}
                                    {cat.totalQty > 0 && (
                                        <div className="flex items-center gap-3 mt-1.5">
                                            <div className="flex gap-1 flex-wrap">
                                                {cat.inventoryItems.filter(i => i.quantity > 0).map(inv => (
                                                    <span
                                                        key={inv.id}
                                                        className="text-[10px] px-1.5 py-0.5 rounded-full text-white"
                                                        style={{ backgroundColor: getCondition(inv.condition)?.color || '#6b7280' }}
                                                    >
                                                        {inv.condition}:{inv.quantity}
                                                    </span>
                                                ))}
                                            </div>
                                            {cat.fixed_price && (
                                                <span className="text-[10px] text-gray-400 ml-auto">
                                                    販売 {formatPrice(cat.fixed_price)}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* アクションボタン */}
                            <div className="flex gap-2 mt-2.5 pt-2.5 border-t border-gray-50">
                                <button
                                    onClick={() => router.push(`/pos/purchase?catalog_id=${cat.id}`)}
                                    className="flex-1 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-100"
                                >
                                    💰 仕入れ
                                </button>
                                {cat.totalQty > 0 && (
                                    <button
                                        onClick={() => router.push(`/pos/sale?catalog_id=${cat.id}`)}
                                        className="flex-1 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-medium hover:bg-green-100"
                                    >
                                        🛒 販売
                                    </button>
                                )}
                                <button
                                    onClick={() => handleDelete(cat.id)}
                                    className="py-1.5 px-3 bg-gray-50 text-gray-400 rounded-lg text-xs hover:bg-red-50 hover:text-red-500"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    )) : (
                        <p className="text-sm text-gray-400 text-center py-8">カタログがありません</p>
                    )}
                </div>
            )}
        </PosLayout>
    )
}
