'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import PosLayout from '@/components/pos/PosLayout'
import { getCatalogs, createCatalog, deleteCatalog, searchCatalogFromAPI, getInventory } from '@/lib/pos/api'
import { formatPrice, getCondition } from '@/lib/pos/constants'
import type { PosCatalog, PosInventory } from '@/lib/pos/types'

export default function CatalogPage() {
    const router = useRouter()
    const [catalogs, setCatalogs] = useState<PosCatalog[]>([])
    const [inventory, setInventory] = useState<PosInventory[]>([])
    const [inventoryLoaded, setInventoryLoaded] = useState(false)
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
            const catRes = await getCatalogs({ search })
            setCatalogs(catRes.data)
            if (!inventoryLoaded) {
                const invRes = await getInventory()
                setInventory(invRes.data)
                setInventoryLoaded(true)
            }
        } catch (err) { console.error(err) }
        finally { setLoading(false) }
    }

    useEffect(() => {
        const timer = setTimeout(() => { load() }, 300)
        return () => clearTimeout(timer)
    }, [search])

    useEffect(() => { load() }, [])

    const catalogWithStock = useMemo(() => {
        const invByCatalog: Record<string, PosInventory[]> = {}
        for (const inv of inventory) {
            if (!invByCatalog[inv.catalog_id]) invByCatalog[inv.catalog_id] = []
            invByCatalog[inv.catalog_id].push(inv)
        }
        return catalogs.map(cat => {
            const items = invByCatalog[cat.id] || []
            const totalQty = items.reduce((s, i) => s + i.quantity, 0)
            const totalCost = items.reduce((s, i) => s + i.avg_purchase_price * i.quantity, 0)
            const avgCost = totalQty > 0 ? Math.round(totalCost / totalQty) : 0
            const sellPrice = cat.fixed_price || 0
            const estimatedProfit = sellPrice > 0 ? (sellPrice * totalQty) - totalCost : 0
            return { ...cat, inventoryItems: items, totalQty, totalCost, avgCost, estimatedProfit }
        })
    }, [catalogs, inventory])

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
            setInventoryLoaded(false)
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
            setInventoryLoaded(false)
            load()
        } catch (err: any) { alert(err.message) }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('このカタログを削除しますか？')) return
        try {
            await deleteCatalog(id)
            setInventoryLoaded(false)
            load()
        }
        catch (err: any) { alert(err.message) }
    }

    return (
        <PosLayout>
            {/* ヘッダー */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 md:mb-6">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">カタログ・在庫管理</h1>
                    <p className="text-sm text-gray-500 mt-1">{filtered.length}件のカタログ</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => { setShowApiSearch(!showApiSearch); setShowCreate(false) }}
                        className="flex-1 sm:flex-none px-4 sm:px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors"
                    >🔗 API検索</button>
                    <button
                        onClick={() => { setShowCreate(!showCreate); setShowApiSearch(false) }}
                        className="flex-1 sm:flex-none px-4 sm:px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-bold hover:bg-gray-800 transition-colors"
                    >+ 新規作成</button>
                </div>
            </div>

            {/* API検索パネル */}
            {showApiSearch && (
                <div className="mb-5 md:mb-6 bg-blue-50 border border-blue-200 rounded-xl p-4 md:p-6">
                    <h3 className="text-sm font-bold text-blue-800 mb-3">🔗 APIからカード検索</h3>
                    <div className="flex gap-2 mb-3">
                        <input
                            type="text"
                            value={apiQuery}
                            onChange={e => setApiQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleApiSearch()}
                            placeholder="カード名で検索..."
                            className="flex-1 px-4 py-3 border border-blue-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 bg-white"
                        />
                        <button
                            onClick={handleApiSearch}
                            disabled={apiSearching}
                            className="px-4 sm:px-6 py-3 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700"
                        >{apiSearching ? '...' : '検索'}</button>
                    </div>
                    {apiResults.length > 0 && (
                        <div className="bg-white rounded-lg border border-blue-100 divide-y divide-blue-50 max-h-72 overflow-y-auto">
                            {apiResults.map((item: any) => (
                                <div key={item.api_card_id} className="px-4 py-3 flex items-center gap-3 md:gap-4 hover:bg-blue-50/50">
                                    {item.image_url && (
                                        <img src={item.image_url} alt="" className="w-10 h-14 object-cover rounded" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-800 truncate">{item.name}</p>
                                        <p className="text-xs text-gray-400">{item.category} / {item.rarity}</p>
                                    </div>
                                    <button
                                        onClick={() => handleImportFromApi(item)}
                                        className="px-3 md:px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700"
                                    >追加</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* 手動新規作成 */}
            {showCreate && (
                <div className="mb-5 md:mb-6 bg-white border border-gray-200 rounded-xl p-4 md:p-6">
                    <h3 className="text-sm font-bold text-gray-700 mb-4">✏️ 手動登録</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                        <input placeholder="商品名 *" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                            className="sm:col-span-3 px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200" />
                        <input placeholder="カテゴリ" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                            className="px-4 py-3 border border-gray-200 rounded-lg text-sm" />
                        <input placeholder="サブカテ" value={form.subcategory} onChange={e => setForm({ ...form, subcategory: e.target.value })}
                            className="px-4 py-3 border border-gray-200 rounded-lg text-sm" />
                        <input placeholder="カード番号" value={form.card_number} onChange={e => setForm({ ...form, card_number: e.target.value })}
                            className="px-4 py-3 border border-gray-200 rounded-lg text-sm" />
                        <input placeholder="レアリティ" value={form.rarity} onChange={e => setForm({ ...form, rarity: e.target.value })}
                            className="px-4 py-3 border border-gray-200 rounded-lg text-sm" />
                        <input placeholder="販売価格" type="number" value={form.fixed_price} onChange={e => setForm({ ...form, fixed_price: e.target.value })}
                            className="px-4 py-3 border border-gray-200 rounded-lg text-sm" />
                    </div>
                    <button onClick={handleCreate} className="w-full sm:w-auto px-8 py-3 bg-gray-900 text-white rounded-lg text-sm font-bold">登録</button>
                </div>
            )}

            {/* 検索 + フィルタ */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-4 md:mb-5">
                <div className="relative flex-1 sm:max-w-lg">
                    <input
                        type="text"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="カタログを検索..."
                        className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 pl-10 bg-white"
                    />
                    <span className="absolute left-3.5 top-3.5 text-gray-400 text-sm">🔍</span>
                </div>
                <div className="flex gap-1.5 bg-white border border-gray-200 rounded-lg p-1 self-start">
                    {[
                        { key: 'all' as const, label: 'すべて' },
                        { key: 'instock' as const, label: '在庫あり' },
                        { key: 'nostock' as const, label: '在庫なし' },
                    ].map(f => (
                        <button
                            key={f.key}
                            onClick={() => setStockFilter(f.key)}
                            className={`px-3 md:px-4 py-2 rounded-md text-sm font-bold transition-colors ${stockFilter === f.key ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-700'}`}
                        >{f.label}</button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="py-16 text-center">
                    <div className="inline-block w-8 h-8 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
                </div>
            ) : (
                <>
                    {/* デスクトップ: テーブル */}
                    <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b border-gray-100 bg-gray-50/50">
                                    <th className="text-left text-xs font-semibold text-gray-500 px-5 py-3.5">商品</th>
                                    <th className="text-center text-xs font-semibold text-gray-500 px-4 py-3.5">在庫数</th>
                                    <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3.5">状態別在庫</th>
                                    <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3.5">平均仕入</th>
                                    <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3.5">販売価格</th>
                                    <th className="text-center text-xs font-semibold text-gray-500 px-4 py-3.5">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filtered.length > 0 ? filtered.map(cat => (
                                    <tr key={cat.id} className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => router.push(`/pos/catalog/${cat.id}`)}>
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-3">
                                                {cat.image_url ? (
                                                    <img src={cat.image_url} alt="" className="w-10 h-14 object-cover rounded flex-shrink-0" />
                                                ) : (
                                                    <div className="w-10 h-14 bg-gray-100 rounded flex items-center justify-center text-lg flex-shrink-0">🎴</div>
                                                )}
                                                <div className="min-w-0">
                                                    <p className="text-sm font-bold text-gray-900 truncate max-w-[300px]">{cat.name}</p>
                                                    <div className="flex items-center gap-2 mt-0.5">
                                                        <span className="text-xs text-gray-400">{cat.category || '-'}</span>
                                                        <span className="text-xs text-gray-300">·</span>
                                                        <span className="text-xs text-gray-400">{cat.rarity || '-'}</span>
                                                        {cat.source_type === 'api' && <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-500 rounded-full">API</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="text-center px-4">
                                            {cat.totalQty > 0 ? <span className="text-base font-bold text-gray-900">{cat.totalQty}</span> : <span className="text-sm text-gray-300">-</span>}
                                        </td>
                                        <td className="px-4">
                                            {cat.totalQty > 0 ? (
                                                <div className="flex gap-1.5 flex-wrap">
                                                    {cat.inventoryItems.filter(i => i.quantity > 0).map(inv => {
                                                        const cond = getCondition(inv.condition)
                                                        return <span key={inv.id} className="text-xs px-2 py-1 rounded-full text-white font-bold whitespace-nowrap" style={{ backgroundColor: cond?.color || '#6b7280' }}>{inv.condition}:{inv.quantity}</span>
                                                    })}
                                                </div>
                                            ) : <span className="text-sm text-gray-300">-</span>}
                                        </td>
                                        <td className="text-right text-sm font-medium text-gray-700 px-4">{cat.totalQty > 0 ? formatPrice(cat.avgCost) : <span className="text-gray-300">-</span>}</td>
                                        <td className="text-right text-sm font-medium text-gray-700 px-4">{cat.fixed_price ? formatPrice(cat.fixed_price) : <span className="text-gray-300">-</span>}</td>
                                        <td className="px-4 text-center" onClick={e => e.stopPropagation()}>
                                            <div className="flex items-center gap-1.5 justify-center">
                                                <button onClick={() => router.push(`/pos/purchase?catalog_id=${cat.id}`)} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors">💰 仕入</button>
                                                {cat.totalQty > 0 && <button onClick={() => router.push(`/pos/sale?catalog_id=${cat.id}`)} className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors">🛒 販売</button>}
                                                <button onClick={() => handleDelete(cat.id)} className="px-2 py-1.5 bg-gray-50 text-gray-400 rounded-lg text-xs hover:bg-red-50 hover:text-red-500 transition-colors">✕</button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr><td colSpan={6} className="text-center py-16 text-sm text-gray-400">カタログがありません</td></tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* モバイル: カードリスト */}
                    <div className="md:hidden space-y-2">
                        {filtered.length > 0 ? filtered.map(cat => (
                            <div
                                key={cat.id}
                                className="bg-white border border-gray-200 rounded-xl p-4 active:bg-gray-50 transition-colors"
                                onClick={() => router.push(`/pos/catalog/${cat.id}`)}
                            >
                                <div className="flex items-center gap-3">
                                    {cat.image_url ? (
                                        <img src={cat.image_url} alt="" className="w-12 h-16 object-cover rounded flex-shrink-0" />
                                    ) : (
                                        <div className="w-12 h-16 bg-gray-100 rounded flex items-center justify-center text-lg flex-shrink-0">🎴</div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-gray-900 truncate">{cat.name}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">{cat.category || '-'} / {cat.rarity || '-'}</p>
                                        {cat.totalQty > 0 && (
                                            <div className="flex gap-1 mt-1.5 flex-wrap">
                                                {cat.inventoryItems.filter(i => i.quantity > 0).map(inv => {
                                                    const cond = getCondition(inv.condition)
                                                    return <span key={inv.id} className="text-[10px] px-1.5 py-0.5 rounded text-white font-bold" style={{ backgroundColor: cond?.color || '#6b7280' }}>{inv.condition}×{inv.quantity}</span>
                                                })}
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                        <p className="text-lg font-bold text-gray-900">{cat.totalQty > 0 ? cat.totalQty : '-'}</p>
                                        {cat.totalQty > 0 && <p className="text-xs text-gray-400">{formatPrice(cat.avgCost)}</p>}
                                    </div>
                                </div>
                                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100" onClick={e => e.stopPropagation()}>
                                    <button onClick={() => router.push(`/pos/purchase?catalog_id=${cat.id}`)} className="flex-1 py-2.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold active:bg-blue-100">💰 仕入れ</button>
                                    {cat.totalQty > 0 && <button onClick={() => router.push(`/pos/sale?catalog_id=${cat.id}`)} className="flex-1 py-2.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold active:bg-green-100">🛒 販売</button>}
                                </div>
                            </div>
                        )) : (
                            <p className="text-center py-16 text-sm text-gray-400">カタログがありません</p>
                        )}
                    </div>
                </>
            )}
        </PosLayout>
    )
}
