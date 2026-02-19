'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { use } from 'react'
import PosLayout from '@/components/pos/PosLayout'
import TransactionEditModal from '@/components/pos/TransactionEditModal'
import TransactionDeleteDialog from '@/components/pos/TransactionDeleteDialog'
import CatalogEditModal from '@/components/pos/CatalogEditModal'
import { getCatalog, getInventory, getTransactions, refreshMarketPrices, updateInventoryPrice } from '@/lib/pos/api'
import { formatPrice, getCondition } from '@/lib/pos/constants'
import type { PosCatalog, PosInventory, PosTransaction } from '@/lib/pos/types'

export default function CatalogDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const [catalog, setCatalog] = useState<PosCatalog | null>(null)
    const [inventoryItems, setInventoryItems] = useState<PosInventory[]>([])
    const [transactions, setTransactions] = useState<PosTransaction[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState<'inventory' | 'transactions'>('inventory')
    const [editingTx, setEditingTx] = useState<PosTransaction | null>(null)
    const [deletingTx, setDeletingTx] = useState<PosTransaction | null>(null)
    const [editingPriceId, setEditingPriceId] = useState<string | null>(null)
    const [priceInput, setPriceInput] = useState('')
    const [refreshing, setRefreshing] = useState(false)
    const [showCatalogEdit, setShowCatalogEdit] = useState(false)

    const loadData = async () => {
        try {
            const [catRes, invRes, txRes] = await Promise.all([
                getCatalog(id),
                getInventory({ catalog_id: id }),
                getTransactions({ catalog_id: id }),
            ])
            setCatalog(catRes.data)
            setInventoryItems(invRes.data)
            setTransactions(txRes.data)
        } catch (err) { console.error(err) }
        finally { setLoading(false) }
    }

    useEffect(() => { loadData() }, [id])

    const reload = () => { loadData() }

    const handleRefreshMarket = async () => {
        setRefreshing(true)
        try {
            await refreshMarketPrices()
            await loadData()
        } catch (err) { console.error(err) }
        finally { setRefreshing(false) }
    }

    const handleSavePredictedPrice = async (invId: string) => {
        try {
            const val = priceInput.trim() === '' ? null : parseInt(priceInput) || 0
            await updateInventoryPrice(invId, val)
            setInventoryItems(prev => prev.map(i => i.id === invId ? { ...i, predicted_price: val } : i))
        } catch (err) { console.error(err) }
        setEditingPriceId(null)
        setPriceInput('')
    }

    if (loading) {
        return <PosLayout><div className="py-20 text-center"><div className="inline-block w-8 h-8 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" /></div></PosLayout>
    }

    if (!catalog) {
        return <PosLayout><div className="py-20 text-center text-gray-400">カタログが見つかりません</div></PosLayout>
    }

    const totalQty = inventoryItems.reduce((s, i) => s + i.quantity, 0)
    const totalCost = inventoryItems.reduce((s, i) => s + i.avg_purchase_price * i.quantity, 0)
    const avgCost = totalQty > 0 ? Math.round(totalCost / totalQty) : 0

    const purchaseTxs = transactions.filter(t => t.type === 'purchase')
    const saleTxs = transactions.filter(t => t.type === 'sale')
    const totalPurchaseAmount = purchaseTxs.reduce((s, t) => s + t.total_price, 0)
    const totalSaleAmount = saleTxs.reduce((s, t) => s + t.total_price, 0)
    const totalProfit = saleTxs.reduce((s, t) => s + (t.profit || 0), 0)

    return (
        <PosLayout>
            {/* ブレッドクラム */}
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-4 md:mb-6">
                <button onClick={() => router.push('/pos/catalog')} className="hover:text-gray-600">カタログ</button>
                <span>›</span>
                <span className="text-gray-700 font-medium truncate">{catalog.name}</span>
            </div>

            {/* ヘッダー: 商品情報 + サマリー */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
                {/* 商品情報 */}
                <div className="bg-white border border-gray-200 rounded-xl p-5 md:p-6">
                    <div className="flex md:flex-col items-center md:text-center gap-4 md:gap-0">
                        {catalog.image_url ? (
                            <img src={catalog.image_url} alt="" className="w-20 h-28 md:w-36 md:h-48 object-cover rounded-lg md:mb-4 shadow-sm flex-shrink-0" />
                        ) : (
                            <div className="w-20 h-28 md:w-36 md:h-48 bg-gray-100 rounded-lg md:mb-4 flex items-center justify-center text-3xl md:text-4xl flex-shrink-0">🎴</div>
                        )}
                        <div className="flex-1 md:flex-none">
                            <h1 className="text-base md:text-lg font-bold text-gray-900 md:mb-2">{catalog.name}</h1>
                            <div className="flex items-center gap-2 text-xs md:text-sm text-gray-400 mt-1 md:mb-3">
                                <span>{catalog.category || '-'}</span>
                                <span>·</span>
                                <span>{catalog.rarity || '-'}</span>
                                {catalog.card_number && <><span>·</span><span>{catalog.card_number}</span></>}
                            </div>
                            <div className="flex items-center gap-2 mt-2 md:mt-0">
                                {catalog.source_type === 'api' ? (
                                    <span className="text-xs px-2.5 py-1 bg-blue-50 text-blue-500 rounded-full">🔗 API連携</span>
                                ) : (
                                    <span className="text-xs px-2.5 py-1 bg-gray-100 text-gray-400 rounded-full">独自登録</span>
                                )}
                                <button
                                    onClick={() => setShowCatalogEdit(true)}
                                    className="text-xs px-2.5 py-1 bg-gray-100 text-gray-500 rounded-full hover:bg-gray-200 transition-colors"
                                >✏️ 編集</button>
                            </div>
                        </div>
                    </div>
                    <div className="mt-4 md:mt-5 pt-4 md:pt-5 border-t border-gray-100 space-y-2.5">
                        {catalog.api_card_id && (
                            <button
                                onClick={handleRefreshMarket}
                                disabled={refreshing}
                                className="w-full py-2.5 bg-purple-50 text-purple-700 rounded-lg text-sm font-bold hover:bg-purple-100 transition-colors disabled:opacity-50"
                            >{refreshing ? '更新中...' : '📈 相場更新'}</button>
                        )}
                        <div className="flex md:flex-col gap-2 md:space-y-2.5">
                            <button
                                onClick={() => router.push(`/pos/purchase?catalog_id=${catalog.id}`)}
                                className="flex-1 md:w-full py-2.5 md:py-3 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
                            >💰 仕入れ</button>
                            {totalQty > 0 && (
                                <button
                                    onClick={() => router.push(`/pos/sale?catalog_id=${catalog.id}`)}
                                    className="flex-1 md:w-full py-2.5 md:py-3 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition-colors"
                                >🛒 販売</button>
                            )}
                        </div>
                    </div>
                </div>

                {/* サマリーカード */}
                <div className="md:col-span-2 grid grid-cols-2 gap-3 md:gap-4">
                    <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6">
                        <p className="text-xs md:text-sm text-gray-400 mb-1">在庫数</p>
                        <p className="text-2xl md:text-3xl font-bold text-gray-900">{totalQty}<span className="text-sm md:text-base text-gray-400 ml-1">点</span></p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6">
                        <p className="text-xs md:text-sm text-gray-400 mb-1">平均仕入単価</p>
                        <p className="text-2xl md:text-3xl font-bold text-gray-900">{formatPrice(avgCost)}</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6">
                        <p className="text-xs md:text-sm text-gray-400 mb-1">販売設定価格</p>
                        <p className="text-2xl md:text-3xl font-bold text-gray-900">{catalog.fixed_price ? formatPrice(catalog.fixed_price) : <span className="text-gray-300 text-lg">未設定</span>}</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-6">
                        <p className="text-xs md:text-sm text-gray-400 mb-1">累計利益</p>
                        <p className={`text-2xl md:text-3xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {totalProfit > 0 ? '+' : ''}{formatPrice(totalProfit)}
                        </p>
                    </div>

                    {/* 取引サマリー */}
                    <div className="col-span-2 bg-white border border-gray-200 rounded-xl p-4 md:p-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 text-center">
                            <div>
                                <p className="text-xs md:text-sm text-gray-400">仕入れ回数</p>
                                <p className="text-lg md:text-xl font-bold text-gray-800">{purchaseTxs.length}回</p>
                            </div>
                            <div>
                                <p className="text-xs md:text-sm text-gray-400">仕入れ総額</p>
                                <p className="text-lg md:text-xl font-bold text-gray-800">{formatPrice(totalPurchaseAmount)}</p>
                            </div>
                            <div>
                                <p className="text-xs md:text-sm text-gray-400">販売回数</p>
                                <p className="text-lg md:text-xl font-bold text-gray-800">{saleTxs.length}回</p>
                            </div>
                            <div>
                                <p className="text-xs md:text-sm text-gray-400">販売総額</p>
                                <p className="text-lg md:text-xl font-bold text-gray-800">{formatPrice(totalSaleAmount)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* タブ切替 */}
            <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1 mb-4 md:mb-6 w-full md:w-fit">
                {[
                    { key: 'inventory' as const, label: '📦 在庫詳細', count: inventoryItems.length },
                    { key: 'transactions' as const, label: '📜 取引履歴', count: transactions.length },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex-1 md:flex-none px-4 md:px-6 py-2.5 md:py-3 rounded-md text-sm font-bold transition-colors ${activeTab === tab.key ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        {tab.label}
                        <span className="ml-1 text-xs opacity-70">({tab.count})</span>
                    </button>
                ))}
            </div>

            {/* 在庫詳細タブ */}
            {activeTab === 'inventory' && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    {/* デスクトップテーブル */}
                    <table className="w-full hidden md:table">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/50">
                                <th className="text-left text-xs font-semibold text-gray-500 px-6 py-3.5">状態</th>
                                <th className="text-center text-xs font-semibold text-gray-500 px-4 py-3.5">数量</th>
                                <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3.5">仕入単価</th>
                                <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3.5">相場</th>
                                <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3.5">予測価格</th>
                                <th className="text-right text-xs font-semibold text-gray-500 px-6 py-3.5">想定利益</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {inventoryItems.length > 0 ? inventoryItems.map(inv => {
                                const cond = getCondition(inv.condition)
                                const invCost = inv.avg_purchase_price * inv.quantity
                                const effectivePrice = inv.predicted_price ?? inv.market_price ?? catalog.fixed_price
                                const estProfit = effectivePrice ? (effectivePrice * inv.quantity) - invCost : 0
                                return (
                                    <tr key={inv.id} className="hover:bg-gray-50/50">
                                        <td className="px-6 py-4"><span className="text-xs px-3 py-1.5 rounded-full text-white font-bold" style={{ backgroundColor: cond?.color || '#6b7280' }}>{inv.condition}</span></td>
                                        <td className="text-center text-base font-bold text-gray-900 px-4">{inv.quantity}</td>
                                        <td className="text-right text-sm text-gray-700 px-4">{formatPrice(inv.avg_purchase_price)}</td>
                                        <td className="text-right px-4">
                                            {inv.market_price ? (
                                                <span className="text-sm font-bold text-purple-600">{formatPrice(inv.market_price)}</span>
                                            ) : <span className="text-xs text-gray-300">-</span>}
                                        </td>
                                        <td className="text-right px-4">
                                            {editingPriceId === inv.id ? (
                                                <div className="flex items-center justify-end gap-1">
                                                    <input
                                                        type="number"
                                                        value={priceInput}
                                                        onChange={e => setPriceInput(e.target.value)}
                                                        onKeyDown={e => { if (e.key === 'Enter') handleSavePredictedPrice(inv.id); if (e.key === 'Escape') { setEditingPriceId(null); setPriceInput('') } }}
                                                        className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:border-blue-400"
                                                        placeholder="0"
                                                        autoFocus
                                                    />
                                                    <button onClick={() => handleSavePredictedPrice(inv.id)} className="p-1 text-blue-600 hover:bg-blue-50 rounded text-xs font-bold">OK</button>
                                                    <button onClick={() => { setEditingPriceId(null); setPriceInput('') }} className="p-1 text-gray-400 hover:bg-gray-50 rounded text-xs">✕</button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => { setEditingPriceId(inv.id); setPriceInput(inv.predicted_price != null ? String(inv.predicted_price) : '') }}
                                                    className="text-sm hover:bg-gray-50 rounded px-2 py-1 transition-colors"
                                                >
                                                    {inv.predicted_price != null ? (
                                                        <span className="font-bold text-blue-600">{formatPrice(inv.predicted_price)}</span>
                                                    ) : (
                                                        <span className="text-gray-300 text-xs">設定</span>
                                                    )}
                                                </button>
                                            )}
                                        </td>
                                        <td className="text-right px-6">{effectivePrice ? <span className={`text-sm font-bold ${estProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{estProfit > 0 ? '+' : ''}{formatPrice(estProfit)}</span> : <span className="text-xs text-gray-300">-</span>}</td>
                                    </tr>
                                )
                            }) : (
                                <tr><td colSpan={6} className="text-center py-12 text-sm text-gray-400">在庫がありません</td></tr>
                            )}
                        </tbody>
                    </table>

                    {/* モバイルカード */}
                    <div className="md:hidden divide-y divide-gray-50">
                        {inventoryItems.length > 0 ? inventoryItems.map(inv => {
                            const cond = getCondition(inv.condition)
                            const invCost = inv.avg_purchase_price * inv.quantity
                            const effectivePrice = inv.predicted_price ?? inv.market_price ?? catalog.fixed_price
                            const estProfit = effectivePrice ? (effectivePrice * inv.quantity) - invCost : 0
                            return (
                                <div key={inv.id} className="px-4 py-3.5">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs px-2.5 py-1 rounded-full text-white font-bold" style={{ backgroundColor: cond?.color || '#6b7280' }}>{inv.condition}</span>
                                        <span className="text-lg font-bold text-gray-900">{inv.quantity}個</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                                        <div>
                                            <span className="text-gray-400">仕入</span>
                                            <p className="text-sm font-bold text-gray-700">{formatPrice(inv.avg_purchase_price)}</p>
                                        </div>
                                        <div>
                                            <span className="text-gray-400">相場</span>
                                            <p className="text-sm font-bold text-purple-600">{inv.market_price ? formatPrice(inv.market_price) : '-'}</p>
                                        </div>
                                        <div>
                                            <span className="text-gray-400">予測</span>
                                            {editingPriceId === inv.id ? (
                                                <div className="flex items-center gap-1 mt-0.5">
                                                    <input
                                                        type="number"
                                                        value={priceInput}
                                                        onChange={e => setPriceInput(e.target.value)}
                                                        onKeyDown={e => { if (e.key === 'Enter') handleSavePredictedPrice(inv.id); if (e.key === 'Escape') { setEditingPriceId(null); setPriceInput('') } }}
                                                        className="w-16 px-1.5 py-0.5 border border-gray-300 rounded text-xs text-right focus:outline-none"
                                                        autoFocus
                                                    />
                                                    <button onClick={() => handleSavePredictedPrice(inv.id)} className="text-blue-600 text-xs font-bold">OK</button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => { setEditingPriceId(inv.id); setPriceInput(inv.predicted_price != null ? String(inv.predicted_price) : '') }}
                                                    className="text-sm font-bold text-blue-600"
                                                >
                                                    {inv.predicted_price != null ? formatPrice(inv.predicted_price) : <span className="text-gray-300 text-xs">設定</span>}
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    {effectivePrice && (
                                        <div className="flex items-center justify-between text-sm pt-1 border-t border-gray-50">
                                            <span className="text-gray-400 text-xs">想定利益</span>
                                            <span className={`font-bold ${estProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{estProfit > 0 ? '+' : ''}{formatPrice(estProfit)}</span>
                                        </div>
                                    )}
                                </div>
                            )
                        }) : (
                            <p className="text-center py-12 text-sm text-gray-400">在庫がありません</p>
                        )}
                    </div>
                </div>
            )}

            {/* 取引履歴タブ */}
            {activeTab === 'transactions' && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    {/* デスクトップテーブル */}
                    <table className="w-full hidden md:table">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/50">
                                <th className="text-left text-xs font-semibold text-gray-500 px-6 py-3.5">日時</th>
                                <th className="text-center text-xs font-semibold text-gray-500 px-4 py-3.5">種別</th>
                                <th className="text-center text-xs font-semibold text-gray-500 px-4 py-3.5">状態</th>
                                <th className="text-center text-xs font-semibold text-gray-500 px-4 py-3.5">数量</th>
                                <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3.5">単価</th>
                                <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3.5">合計</th>
                                <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3.5">利益</th>
                                <th className="text-center text-xs font-semibold text-gray-500 px-4 py-3.5">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {transactions.length > 0 ? transactions.map(tx => {
                                const cond = getCondition(tx.inventory?.condition || '')
                                return (
                                    <tr key={tx.id} className="hover:bg-gray-50/50">
                                        <td className="px-6 py-3.5 text-sm text-gray-500">{new Date(tx.transaction_date).toLocaleDateString('ja-JP')}</td>
                                        <td className="text-center px-4"><span className={`text-xs px-2.5 py-1 rounded-full font-bold ${tx.type === 'purchase' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>{tx.type === 'purchase' ? '仕入れ' : '販売'}</span></td>
                                        <td className="text-center px-4"><span className="text-xs px-2.5 py-1 rounded-full text-white font-bold" style={{ backgroundColor: cond?.color || '#6b7280' }}>{tx.inventory?.condition || '-'}</span></td>
                                        <td className="text-center text-sm text-gray-700 px-4">{tx.quantity}</td>
                                        <td className="text-right text-sm text-gray-700 px-4">{formatPrice(tx.unit_price)}</td>
                                        <td className="text-right text-sm font-bold text-gray-900 px-4">{formatPrice(tx.total_price)}</td>
                                        <td className="text-right px-4">{tx.type === 'sale' && tx.profit != null ? <span className={`text-sm font-bold ${tx.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{tx.profit > 0 ? '+' : ''}{formatPrice(tx.profit)}</span> : <span className="text-xs text-gray-300">-</span>}</td>
                                        <td className="text-center px-4">
                                            <div className="flex items-center justify-center gap-1">
                                                <button
                                                    onClick={() => setEditingTx(tx)}
                                                    className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                    title="編集"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                                </button>
                                                <button
                                                    onClick={() => setDeletingTx(tx)}
                                                    className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                    title="削除"
                                                >
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            }) : (
                                <tr><td colSpan={8} className="text-center py-12 text-sm text-gray-400">取引履歴がありません</td></tr>
                            )}
                        </tbody>
                    </table>

                    {/* モバイルカード */}
                    <div className="md:hidden divide-y divide-gray-50">
                        {transactions.length > 0 ? transactions.map(tx => {
                            const cond = getCondition(tx.inventory?.condition || '')
                            return (
                                <div key={tx.id} className="px-4 py-3.5">
                                    <div className="flex items-center justify-between mb-1.5">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${tx.type === 'purchase' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>{tx.type === 'purchase' ? '仕入れ' : '販売'}</span>
                                            <span className="text-xs px-1.5 py-0.5 rounded text-white font-bold" style={{ backgroundColor: cond?.color || '#6b7280' }}>{tx.inventory?.condition || '-'}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span className="text-xs text-gray-400">{new Date(tx.transaction_date).toLocaleDateString('ja-JP')}</span>
                                            <button
                                                onClick={() => setEditingTx(tx)}
                                                className="p-1 text-gray-400 hover:text-blue-600 rounded"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                            </button>
                                            <button
                                                onClick={() => setDeletingTx(tx)}
                                                className="p-1 text-gray-400 hover:text-red-600 rounded"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between mt-1">
                                        <span className="text-xs text-gray-500">{tx.quantity}個 × {formatPrice(tx.unit_price)}</span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold text-gray-900">{formatPrice(tx.total_price)}</span>
                                            {tx.type === 'sale' && tx.profit != null && <span className={`text-xs font-bold ${tx.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>{tx.profit > 0 ? '+' : ''}{formatPrice(tx.profit)}</span>}
                                        </div>
                                    </div>
                                    {tx.notes && <p className="text-xs text-gray-400 mt-1">{tx.notes}</p>}
                                </div>
                            )
                        }) : (
                            <p className="text-center py-12 text-sm text-gray-400">取引履歴がありません</p>
                        )}
                    </div>
                </div>
            )}

            {/* カタログ編集モーダル */}
            {showCatalogEdit && catalog && (
                <CatalogEditModal
                    catalog={catalog}
                    onClose={() => setShowCatalogEdit(false)}
                    onSaved={(updated) => { setCatalog(updated); setShowCatalogEdit(false) }}
                />
            )}

            {/* 取引編集モーダル */}
            {editingTx && (
                <TransactionEditModal
                    transaction={editingTx}
                    onClose={() => setEditingTx(null)}
                    onSaved={() => { setEditingTx(null); reload() }}
                />
            )}

            {/* 削除ダイアログ */}
            {deletingTx && (
                <TransactionDeleteDialog
                    transaction={deletingTx}
                    onClose={() => setDeletingTx(null)}
                    onDeleted={() => { setDeletingTx(null); reload() }}
                />
            )}
        </PosLayout>
    )
}
