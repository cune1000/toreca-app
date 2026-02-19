'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PosLayout from '@/components/pos/PosLayout'
import PosSpinner from '@/components/pos/PosSpinner'
import { getCheckoutFolders, createCheckoutFolder, getCheckoutStats } from '@/lib/pos/api'
import { formatPrice } from '@/lib/pos/constants'
import { getErrorMessage } from '@/lib/pos/utils'
import type { PosCheckoutFolder, PosCheckoutStats } from '@/lib/pos/types'

export default function CheckoutPage() {
    const router = useRouter()
    const [folders, setFolders] = useState<PosCheckoutFolder[]>([])
    const [stats, setStats] = useState<PosCheckoutStats | null>(null)
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<'all' | 'open' | 'closed'>('open')
    const [showCreate, setShowCreate] = useState(false)
    const [newName, setNewName] = useState('')
    const [newDesc, setNewDesc] = useState('')
    const [creating, setCreating] = useState(false)
    const [error, setError] = useState('')
    const [search, setSearch] = useState('')
    const [sort, setSort] = useState<'date' | 'name' | 'amount'>('date')

    const loadData = () => {
        setLoading(true)
        Promise.all([
            getCheckoutFolders({ status: filter === 'all' ? undefined : filter }).then(r => setFolders(r.data)),
            getCheckoutStats().then(r => setStats(r.data)),
        ]).catch(console.error).finally(() => setLoading(false))
    }

    useEffect(() => { loadData() }, [filter])

    const handleCreate = async () => {
        if (!newName.trim()) return
        setCreating(true)
        setError('')
        try {
            const res = await createCheckoutFolder({ name: newName.trim(), description: newDesc.trim() || undefined })
            router.push(`/pos/checkout/${res.data.id}`)
        } catch (err) {
            setError(getErrorMessage(err))
        } finally {
            setCreating(false)
        }
    }

    return (
        <PosLayout>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div>
                    <h1 className="text-xl font-bold text-gray-900">持ち出し管理</h1>
                    <p className="text-sm text-gray-500 mt-1">PSA鑑定・委託販売・買取など</p>
                </div>
                <button
                    onClick={() => setShowCreate(!showCreate)}
                    className="px-5 py-3 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
                >+ フォルダ作成</button>
            </div>

            {/* 資金ロック額サマリー */}
            {stats && stats.pendingItems > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 md:p-5 mb-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-amber-600 font-bold">持ち出し中の資金</p>
                            <p className="text-2xl font-bold text-amber-700 mt-1">{formatPrice(stats.lockedAmount)}</p>
                        </div>
                        <div className="text-right">
                            <p className="text-sm text-amber-600">{stats.pendingItems}点 保留中</p>
                            {stats.lockedExpenses > 0 && (
                                <p className="text-xs text-amber-500 mt-0.5">経費込み {formatPrice(stats.totalLockedValue)}</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* フォルダ作成フォーム */}
            {showCreate && (
                <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
                    <h3 className="text-sm font-bold text-gray-700 mb-3">新しいフォルダ</h3>
                    <div className="space-y-3">
                        <input
                            type="text"
                            value={newName}
                            onChange={e => setNewName(e.target.value)}
                            placeholder="フォルダ名（例: PSA鑑定 2月分）"
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400"
                            autoFocus
                        />
                        <input
                            type="text"
                            value={newDesc}
                            onChange={e => setNewDesc(e.target.value)}
                            placeholder="メモ（注文番号・送付先など、任意）"
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400"
                        />
                        {error && <p className="text-sm text-red-500 font-bold">{error}</p>}
                        <div className="flex gap-2">
                            <button
                                onClick={handleCreate}
                                disabled={!newName.trim() || creating}
                                className="px-5 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:bg-gray-200 disabled:text-gray-400 transition-colors"
                            >{creating ? '作成中...' : '作成して開く'}</button>
                            <button
                                onClick={() => { setShowCreate(false); setNewName(''); setNewDesc(''); setError('') }}
                                className="px-5 py-2.5 border border-gray-200 rounded-lg text-sm font-bold text-gray-600 hover:bg-gray-50 transition-colors"
                            >キャンセル</button>
                        </div>
                    </div>
                </div>
            )}

            {/* フィルタ */}
            <div className="flex gap-2 mb-4">
                {([['open', '進行中'], ['closed', '完了'], ['all', 'すべて']] as const).map(([key, label]) => (
                    <button
                        key={key}
                        onClick={() => setFilter(key)}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-colors ${filter === key ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >{label}</button>
                ))}
            </div>

            {/* 検索・ソート */}
            <div className="flex gap-2 mb-4">
                <input
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="フォルダ名で検索..."
                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-gray-400"
                />
                <select
                    value={sort}
                    onChange={e => setSort(e.target.value as any)}
                    className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-600 bg-white focus:outline-none focus:border-gray-400"
                >
                    <option value="date">作成日順</option>
                    <option value="name">名前順</option>
                    <option value="amount">ロック額順</option>
                </select>
            </div>

            {/* フォルダリスト */}
            {loading ? <PosSpinner /> : folders.length === 0 ? (
                <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
                    <p className="text-gray-400 text-sm">
                        {filter === 'open' ? '進行中のフォルダはありません' : filter === 'closed' ? '完了したフォルダはありません' : 'フォルダはありません'}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {folders
                        .filter(f => !search || f.name.toLowerCase().includes(search.toLowerCase()) || f.description?.toLowerCase().includes(search.toLowerCase()))
                        .sort((a, b) => {
                            if (sort === 'name') return a.name.localeCompare(b.name, 'ja')
                            if (sort === 'amount') return (b.locked_amount ?? 0) - (a.locked_amount ?? 0)
                            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                        })
                        .map(folder => (
                        <button
                            key={folder.id}
                            onClick={() => router.push(`/pos/checkout/${folder.id}`)}
                            className="w-full bg-white border border-gray-200 rounded-xl p-4 md:p-5 text-left hover:border-gray-300 transition-colors"
                        >
                            <div className="flex items-start justify-between">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className="text-lg">📁</span>
                                        <h3 className="text-base font-bold text-gray-900 truncate">{folder.name}</h3>
                                        {folder.status === 'closed' && (
                                            <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs font-bold flex-shrink-0">完了</span>
                                        )}
                                    </div>
                                    {folder.description && (
                                        <p className="text-xs text-gray-400 mt-1 truncate">{folder.description}</p>
                                    )}
                                    <p className="text-xs text-gray-400 mt-1">
                                        {new Date(folder.created_at).toLocaleDateString('ja-JP')} 作成
                                    </p>
                                </div>
                                <div className="text-right flex-shrink-0 ml-4">
                                    {(folder.pending_count ?? 0) > 0 ? (
                                        <>
                                            <p className="text-base font-bold text-amber-600">{formatPrice(folder.locked_amount ?? 0)}</p>
                                            <p className="text-xs text-gray-400">{folder.pending_count}点 保留中</p>
                                        </>
                                    ) : (
                                        <p className="text-xs text-gray-400">{folder.item_count ?? 0}点</p>
                                    )}
                                </div>
                            </div>
                        </button>
                    ))}
                </div>
            )}
        </PosLayout>
    )
}
