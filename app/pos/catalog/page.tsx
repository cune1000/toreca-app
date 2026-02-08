'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PosLayout from '@/components/pos/PosLayout'
import { getCatalogs, createCatalog, deleteCatalog, searchCatalogFromAPI } from '@/lib/pos/api'
import { formatPrice } from '@/lib/pos/constants'
import type { PosCatalog } from '@/lib/pos/types'

export default function CatalogPage() {
    const router = useRouter()
    const [catalogs, setCatalogs] = useState<PosCatalog[]>([])
    const [search, setSearch] = useState('')
    const [loading, setLoading] = useState(true)
    const [showCreate, setShowCreate] = useState(false)
    const [showApiSearch, setShowApiSearch] = useState(false)
    const [apiQuery, setApiQuery] = useState('')
    const [apiResults, setApiResults] = useState<any[]>([])
    const [apiSearching, setApiSearching] = useState(false)

    // 新規作成フォーム
    const [form, setForm] = useState({
        name: '', category: '', subcategory: '', card_number: '', rarity: '', fixed_price: '',
    })

    const load = async () => {
        try {
            const res = await getCatalogs({ search })
            setCatalogs(res.data)
        } catch (err) { console.error(err) }
        finally { setLoading(false) }
    }

    useEffect(() => { load() }, [search])

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

            {/* 検索 */}
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

            {/* 一覧 */}
            {loading ? (
                <div className="py-12 text-center">
                    <div className="inline-block w-8 h-8 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
                </div>
            ) : (
                <div className="space-y-1.5">
                    {catalogs.length > 0 ? catalogs.map(cat => (
                        <div key={cat.id} className="bg-white border border-gray-100 rounded-lg px-3 py-2.5 flex items-center gap-3">
                            {cat.image_url ? (
                                <img src={cat.image_url} alt="" className="w-10 h-14 object-cover rounded" />
                            ) : (
                                <div className="w-10 h-14 bg-gray-100 rounded flex items-center justify-center text-lg">🎴</div>
                            )}
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-gray-800 truncate">{cat.name}</p>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <span className="text-[10px] text-gray-400">{cat.category || '-'}</span>
                                    <span className="text-[10px] text-gray-400">·</span>
                                    <span className="text-[10px] text-gray-400">{cat.rarity || '-'}</span>
                                    {cat.card_number && (
                                        <>
                                            <span className="text-[10px] text-gray-400">·</span>
                                            <span className="text-[10px] text-gray-400">{cat.card_number}</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                                {cat.fixed_price && (
                                    <span className="text-xs font-medium text-gray-600">{formatPrice(cat.fixed_price)}</span>
                                )}
                                {cat.source_type === 'api' ? (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-500 rounded-full">API</span>
                                ) : (
                                    <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full">独自</span>
                                )}
                                <button onClick={() => handleDelete(cat.id)} className="text-gray-400 hover:text-red-500 text-sm ml-1">✕</button>
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
