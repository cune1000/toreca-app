'use client'

import { useState, useEffect } from 'react'
import { getSources, createSource } from '@/lib/pos/api'
import { SOURCE_TYPES, TRUST_LEVELS, getSourceType, getTrustLevel } from '@/lib/pos/constants'
import { getErrorMessage } from '@/lib/pos/utils'
import type { PosSource } from '@/lib/pos/types'

interface Props {
    onSelect: (source: PosSource) => void
    onClose: () => void
    selectedId?: string | null
}

export default function SourceSelectModal({ onSelect, onClose, selectedId }: Props) {
    const [sources, setSources] = useState<PosSource[]>([])
    const [loading, setLoading] = useState(true)
    const [showAddForm, setShowAddForm] = useState(false)

    // 新規追加フォーム
    const [name, setName] = useState('')
    const [type, setType] = useState<string>('wholesale')
    const [trustLevel, setTrustLevel] = useState<string>('unverified')
    const [submitting, setSubmitting] = useState(false)

    useEffect(() => {
        getSources({ active: true })
            .then(res => setSources(res.data))
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [])

    const handleAdd = async () => {
        if (!name.trim()) return
        setSubmitting(true)
        try {
            const res = await createSource({ name, type, trust_level: trustLevel })
            onSelect(res.data)
        } catch (err) {
            alert(getErrorMessage(err))
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center" onClick={onClose}>
            <div
                className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md max-h-[80vh] flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
                    <h3 className="text-lg font-bold text-gray-800">🏢 仕入先を選択</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
                </div>

                <div className="overflow-y-auto flex-1 p-4">
                    {loading ? (
                        <div className="py-8 text-center">
                            <div className="inline-block w-6 h-6 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
                        </div>
                    ) : !showAddForm ? (
                        <div className="space-y-2">
                            {sources.map(source => {
                                const st = getSourceType(source.type)
                                const tl = getTrustLevel(source.trust_level)
                                const isSelected = selectedId === source.id
                                return (
                                    <button
                                        key={source.id}
                                        onClick={() => onSelect(source)}
                                        className={`w-full text-left px-4 py-3 rounded-xl border transition-colors ${isSelected
                                            ? 'border-blue-400 bg-blue-50'
                                            : 'border-gray-100 bg-white hover:bg-gray-50'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-sm font-bold text-gray-800">{source.name}</span>
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <span
                                                className="text-xs px-2 py-0.5 rounded text-white font-bold"
                                                style={{ backgroundColor: st.color }}
                                            >
                                                {st.label}
                                            </span>
                                            <span
                                                className="text-xs px-2 py-0.5 rounded text-white font-bold"
                                                style={{ backgroundColor: tl.color }}
                                            >
                                                {tl.label}
                                            </span>
                                        </div>
                                    </button>
                                )
                            })}
                            {sources.length === 0 && (
                                <p className="text-sm text-gray-400 text-center py-6">仕入先がまだありません</p>
                            )}

                            <button
                                onClick={() => setShowAddForm(true)}
                                className="w-full py-3 rounded-xl border-2 border-dashed border-gray-200 text-sm font-bold text-gray-400 hover:border-gray-300 hover:text-gray-600 transition-colors"
                            >
                                + 新しい仕入先を追加
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
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
                                            className={`py-2 rounded-lg text-xs font-bold transition-colors ${type === st.code
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
                                            className={`py-2 rounded-lg text-xs font-bold transition-colors ${trustLevel === tl.code
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

                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={() => setShowAddForm(false)}
                                    className="flex-1 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-bold hover:bg-gray-200"
                                >
                                    戻る
                                </button>
                                <button
                                    onClick={handleAdd}
                                    disabled={!name.trim() || submitting}
                                    className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-colors ${name.trim() && !submitting
                                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                                        }`}
                                >
                                    {submitting ? '追加中...' : '追加して選択'}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
