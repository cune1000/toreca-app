'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { use } from 'react'
import PosLayout from '@/components/pos/PosLayout'
import { getCatalog, getInventory, getTransactions, getMarketPrice } from '@/lib/pos/api'
import { formatPrice, getCondition } from '@/lib/pos/constants'
import type { PosCatalog, PosInventory, PosTransaction } from '@/lib/pos/types'

export default function CatalogDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const [catalog, setCatalog] = useState<PosCatalog | null>(null)
    const [inventoryItems, setInventoryItems] = useState<PosInventory[]>([])
    const [transactions, setTransactions] = useState<PosTransaction[]>([])
    const [marketData, setMarketData] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [marketLoading, setMarketLoading] = useState(false)
    const [activeTab, setActiveTab] = useState<'inventory' | 'transactions' | 'market'>('inventory')

    useEffect(() => {
        const load = async () => {
            try {
                const [catRes, invRes, txRes] = await Promise.all([
                    getCatalog(id),
                    getInventory(),
                    getTransactions(),
                ])
                setCatalog(catRes.data)
                // このカタログの在庫のみ
                setInventoryItems(invRes.data.filter((i: PosInventory) => i.catalog_id === id))
                // このカタログの取引のみ
                setTransactions(txRes.data.filter((t: PosTransaction) =>
                    t.inventory?.catalog_id === id
                ))

                // 相場データ取得（api_card_idがある場合）
                if (catRes.data.api_card_id) {
                    setMarketLoading(true)
                    try {
                        const mRes = await getMarketPrice(catRes.data.api_card_id, 30)
                        setMarketData(mRes.data)
                    } catch (e) { console.error('Market data unavailable', e) }
                    finally { setMarketLoading(false) }
                }
            } catch (err) { console.error(err) }
            finally { setLoading(false) }
        }
        load()
    }, [id])

    if (loading) {
        return (
            <PosLayout>
                <div className="py-20 text-center">
                    <div className="inline-block w-8 h-8 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
                </div>
            </PosLayout>
        )
    }

    if (!catalog) {
        return (
            <PosLayout>
                <div className="py-20 text-center text-gray-400">カタログが見つかりません</div>
            </PosLayout>
        )
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
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-6">
                <button onClick={() => router.push('/pos/catalog')} className="hover:text-gray-600">カタログ</button>
                <span>›</span>
                <span className="text-gray-700 font-medium truncate max-w-[300px]">{catalog.name}</span>
            </div>

            {/* ヘッダー: 商品情報 + サマリー */}
            <div className="grid grid-cols-3 gap-6 mb-6">
                {/* 商品情報 */}
                <div className="col-span-1 bg-white border border-gray-200 rounded-xl p-5">
                    <div className="flex flex-col items-center text-center">
                        {catalog.image_url ? (
                            <img src={catalog.image_url} alt="" className="w-32 h-44 object-cover rounded-lg mb-4 shadow-sm" />
                        ) : (
                            <div className="w-32 h-44 bg-gray-100 rounded-lg mb-4 flex items-center justify-center text-4xl">🎴</div>
                        )}
                        <h1 className="text-base font-bold text-gray-900 mb-1">{catalog.name}</h1>
                        <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                            <span>{catalog.category || '-'}</span>
                            <span>·</span>
                            <span>{catalog.rarity || '-'}</span>
                            {catalog.card_number && <><span>·</span><span>{catalog.card_number}</span></>}
                        </div>
                        {catalog.source_type === 'api' ? (
                            <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-500 rounded-full">🔗 API連携</span>
                        ) : (
                            <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-400 rounded-full">独自登録</span>
                        )}
                    </div>
                    <div className="mt-4 pt-4 border-t border-gray-100 space-y-2">
                        <button
                            onClick={() => router.push(`/pos/purchase?catalog_id=${catalog.id}`)}
                            className="w-full py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
                        >💰 仕入れ登録</button>
                        {totalQty > 0 && (
                            <button
                                onClick={() => router.push(`/pos/sale?catalog_id=${catalog.id}`)}
                                className="w-full py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
                            >🛒 販売登録</button>
                        )}
                    </div>
                </div>

                {/* サマリーカード */}
                <div className="col-span-2 grid grid-cols-2 gap-4">
                    <div className="bg-white border border-gray-200 rounded-xl p-5">
                        <p className="text-xs text-gray-400 mb-1">在庫数</p>
                        <p className="text-3xl font-bold text-gray-900">{totalQty}<span className="text-sm text-gray-400 ml-1">点</span></p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-5">
                        <p className="text-xs text-gray-400 mb-1">平均仕入単価</p>
                        <p className="text-3xl font-bold text-gray-900">{formatPrice(avgCost)}</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-5">
                        <p className="text-xs text-gray-400 mb-1">販売設定価格</p>
                        <p className="text-3xl font-bold text-gray-900">{catalog.fixed_price ? formatPrice(catalog.fixed_price) : <span className="text-gray-300">未設定</span>}</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-xl p-5">
                        <p className="text-xs text-gray-400 mb-1">累計利益</p>
                        <p className={`text-3xl font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                            {totalProfit > 0 ? '+' : ''}{formatPrice(totalProfit)}
                        </p>
                    </div>

                    {/* 取引サマリー */}
                    <div className="col-span-2 bg-white border border-gray-200 rounded-xl p-5">
                        <div className="grid grid-cols-4 gap-4 text-center">
                            <div>
                                <p className="text-xs text-gray-400">仕入れ回数</p>
                                <p className="text-lg font-bold text-gray-800">{purchaseTxs.length}回</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400">仕入れ総額</p>
                                <p className="text-lg font-bold text-gray-800">{formatPrice(totalPurchaseAmount)}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400">販売回数</p>
                                <p className="text-lg font-bold text-gray-800">{saleTxs.length}回</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-400">販売総額</p>
                                <p className="text-lg font-bold text-gray-800">{formatPrice(totalSaleAmount)}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* タブ切替 */}
            <div className="flex gap-1 bg-white border border-gray-200 rounded-lg p-1 mb-5 w-fit">
                {[
                    { key: 'inventory' as const, label: '📦 在庫詳細', count: inventoryItems.length },
                    { key: 'transactions' as const, label: '📜 取引履歴', count: transactions.length },
                    { key: 'market' as const, label: '📈 相場情報', count: null },
                ].map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === tab.key ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-700'
                            }`}
                    >
                        {tab.label}
                        {tab.count !== null && <span className="ml-1 text-xs opacity-70">({tab.count})</span>}
                    </button>
                ))}
            </div>

            {/* 在庫詳細タブ */}
            {activeTab === 'inventory' && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/50">
                                <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">状態</th>
                                <th className="text-center text-xs font-medium text-gray-500 px-3 py-3">数量</th>
                                <th className="text-right text-xs font-medium text-gray-500 px-3 py-3">平均仕入単価</th>
                                <th className="text-right text-xs font-medium text-gray-500 px-3 py-3">在庫原価</th>
                                <th className="text-right text-xs font-medium text-gray-500 px-5 py-3">想定利益</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {inventoryItems.length > 0 ? inventoryItems.map(inv => {
                                const cond = getCondition(inv.condition)
                                const invCost = inv.avg_purchase_price * inv.quantity
                                const estProfit = catalog.fixed_price ? (catalog.fixed_price * inv.quantity) - invCost : 0
                                return (
                                    <tr key={inv.id} className="hover:bg-gray-50/50">
                                        <td className="px-5 py-3">
                                            <div className="flex items-center gap-2">
                                                <span
                                                    className="text-xs px-2 py-1 rounded-full text-white font-medium"
                                                    style={{ backgroundColor: cond?.color || '#6b7280' }}
                                                >
                                                    {cond?.name || inv.condition}
                                                </span>
                                                <span className="text-xs text-gray-400">{inv.condition}</span>
                                            </div>
                                        </td>
                                        <td className="text-center text-sm font-bold text-gray-900 px-3">{inv.quantity}</td>
                                        <td className="text-right text-sm text-gray-700 px-3">{formatPrice(inv.avg_purchase_price)}</td>
                                        <td className="text-right text-sm text-gray-700 px-3">{formatPrice(invCost)}</td>
                                        <td className="text-right px-5">
                                            {catalog.fixed_price ? (
                                                <span className={`text-sm font-medium ${estProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                    {estProfit > 0 ? '+' : ''}{formatPrice(estProfit)}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-gray-300">-</span>
                                            )}
                                        </td>
                                    </tr>
                                )
                            }) : (
                                <tr><td colSpan={5} className="text-center py-10 text-sm text-gray-400">在庫がありません</td></tr>
                            )}
                        </tbody>
                        {inventoryItems.length > 0 && (
                            <tfoot>
                                <tr className="border-t border-gray-200 bg-gray-50/80">
                                    <td className="px-5 py-3 text-xs font-bold text-gray-600">合計</td>
                                    <td className="text-center text-sm font-bold text-gray-900 px-3">{totalQty}</td>
                                    <td className="text-right text-sm font-medium text-gray-700 px-3">{formatPrice(avgCost)}</td>
                                    <td className="text-right text-sm font-medium text-gray-700 px-3">{formatPrice(totalCost)}</td>
                                    <td className="text-right px-5">
                                        {catalog.fixed_price ? (
                                            <span className={`text-sm font-bold ${(catalog.fixed_price * totalQty - totalCost) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                {formatPrice(catalog.fixed_price * totalQty - totalCost)}
                                            </span>
                                        ) : '-'}
                                    </td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            )}

            {/* 取引履歴タブ */}
            {activeTab === 'transactions' && (
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-gray-100 bg-gray-50/50">
                                <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">日時</th>
                                <th className="text-center text-xs font-medium text-gray-500 px-3 py-3">種別</th>
                                <th className="text-center text-xs font-medium text-gray-500 px-3 py-3">状態</th>
                                <th className="text-center text-xs font-medium text-gray-500 px-3 py-3">数量</th>
                                <th className="text-right text-xs font-medium text-gray-500 px-3 py-3">単価</th>
                                <th className="text-right text-xs font-medium text-gray-500 px-3 py-3">合計</th>
                                <th className="text-right text-xs font-medium text-gray-500 px-3 py-3">利益</th>
                                <th className="text-left text-xs font-medium text-gray-500 px-5 py-3">メモ</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                            {transactions.length > 0 ? transactions.map(tx => {
                                const cond = getCondition(tx.inventory?.condition || '')
                                return (
                                    <tr key={tx.id} className="hover:bg-gray-50/50">
                                        <td className="px-5 py-3 text-xs text-gray-500">
                                            {new Date(tx.transaction_date).toLocaleDateString('ja-JP')}
                                        </td>
                                        <td className="text-center px-3">
                                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${tx.type === 'purchase'
                                                    ? 'bg-blue-50 text-blue-700'
                                                    : 'bg-green-50 text-green-700'
                                                }`}>
                                                {tx.type === 'purchase' ? '仕入れ' : '販売'}
                                            </span>
                                        </td>
                                        <td className="text-center px-3">
                                            {cond ? (
                                                <span
                                                    className="text-[10px] px-1.5 py-0.5 rounded-full text-white"
                                                    style={{ backgroundColor: cond.color }}
                                                >{cond.name}</span>
                                            ) : (
                                                <span className="text-xs text-gray-400">{tx.inventory?.condition || '-'}</span>
                                            )}
                                        </td>
                                        <td className="text-center text-sm text-gray-700 px-3">{tx.quantity}</td>
                                        <td className="text-right text-sm text-gray-700 px-3">{formatPrice(tx.unit_price)}</td>
                                        <td className="text-right text-sm font-medium text-gray-900 px-3">{formatPrice(tx.total_price)}</td>
                                        <td className="text-right px-3">
                                            {tx.type === 'sale' && tx.profit != null ? (
                                                <span className={`text-sm font-medium ${tx.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                    {tx.profit > 0 ? '+' : ''}{formatPrice(tx.profit)}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-gray-300">-</span>
                                            )}
                                        </td>
                                        <td className="px-5 text-xs text-gray-400 truncate max-w-[150px]">{tx.notes || '-'}</td>
                                    </tr>
                                )
                            }) : (
                                <tr><td colSpan={8} className="text-center py-10 text-sm text-gray-400">取引履歴がありません</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* 相場情報タブ */}
            {activeTab === 'market' && (
                <div>
                    {!catalog.api_card_id ? (
                        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
                            <p className="text-2xl mb-2">🔗</p>
                            <p className="text-sm text-gray-500 mb-1">API連携されていないカタログです</p>
                            <p className="text-xs text-gray-400">API検索からカードを登録すると相場情報が表示されます</p>
                        </div>
                    ) : marketLoading ? (
                        <div className="py-16 text-center">
                            <div className="inline-block w-8 h-8 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
                            <p className="text-sm text-gray-400 mt-3">相場データを取得中...</p>
                        </div>
                    ) : marketData ? (
                        <div className="space-y-4">
                            {/* 相場サマリー */}
                            <div className="grid grid-cols-4 gap-4">
                                <div className="bg-white border border-gray-200 rounded-xl p-5">
                                    <p className="text-xs text-gray-400 mb-1">直近取引価格</p>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {marketData.latestSalePrice ? formatPrice(marketData.latestSalePrice) : '-'}
                                    </p>
                                </div>
                                <div className="bg-white border border-gray-200 rounded-xl p-5">
                                    <p className="text-xs text-gray-400 mb-1">30日平均</p>
                                    <p className="text-2xl font-bold text-gray-900">
                                        {marketData.avgSalePrice ? formatPrice(marketData.avgSalePrice) : '-'}
                                    </p>
                                </div>
                                <div className="bg-white border border-gray-200 rounded-xl p-5">
                                    <p className="text-xs text-gray-400 mb-1">PSA10 平均</p>
                                    <p className="text-2xl font-bold text-purple-600">
                                        {marketData.psa10?.avg ? formatPrice(marketData.psa10.avg) : '-'}
                                    </p>
                                    <p className="text-[10px] text-gray-400 mt-1">{marketData.psa10?.count || 0}件</p>
                                </div>
                                <div className="bg-white border border-gray-200 rounded-xl p-5">
                                    <p className="text-xs text-gray-400 mb-1">買取平均</p>
                                    <p className="text-2xl font-bold text-orange-600">
                                        {marketData.avgPurchasePrice ? formatPrice(marketData.avgPurchasePrice) : '-'}
                                    </p>
                                    <p className="text-[10px] text-gray-400 mt-1">{marketData.purchasesCount || 0}件</p>
                                </div>
                            </div>

                            {/* 利益分析 */}
                            {avgCost > 0 && marketData.latestSalePrice && (
                                <div className="bg-white border border-gray-200 rounded-xl p-5">
                                    <h3 className="text-sm font-bold text-gray-700 mb-3">📊 利益分析（相場 vs 平均仕入）</h3>
                                    <div className="grid grid-cols-3 gap-6">
                                        <div>
                                            <p className="text-xs text-gray-400 mb-1">平均仕入単価</p>
                                            <p className="text-xl font-bold text-gray-900">{formatPrice(avgCost)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-400 mb-1">現在の相場</p>
                                            <p className="text-xl font-bold text-gray-900">{formatPrice(marketData.latestSalePrice)}</p>
                                        </div>
                                        <div>
                                            <p className="text-xs text-gray-400 mb-1">見込み利益/個</p>
                                            {(() => {
                                                const diff = marketData.latestSalePrice - avgCost
                                                const rate = avgCost > 0 ? Math.round(diff / avgCost * 100) : 0
                                                return (
                                                    <div>
                                                        <p className={`text-xl font-bold ${diff >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                            {diff > 0 ? '+' : ''}{formatPrice(diff)}
                                                        </p>
                                                        <p className={`text-xs ${diff >= 0 ? 'text-green-500' : 'text-red-400'}`}>
                                                            ({rate > 0 ? '+' : ''}{rate}%)
                                                        </p>
                                                    </div>
                                                )
                                            })()}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* 直近取引一覧 */}
                            {marketData.recentSales?.length > 0 && (
                                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                                    <div className="px-5 py-3 border-b border-gray-100">
                                        <h3 className="text-sm font-bold text-gray-700">直近のスニダン取引</h3>
                                    </div>
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-gray-50 bg-gray-50/30">
                                                <th className="text-left text-xs font-medium text-gray-400 px-5 py-2">日時</th>
                                                <th className="text-center text-xs font-medium text-gray-400 px-3 py-2">グレード</th>
                                                <th className="text-right text-xs font-medium text-gray-400 px-5 py-2">価格</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-50">
                                            {marketData.recentSales.map((sale: any, i: number) => (
                                                <tr key={i} className="hover:bg-gray-50/30">
                                                    <td className="px-5 py-2.5 text-xs text-gray-500">
                                                        {new Date(sale.date).toLocaleDateString('ja-JP')}
                                                    </td>
                                                    <td className="text-center px-3 text-xs text-gray-600">{sale.grade || '-'}</td>
                                                    <td className="text-right px-5 text-sm font-medium text-gray-900">
                                                        {formatPrice(sale.price)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
                            <p className="text-sm text-gray-400">相場データが見つかりませんでした</p>
                        </div>
                    )}
                </div>
            )}
        </PosLayout>
    )
}
