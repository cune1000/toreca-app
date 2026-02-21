'use client'

import { useState, useEffect } from 'react'
import PosLayout from '@/components/pos/PosLayout'
import PosSpinner from '@/components/pos/PosSpinner'
import { getSources, createSource, updateSource, deleteSource } from '@/lib/pos/api'
import { SOURCE_TYPES, TRUST_LEVELS, getSourceType, getTrustLevel } from '@/lib/pos/constants'
import { getErrorMessage } from '@/lib/pos/utils'
import type { PosSource } from '@/lib/pos/types'

export default function SourcesPage() {
    const [sources, setSources] = useState<PosSource[]>([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingSource, setEditingSource] = useState<PosSource | null>(null)
    const [showInactive, setShowInactive] = useState(false)

    // フォーム
    const [name, setName] = useState('')
    const [type, setType] = useState<string>('wholesale')
    const [trustLevel, setTrustLevel] = useState<string>('unverified')
    const [contactInfo, setContactInfo] = useState('')
    const [notes, setNotes] = useState('')
    const [submitting, setSubmitting] = useState(false)

    const loadSources = async () => {
        try {
            const res = await getSources({ active: showInactive ? undefined : true })
            setSources(res.data)
        } catch (err) { console.error(err) }
        finally { setLoading(false) }
    }

    useEffect(() => { loadSources() }, [showInactive])

    const resetForm = () => {
        setName('')
        setType('wholesale')
        setTrustLevel('unverified')
        setContactInfo('')
        setNotes('')
        setEditingSource(null)
        setShowForm(false)
    }

    const openEdit = (source: PosSource) => {
        setEditingSource(source)
        setName(source.name)
        setType(source.type)
        setTrustLevel(source.trust_level)
        setContactInfo(source.contact_info || '')
        setNotes(source.notes || '')
        setShowForm(true)
    }

    const handleSubmit = async () => {
        if (!name.trim()) return
        setSubmitting(true)
        try {
            if (editingSource) {
                await updateSource(editingSource.id, { name, type: type as any, trust_level: trustLevel as any, contact_info: contactInfo, notes })
            } else {
                await createSource({ name, type, trust_level: trustLevel, contact_info: contactInfo || undefined, notes: notes || undefined })
            }
            resetForm()
            await loadSources()
        } catch (err) {
            alert(getErrorMessage(err))
        } finally {
            setSubmitting(false)
        }
    }

    const handleDelete = async (source: PosSource) => {
        if (!confirm(`「${source.name}」を無効化しますか？`)) return
        try {
            await deleteSource(source.id)
            await loadSources()
        } catch (err) {
            alert(getErrorMessage(err))
        }
    }

    const handleReactivate = async (source: PosSource) => {
        try {
            await updateSource(source.id, { is_active: true } as any)
            await loadSources()
        } catch (err) {
            alert(getErrorMessage(err))
        }
    }

    return (
        <PosLayout>
            <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold text-gray-800">🏢 仕入先管理</h2>
                <button
                    onClick={() => { resetForm(); setShowForm(true) }}
                    className="px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
                >
                    + 追加
                </button>
            </div>

            {/* フィルタ */}
            <div className="flex items-center gap-3 mb-4">
                <label className="flex items-center gap-2 text-sm text-gray-500 cursor-pointer">
                    <input
                        type="checkbox"
                        checked={showInactive}
                        onChange={e => setShowInactive(e.target.checked)}
                        className="rounded"
                    />
                    無効を含む
                </label>
            </div>

            {/* フォーム（モーダル風） */}
            {showForm && (
                <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => resetForm()}>
                    <div className="bg-white rounded-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-gray-800">
                            {editingSource ? '仕入先を編集' : '仕入先を追加'}
                        </h3>

                        <div>
                            <label className="text-sm font-bold text-gray-600 mb-2 block">名前 *</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="例: 問屋A、メルカリ太郎"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400"
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="text-sm font-bold text-gray-600 mb-2 block">タイプ</label>
                            <div className="grid grid-cols-2 gap-2">
                                {SOURCE_TYPES.map(st => (
                                    <button
                                        key={st.code}
                                        onClick={() => {
                                            setType(st.code)
                                            if (st.code === 'wholesale') setTrustLevel('trusted')
                                            else setTrustLevel('unverified')
                                        }}
                                        className={`py-2.5 rounded-lg text-sm font-bold transition-colors ${type === st.code
                                            ? 'text-white shadow-sm'
                                            : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                                            }`}
                                        style={type === st.code ? { backgroundColor: st.color } : {}}
                                    >
                                        {st.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-bold text-gray-600 mb-2 block">信頼度</label>
                            <div className="grid grid-cols-2 gap-2">
                                {TRUST_LEVELS.map(tl => (
                                    <button
                                        key={tl.code}
                                        onClick={() => setTrustLevel(tl.code)}
                                        className={`py-2.5 rounded-lg text-sm font-bold transition-colors ${trustLevel === tl.code
                                            ? 'text-white shadow-sm'
                                            : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                                            }`}
                                        style={trustLevel === tl.code ? { backgroundColor: tl.color } : {}}
                                    >
                                        {tl.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="text-sm font-bold text-gray-600 mb-2 block">連絡先（任意）</label>
                            <input
                                type="text"
                                value={contactInfo}
                                onChange={e => setContactInfo(e.target.value)}
                                placeholder="例: メルカリID、電話番号"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400"
                            />
                        </div>

                        <div>
                            <label className="text-sm font-bold text-gray-600 mb-2 block">メモ（任意）</label>
                            <input
                                type="text"
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="備考"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400"
                            />
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                onClick={resetForm}
                                className="flex-1 py-3 bg-gray-100 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-200 transition-colors"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={!name.trim() || submitting}
                                className={`flex-1 py-3 rounded-xl text-sm font-bold transition-colors ${name.trim() && !submitting
                                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                                    : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                    }`}
                            >
                                {submitting ? '保存中...' : editingSource ? '更新' : '追加'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 一覧 */}
            {loading ? (
                <PosSpinner />
            ) : sources.length === 0 ? (
                <div className="text-center py-16 text-gray-400">
                    <p className="text-4xl mb-3">🏢</p>
                    <p className="text-sm">仕入先がまだ登録されていません</p>
                    <p className="text-xs mt-1">「+ 追加」から登録してください</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {sources.map(source => {
                        const st = getSourceType(source.type)
                        const tl = getTrustLevel(source.trust_level)
                        return (
                            <div
                                key={source.id}
                                className={`bg-white border rounded-xl p-4 ${source.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <p className="text-base font-bold text-gray-800 truncate">{source.name}</p>
                                            {!source.is_active && (
                                                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-400 rounded-full">無効</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span
                                                className="text-xs px-2.5 py-1 rounded-full text-white font-bold"
                                                style={{ backgroundColor: st.color }}
                                            >
                                                {st.label}
                                            </span>
                                            <span
                                                className="text-xs px-2.5 py-1 rounded-full text-white font-bold"
                                                style={{ backgroundColor: tl.color }}
                                            >
                                                {tl.label}
                                            </span>
                                        </div>
                                        {source.contact_info && (
                                            <p className="text-xs text-gray-400 mt-2">{source.contact_info}</p>
                                        )}
                                        {source.notes && (
                                            <p className="text-xs text-gray-400 mt-1">{source.notes}</p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-1 ml-3 flex-shrink-0">
                                        <button
                                            onClick={() => openEdit(source)}
                                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                            title="編集"
                                        >
                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                        </button>
                                        {source.is_active ? (
                                            <button
                                                onClick={() => handleDelete(source)}
                                                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="無効化"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => handleReactivate(source)}
                                                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                                                title="再有効化"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </PosLayout>
    )
}
