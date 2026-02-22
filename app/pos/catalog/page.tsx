'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import PosLayout from '@/components/pos/PosLayout'
import PosSpinner from '@/components/pos/PosSpinner'
import CardThumbnail from '@/components/pos/CardThumbnail'
import { getCatalogs, createCatalog, deleteCatalog, searchCatalogFromAPI, getInventory } from '@/lib/pos/api'
import { getErrorMessage } from '@/lib/pos/utils'
import { formatPrice, getCondition } from '@/lib/pos/constants'
import type { PosCatalog, PosInventory } from '@/lib/pos/types'

export default function CatalogPageWrapper() {
    return <Suspense fallback={<PosLayout><div className="py-16 text-center"><div className="inline-block w-8 h-8 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" /></div></PosLayout>}><CatalogPage /></Suspense>
}

function CatalogPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const filterParam = searchParams.get('filter')
    const [catalogs, setCatalogs] = useState<PosCatalog[]>([])
    const [inventory, setInventory] = useState<PosInventory[]>([])
    const [inventoryLoaded, setInventoryLoaded] = useState(false)
    const [search, setSearch] = useState('')
    const [stockFilter, setStockFilter] = useState<'all' | 'instock' | 'nostock' | 'noprice'>(filterParam === 'instock' ? 'instock' : filterParam === 'nostock' ? 'nostock' : filterParam === 'noprice' ? 'noprice' : 'all')
    const [loading, setLoading] = useState(true)
    const [showCreate, setShowCreate] = useState(false)
    const [showApiSearch, setShowApiSearch] = useState(false)
    const [apiQuery, setApiQuery] = useState('')
    const [apiResults, setApiResults] = useState<any[]>([])
    const [apiSearching, setApiSearching] = useState(false)
    const [apiTotal, setApiTotal] = useState(0)
    const [apiLoadingMore, setApiLoadingMore] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)
    const [deleteSubmitting, setDeleteSubmitting] = useState(false)

    const [form, setForm] = useState({
        name: '', category: '', subcategory: '', card_number: '', rarity: '', fixed_price: '',
    })

    const [loadError, setLoadError] = useState('')

    const load = async (reloadInventory = false) => {
        setLoadError('')
        try {
            const catRes = await getCatalogs({ search })
            setCatalogs(catRes.data)
            if (!inventoryLoaded || reloadInventory) {
                const invRes = await getInventory()
                setInventory(invRes.data)
                setInventoryLoaded(true)
            }
        } catch (err) { setLoadError(getErrorMessage(err)) }
        finally { setLoading(false) }
    }

    useEffect(() => {
        if (search === '') {
            // 検索クリア時は在庫も再取得（他画面での変更を反映）
            load(inventoryLoaded)
        } else {
            const timer = setTimeout(() => { load() }, 300)
            return () => clearTimeout(timer)
        }
    }, [search])

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

            // 予想販売価格（predicted_price >> market_price >> fixed_price）
            const activeItems = items.filter(i => i.quantity > 0)
            const hasPredicted = activeItems.some(i => i.predicted_price != null)
            const hasMarket = activeItems.some(i => i.market_price != null)
            const priceSource: 'predicted' | 'market' | 'fixed' | 'none' =
                hasPredicted ? 'predicted' : hasMarket ? 'market' : cat.fixed_price ? 'fixed' : 'none'

            let predictedSaleTotal = 0
            for (const inv of activeItems) {
                const price = inv.predicted_price ?? inv.market_price ?? cat.fixed_price ?? 0
                predictedSaleTotal += price * inv.quantity
            }
            const effectivePrice = totalQty > 0 ? Math.round(predictedSaleTotal / totalQty) : (cat.fixed_price || 0)
            const estimatedProfit = predictedSaleTotal > 0 ? predictedSaleTotal - totalCost : (cat.fixed_price ? cat.fixed_price * totalQty - totalCost : 0)

            return { ...cat, inventoryItems: items, totalQty, totalCost, avgCost, effectivePrice, priceSource, estimatedProfit }
        })
    }, [catalogs, inventory])

    const noPriceCount = useMemo(() =>
        catalogWithStock.filter(c => c.totalQty > 0 && c.priceSource === 'none').length
    , [catalogWithStock])

    const filtered = useMemo(() => {
        let items = catalogWithStock
        if (stockFilter === 'instock') items = items.filter(c => c.totalQty > 0)
        if (stockFilter === 'nostock') items = items.filter(c => c.totalQty === 0)
        if (stockFilter === 'noprice') items = items.filter(c => c.totalQty > 0 && c.priceSource === 'none')
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
        } catch (err) { alert(getErrorMessage(err)) }
    }

    const handleApiSearch = async () => {
        if (!apiQuery.trim()) return
        setApiSearching(true)
        try {
            const res = await searchCatalogFromAPI(apiQuery)
            setApiResults(res.data)
            setApiTotal(res.total)
        } catch (err) { alert(getErrorMessage(err)) }
        finally { setApiSearching(false) }
    }

    const handleApiLoadMore = async () => {
        if (!apiQuery.trim()) return
        setApiLoadingMore(true)
        try {
            const res = await searchCatalogFromAPI(apiQuery, { offset: apiResults.length })
            setApiResults(prev => [...prev, ...res.data])
            setApiTotal(res.total)
        } catch (err) { alert(getErrorMessage(err)) }
        finally { setApiLoadingMore(false) }
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
        } catch (err) { alert(getErrorMessage(err)) }
    }

    const handleDelete = async () => {
        if (!deletingId) return
        setDeleteSubmitting(true)
        try {
            await deleteCatalog(deletingId)
            setDeletingId(null)
            setInventoryLoaded(false)
            load()
        }
        catch (err) { alert(getErrorMessage(err)) }
        finally { setDeleteSubmitting(false) }
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
                        <>
                            <p className="text-xs text-blue-600 mb-2 font-medium">{apiTotal}件中 {apiResults.length}件を表示</p>
                            <div className="bg-white rounded-lg border border-blue-100 divide-y divide-blue-50 max-h-96 overflow-y-auto">
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
                            {apiResults.length < apiTotal && (
                                <button
                                    onClick={handleApiLoadMore}
                                    disabled={apiLoadingMore}
                                    className="w-full mt-2 py-2.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-bold hover:bg-blue-200 transition-colors"
                                >{apiLoadingMore ? '読み込み中...' : `さらに表示（残り${apiTotal - apiResults.length}件）`}</button>
                            )}
                        </>
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
                            className="px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200" />
                        <input placeholder="サブカテ" value={form.subcategory} onChange={e => setForm({ ...form, subcategory: e.target.value })}
                            className="px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200" />
                        <input placeholder="カード番号" value={form.card_number} onChange={e => setForm({ ...form, card_number: e.target.value })}
                            className="px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200" />
                        <input placeholder="レアリティ" value={form.rarity} onChange={e => setForm({ ...form, rarity: e.target.value })}
                            className="px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200" />
                        <input placeholder="販売価格" type="number" value={form.fixed_price} onChange={e => setForm({ ...form, fixed_price: e.target.value })}
                            className="px-4 py-3 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-200" />
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
                        { key: 'noprice' as const, label: '価格未設定' },
                    ].map(f => (
                        <button
                            key={f.key}
                            onClick={() => setStockFilter(f.key)}
                            className={`px-3 md:px-4 py-2 rounded-md text-sm font-bold transition-colors ${stockFilter === f.key
                                ? f.key === 'noprice' ? 'bg-amber-500 text-white' : 'bg-gray-900 text-white'
                                : f.key === 'noprice' ? 'text-amber-600 hover:text-amber-700' : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            {f.label}
                            {f.key === 'noprice' && noPriceCount > 0 && (
                                <span className={`ml-1 text-[10px] px-1.5 py-0.5 rounded-full font-bold ${stockFilter === 'noprice' ? 'bg-white/30' : 'bg-amber-100 text-amber-700'}`}>
                                    {noPriceCount}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {loadError && (
                <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-5 py-4 flex items-center justify-between">
                    <p className="text-sm text-red-600 font-bold">{loadError}</p>
                    <button onClick={() => { setLoading(true); load() }} className="text-sm text-red-500 hover:text-red-700 font-bold">再読み込み</button>
                </div>
            )}

            {loading ? (
                <PosSpinner />
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
                                    <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3.5">予想販売価格</th>
                                    <th className="text-center text-xs font-semibold text-gray-500 px-4 py-3.5">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {filtered.length > 0 ? filtered.map(cat => (
                                    <tr key={cat.id} className="hover:bg-gray-50/50 transition-colors cursor-pointer" onClick={() => router.push(`/pos/catalog/${cat.id}`)}>
                                        <td className="px-5 py-3.5">
                                            <div className="flex items-center gap-3">
                                                <CardThumbnail url={cat.image_url} size="sm" name={cat.name} />
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
                                        <td className="text-right px-4">
                                            {cat.effectivePrice > 0 ? (
                                                <div>
                                                    <span className="text-sm font-medium text-gray-700">{formatPrice(cat.effectivePrice)}</span>
                                                    {cat.priceSource !== 'fixed' && (
                                                        <span className={`block text-[10px] mt-0.5 ${cat.priceSource === 'predicted' ? 'text-purple-500' : 'text-blue-500'}`}>
                                                            {cat.priceSource === 'predicted' ? '予想価格' : '相場価格'}
                                                        </span>
                                                    )}
                                                    {cat.totalQty > 0 && cat.estimatedProfit !== 0 && (
                                                        <span className={`block text-[10px] mt-0.5 font-bold ${cat.estimatedProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                                            利益 {cat.estimatedProfit > 0 ? '+' : ''}{formatPrice(cat.estimatedProfit)}
                                                        </span>
                                                    )}
                                                </div>
                                            ) : cat.totalQty > 0 ? (
                                                <span className="text-xs font-bold text-amber-500">未設定</span>
                                            ) : (
                                                <span className="text-gray-300">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 text-center" onClick={e => e.stopPropagation()}>
                                            <div className="flex items-center gap-1.5 justify-center">
                                                <button onClick={() => router.push(`/pos/purchase?catalog_id=${cat.id}`)} className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors">💰 仕入</button>
                                                {cat.totalQty > 0 && <button onClick={() => router.push(`/pos/sale?catalog_id=${cat.id}`)} className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold hover:bg-green-100 transition-colors">🛒 販売</button>}
                                                <button onClick={() => setDeletingId(cat.id)} className="px-2 py-1.5 bg-gray-50 text-gray-400 rounded-lg text-xs hover:bg-red-50 hover:text-red-500 transition-colors">✕</button>
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
                                    <CardThumbnail url={cat.image_url} size="md" name={cat.name} />
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
                                        {cat.totalQty > 0 && (
                                            <>
                                                <p className="text-xs text-gray-400">{formatPrice(cat.avgCost)}</p>
                                                {cat.effectivePrice > 0 ? (
                                                    <p className={`text-xs font-bold ${cat.priceSource === 'predicted' ? 'text-purple-600' : cat.priceSource === 'market' ? 'text-blue-600' : 'text-green-600'}`}>
                                                        {formatPrice(cat.effectivePrice)}
                                                    </p>
                                                ) : (
                                                    <p className="text-[10px] font-bold text-amber-500 mt-0.5">価格未設定</p>
                                                )}
                                            </>
                                        )}
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
            {/* 削除確認ダイアログ */}
            {deletingId && (
                <div className="fixed inset-0 bg-black/50 z-[60] flex items-end md:items-center justify-center" onClick={() => !deleteSubmitting && setDeletingId(null)}>
                    <div className="bg-white w-full md:max-w-sm md:rounded-xl rounded-t-2xl" onClick={e => e.stopPropagation()}>
                        <div className="p-5 space-y-4">
                            <div className="text-center">
                                <p className="text-base font-bold text-gray-900">カタログを削除しますか？</p>
                                <p className="text-sm text-gray-500 mt-2">この操作は取り消せません。関連する在庫・取引データも影響を受ける可能性があります。</p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setDeletingId(null)}
                                    disabled={deleteSubmitting}
                                    className="flex-1 py-3.5 rounded-xl text-sm font-bold border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                                >キャンセル</button>
                                <button
                                    onClick={handleDelete}
                                    disabled={deleteSubmitting}
                                    className={`flex-1 py-3.5 rounded-xl text-sm font-bold transition-colors ${deleteSubmitting ? 'bg-gray-200 text-gray-400' : 'bg-red-600 text-white hover:bg-red-700'}`}
                                >{deleteSubmitting ? '削除中...' : '削除する'}</button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </PosLayout>
    )
}
