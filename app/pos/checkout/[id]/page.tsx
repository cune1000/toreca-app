'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import PosLayout from '@/components/pos/PosLayout'
import PosSpinner from '@/components/pos/PosSpinner'
import CardThumbnail from '@/components/pos/CardThumbnail'
import CheckoutAddItemModal from '@/components/pos/CheckoutAddItemModal'
import CheckoutReturnModal from '@/components/pos/CheckoutReturnModal'
import CheckoutSellModal from '@/components/pos/CheckoutSellModal'
import CheckoutConvertModal from '@/components/pos/CheckoutConvertModal'
import { getCheckoutFolder, updateCheckoutFolder, deleteCheckoutFolder, cancelCheckoutItem, undoCheckoutItem, returnCheckoutItem } from '@/lib/pos/api'
import { formatPrice, getCondition } from '@/lib/pos/constants'
import { getErrorMessage } from '@/lib/pos/utils'
import type { PosCheckoutFolderDetail, PosCheckoutItem } from '@/lib/pos/types'

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    pending: { label: '保留中', color: 'bg-amber-100 text-amber-700' },
    returned: { label: '返却済', color: 'bg-blue-100 text-blue-700' },
    sold: { label: '売却済', color: 'bg-green-100 text-green-700' },
    converted: { label: '変換済', color: 'bg-purple-100 text-purple-700' },
}

export default function CheckoutFolderPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const router = useRouter()
    const [folder, setFolder] = useState<PosCheckoutFolderDetail | null>(null)
    const [loading, setLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState<string>('all')
    const [showAddModal, setShowAddModal] = useState(false)
    const [returnItem, setReturnItem] = useState<PosCheckoutItem | null>(null)
    const [sellItem, setSellItem] = useState<PosCheckoutItem | null>(null)
    const [convertItem, setConvertItem] = useState<PosCheckoutItem | null>(null)
    const [editing, setEditing] = useState(false)
    const [editName, setEditName] = useState('')
    const [editDesc, setEditDesc] = useState('')
    const [undoing, setUndoing] = useState<string | null>(null)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
    const [bulkProcessing, setBulkProcessing] = useState(false)

    const loadFolder = () => {
        setLoading(true)
        getCheckoutFolder(id)
            .then(r => setFolder(r.data))
            .catch(console.error)
            .finally(() => setLoading(false))
    }

    useEffect(() => { loadFolder() }, [id])

    const handleSaveEdit = async () => {
        if (!editName.trim() || !folder) return
        try {
            await updateCheckoutFolder(folder.id, { name: editName.trim(), description: editDesc.trim() || undefined })
            setEditing(false)
            loadFolder()
        } catch (err) { console.error(err) }
    }

    const handleClose = async () => {
        if (!folder) return
        if (folder.pending_count && folder.pending_count > 0) {
            alert('未解決のアイテムがあるためクローズできません')
            return
        }
        await updateCheckoutFolder(folder.id, { status: 'closed' })
        loadFolder()
    }

    const handleReopen = async () => {
        if (!folder) return
        await updateCheckoutFolder(folder.id, { status: 'open' })
        loadFolder()
    }

    const handleDelete = async () => {
        if (!folder) return
        if (!confirm('このフォルダを削除しますか？')) return
        try {
            await deleteCheckoutFolder(folder.id)
            router.push('/pos/checkout')
        } catch (err) {
            alert(getErrorMessage(err))
        }
    }

    const handleCancel = async (item: PosCheckoutItem) => {
        if (!confirm(`この持ち出しを取消しますか？\n\n${item.inventory?.catalog?.name || ''}\n${item.quantity}点 → 在庫に戻してフォルダから削除されます`)) return
        setUndoing(item.id)
        try {
            await cancelCheckoutItem(item.id)
            loadFolder()
        } catch (err) {
            alert(getErrorMessage(err))
        } finally {
            setUndoing(null)
        }
    }

    const handleUndo = async (item: PosCheckoutItem) => {
        const labels: Record<string, string> = { returned: '返却', sold: '売却', converted: '変換' }
        const label = labels[item.status] || item.status
        if (!confirm(`${label}を取り消して「保留中」に戻しますか？\n\n※ ${item.status === 'returned' ? '在庫が再び減ります' : item.status === 'converted' ? '変換先の在庫が巻き戻されます' : '売却の取引記録が削除されます'}`)) return
        setUndoing(item.id)
        try {
            await undoCheckoutItem(item.id)
            loadFolder()
        } catch (err) {
            alert(getErrorMessage(err))
        } finally {
            setUndoing(null)
        }
    }

    const toggleSelect = (itemId: string) => {
        setSelectedIds(prev => {
            const next = new Set(prev)
            next.has(itemId) ? next.delete(itemId) : next.add(itemId)
            return next
        })
    }

    const toggleSelectAll = () => {
        if (!folder) return
        const items = folder.items.filter(i => statusFilter === 'all' || i.status === statusFilter)
        const pendingIds = items.filter(i => i.status === 'pending').map(i => i.id)
        const allSelected = pendingIds.every(id => selectedIds.has(id))
        setSelectedIds(allSelected ? new Set() : new Set(pendingIds))
    }

    const handleBulkReturn = async () => {
        if (!confirm(`選択した${selectedIds.size}件を一括返却しますか？`)) return
        setBulkProcessing(true)
        try {
            for (const itemId of selectedIds) {
                await returnCheckoutItem(itemId)
            }
            setSelectedIds(new Set())
            loadFolder()
        } catch (err) {
            alert(getErrorMessage(err))
        } finally {
            setBulkProcessing(false)
        }
    }

    const handleBulkSell = () => {
        // 一括売却は全アイテム同じ単価で処理 — 最初の1つをモーダルで開く
        const items = folder?.items.filter(i => selectedIds.has(i.id)) || []
        if (items.length > 0) setSellItem(items[0])
    }

    const handleBulkConvert = () => {
        const items = folder?.items.filter(i => selectedIds.has(i.id)) || []
        if (items.length > 0) setConvertItem(items[0])
    }

    if (loading) return <PosLayout><PosSpinner /></PosLayout>
    if (!folder) return <PosLayout><p className="text-center py-12 text-gray-400">フォルダが見つかりません</p></PosLayout>

    const filteredItems = folder.items.filter(i => statusFilter === 'all' || i.status === statusFilter)
    const pendingItems = folder.items.filter(i => i.status === 'pending')
    const returnedItems = folder.items.filter(i => i.status === 'returned')
    const soldItems = folder.items.filter(i => i.status === 'sold')
    const convertedItems = folder.items.filter(i => i.status === 'converted')
    const lockedAmount = pendingItems.reduce((sum, i) => sum + i.unit_cost * i.quantity, 0)
    const totalSaleRevenue = soldItems.reduce((sum, i) => sum + (i.sale_unit_price ?? 0) * i.quantity, 0)
    const totalSaleProfit = soldItems.reduce((sum, i) => sum + (i.sale_profit ?? 0), 0)
    const totalSaleExpenses = soldItems.reduce((sum, i) => sum + (i.sale_expenses ?? 0), 0)
    const totalConvertExpenses = convertedItems.reduce((sum, i) => sum + (i.converted_expenses ?? 0), 0)
    const resolvedCount = returnedItems.length + soldItems.length + convertedItems.length
    const hasResults = resolvedCount > 0

    return (
        <PosLayout>
            {/* ブレッドクラム */}
            <div className="flex items-center gap-2 text-sm text-gray-400 mb-4">
                <button onClick={() => router.push('/pos/checkout')} className="hover:text-gray-600">持ち出し</button>
                <span>›</span>
                <span className="text-gray-700 font-bold truncate">{folder.name}</span>
            </div>

            {/* ヘッダー */}
            <div className="bg-white border border-gray-200 rounded-xl p-4 md:p-5 mb-4">
                {editing ? (
                    <div className="space-y-3">
                        <input
                            type="text" value={editName} onChange={e => setEditName(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400"
                        />
                        <input
                            type="text" value={editDesc} onChange={e => setEditDesc(e.target.value)}
                            placeholder="メモ（任意）"
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400"
                        />
                        <div className="flex gap-2">
                            <button onClick={handleSaveEdit} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold">保存</button>
                            <button onClick={() => setEditing(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm font-bold text-gray-600">キャンセル</button>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-start justify-between">
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg font-bold text-gray-900">{folder.name}</h1>
                                {folder.status === 'closed' && (
                                    <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-bold">完了</span>
                                )}
                            </div>
                            {folder.description && <p className="text-sm text-gray-500 mt-1">{folder.description}</p>}
                            <p className="text-xs text-gray-400 mt-1">{new Date(folder.created_at).toLocaleDateString('ja-JP')} 作成</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => { setEditing(true); setEditName(folder.name); setEditDesc(folder.description || '') }}
                                className="p-2 text-gray-400 hover:text-gray-600"
                            >✏️</button>
                            {folder.status === 'open' && pendingItems.length === 0 && folder.items.length > 0 && (
                                <button onClick={handleClose} className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold hover:bg-green-100">完了</button>
                            )}
                            {folder.status === 'closed' && (
                                <button onClick={handleReopen} className="px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-xs font-bold hover:bg-gray-100">再開</button>
                            )}
                            {pendingItems.length === 0 && (
                                <button onClick={handleDelete} className="p-2 text-gray-400 hover:text-red-500">🗑️</button>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* サマリー */}
            {pendingItems.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-amber-600 font-bold">資金ロック</p>
                            <p className="text-xl font-bold text-amber-700">{formatPrice(lockedAmount)}</p>
                        </div>
                        <p className="text-sm text-amber-600">{pendingItems.length}点 保留中 / {folder.items.length}点</p>
                    </div>
                </div>
            )}

            {/* 損益サマリー */}
            {hasResults && (
                <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
                    <p className="text-sm font-bold text-gray-700 mb-3">結果サマリー</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                        {soldItems.length > 0 && (
                            <div>
                                <p className="text-xs text-gray-400">売却収入</p>
                                <p className="text-base font-bold text-gray-800">{formatPrice(totalSaleRevenue)}</p>
                            </div>
                        )}
                        {soldItems.length > 0 && (
                            <div>
                                <p className="text-xs text-gray-400">売却利益</p>
                                <p className={`text-base font-bold ${totalSaleProfit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                    {totalSaleProfit > 0 ? '+' : ''}{formatPrice(totalSaleProfit)}
                                </p>
                            </div>
                        )}
                        {(totalSaleExpenses > 0 || totalConvertExpenses > 0) && (
                            <div>
                                <p className="text-xs text-gray-400">総経費</p>
                                <p className="text-base font-bold text-orange-600">{formatPrice(totalSaleExpenses + totalConvertExpenses)}</p>
                            </div>
                        )}
                        <div>
                            <p className="text-xs text-gray-400">解決状況</p>
                            <div className="flex items-center justify-center gap-1.5 mt-1">
                                {returnedItems.length > 0 && <span className="text-xs px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-bold">{returnedItems.length}返却</span>}
                                {soldItems.length > 0 && <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded font-bold">{soldItems.length}売却</span>}
                                {convertedItems.length > 0 && <span className="text-xs px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded font-bold">{convertedItems.length}変換</span>}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* カード追加ボタン */}
            {folder.status === 'open' && (
                <button
                    onClick={() => setShowAddModal(true)}
                    className="w-full py-4 border-2 border-dashed border-gray-300 rounded-xl text-sm font-bold text-gray-500 hover:border-gray-400 hover:text-gray-600 transition-colors mb-4"
                >+ カードを追加</button>
            )}

            {/* ステータスフィルタ */}
            {folder.items.length > 0 && (
                <div className="flex gap-2 mb-4 overflow-x-auto">
                    {[['all', 'すべて'], ['pending', '保留中'], ['returned', '返却済'], ['sold', '売却済'], ['converted', '変換済']].map(([key, label]) => (
                        <button
                            key={key}
                            onClick={() => setStatusFilter(key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${statusFilter === key ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                        >{label}</button>
                    ))}
                </div>
            )}

            {/* 一括操作バー */}
            {pendingItems.length > 1 && folder.status === 'open' && (
                <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <button
                        onClick={toggleSelectAll}
                        className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-xs font-bold text-gray-600 hover:bg-gray-50"
                    >{selectedIds.size > 0 && pendingItems.every(i => selectedIds.has(i.id)) ? '選択解除' : '全選択'}</button>
                    {selectedIds.size > 0 && (
                        <>
                            <span className="text-xs text-gray-500">{selectedIds.size}件選択中</span>
                            <button
                                onClick={handleBulkReturn}
                                disabled={bulkProcessing}
                                className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100 disabled:opacity-50"
                            >{bulkProcessing ? '処理中...' : '一括返却'}</button>
                            <button
                                onClick={handleBulkSell}
                                disabled={bulkProcessing}
                                className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold hover:bg-green-100 disabled:opacity-50"
                            >一括売却</button>
                            <button
                                onClick={handleBulkConvert}
                                disabled={bulkProcessing}
                                className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs font-bold hover:bg-purple-100 disabled:opacity-50"
                            >一括変換</button>
                        </>
                    )}
                </div>
            )}

            {/* アイテムリスト */}
            {filteredItems.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                    <p className="text-gray-400 text-sm">
                        {folder.items.length === 0 ? '「+ カードを追加」からカードを持ち出してください' : '該当するアイテムはありません'}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredItems.map(item => {
                        const st = STATUS_LABELS[item.status] || STATUS_LABELS.pending
                        const cond = getCondition(item.inventory?.condition || '')
                        return (
                            <div key={item.id} className={`bg-white border rounded-xl p-4 ${selectedIds.has(item.id) ? 'border-blue-400 bg-blue-50/30' : 'border-gray-200'}`}>
                                <div className="flex gap-3">
                                    {item.status === 'pending' && pendingItems.length > 1 && folder.status === 'open' && (
                                        <label className="flex items-start pt-1 cursor-pointer flex-shrink-0">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(item.id)}
                                                onChange={() => toggleSelect(item.id)}
                                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                        </label>
                                    )}
                                    <CardThumbnail
                                        url={item.inventory?.catalog?.image_url}
                                        name={item.inventory?.catalog?.name || ''}
                                        size="sm"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${st.color}`}>{st.label}</span>
                                            <span className="px-2 py-0.5 rounded text-xs font-bold" style={{ backgroundColor: `${cond.color}20`, color: cond.color }}>
                                                {item.inventory?.condition}
                                            </span>
                                        </div>
                                        <p className="text-sm font-bold text-gray-800 truncate">{item.inventory?.catalog?.name || '-'}</p>
                                        <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                                            <span>{item.quantity}点</span>
                                            <span>原価 {formatPrice(item.unit_cost)}/個</span>
                                            <span className="font-bold text-amber-600">{formatPrice(item.unit_cost * item.quantity)}</span>
                                        </div>

                                        {/* 解決済み情報 */}
                                        {item.status === 'sold' && item.sale_unit_price != null && (
                                            <div className="mt-2 pt-2 border-t border-gray-100 text-xs">
                                                <span className="text-gray-500">売値 {formatPrice(item.sale_unit_price)}/個</span>
                                                {item.sale_expenses ? <span className="text-gray-400 ml-2">手数料 {formatPrice(item.sale_expenses)}</span> : null}
                                                <span className={`ml-2 font-bold ${(item.sale_profit ?? 0) >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                    利益 {formatPrice(item.sale_profit ?? 0)}
                                                </span>
                                            </div>
                                        )}
                                        {item.status === 'converted' && item.converted_condition && (
                                            <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-purple-600">
                                                → {item.converted_condition} に変換
                                                {item.converted_expenses ? <span className="text-gray-400 ml-2">経費 {formatPrice(item.converted_expenses)}</span> : null}
                                            </div>
                                        )}
                                        {item.resolution_notes && (
                                            <p className="text-xs text-gray-400 mt-1">{item.resolution_notes}</p>
                                        )}

                                        {/* アクションボタン（pendingのみ） */}
                                        {item.status === 'pending' && (
                                            <div className="flex gap-2 mt-3">
                                                <button
                                                    onClick={() => setReturnItem(item)}
                                                    className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold hover:bg-blue-100"
                                                >返却</button>
                                                <button
                                                    onClick={() => setConvertItem(item)}
                                                    className="px-3 py-1.5 bg-purple-50 text-purple-700 rounded-lg text-xs font-bold hover:bg-purple-100"
                                                >変換</button>
                                                <button
                                                    onClick={() => setSellItem(item)}
                                                    className="px-3 py-1.5 bg-green-50 text-green-700 rounded-lg text-xs font-bold hover:bg-green-100"
                                                >売却</button>
                                                <button
                                                    onClick={() => handleCancel(item)}
                                                    disabled={undoing === item.id}
                                                    className="px-3 py-1.5 bg-gray-50 text-gray-500 rounded-lg text-xs font-bold hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50 ml-auto"
                                                >{undoing === item.id ? '処理中...' : '取消'}</button>
                                            </div>
                                        )}

                                        {/* やり直しボタン（解決済みのみ） */}
                                        {item.status !== 'pending' && folder.status === 'open' && (
                                            <div className="flex gap-2 mt-3">
                                                <button
                                                    onClick={() => handleUndo(item)}
                                                    disabled={undoing === item.id}
                                                    className="px-3 py-1.5 bg-gray-50 text-gray-500 rounded-lg text-xs font-bold hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
                                                >{undoing === item.id ? '処理中...' : '↩ やり直し'}</button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {/* モーダル */}
            {showAddModal && (
                <CheckoutAddItemModal
                    folderId={folder.id}
                    onClose={() => setShowAddModal(false)}
                    onAdded={() => { setShowAddModal(false); loadFolder() }}
                />
            )}
            {returnItem && (
                <CheckoutReturnModal
                    item={returnItem}
                    onClose={() => setReturnItem(null)}
                    onReturned={() => { setReturnItem(null); loadFolder() }}
                />
            )}
            {sellItem && (
                <CheckoutSellModal
                    item={sellItem}
                    onClose={() => setSellItem(null)}
                    onSold={() => { setSellItem(null); loadFolder() }}
                />
            )}
            {convertItem && (
                <CheckoutConvertModal
                    item={convertItem}
                    onClose={() => setConvertItem(null)}
                    onConverted={() => { setConvertItem(null); loadFolder() }}
                />
            )}
        </PosLayout>
    )
}
