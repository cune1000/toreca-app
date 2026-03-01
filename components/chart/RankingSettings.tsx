'use client'

import { useState, useEffect } from 'react'
import { X, GripVertical, RotateCcw } from 'lucide-react'
import { ALL_RANKINGS, DEFAULT_VISIBLE_RANKINGS, RANKING_STORAGE_KEY } from '@/lib/chart/constants'

interface Props {
    visible: string[]
    onSave: (rankings: string[]) => void
    onClose: () => void
}

export default function RankingSettings({ visible, onSave, onClose }: Props) {
    const [selected, setSelected] = useState<string[]>(visible)

    const toggle = (id: string) => {
        setSelected(prev =>
            prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
        )
    }

    const moveUp = (index: number) => {
        if (index === 0) return
        const next = [...selected]
            ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
        setSelected(next)
    }

    const moveDown = (index: number) => {
        if (index >= selected.length - 1) return
        const next = [...selected]
            ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
        setSelected(next)
    }

    const reset = () => setSelected([...DEFAULT_VISIBLE_RANKINGS])

    const save = () => {
        localStorage.setItem(RANKING_STORAGE_KEY, JSON.stringify(selected))
        onSave(selected)
        onClose()
    }

    // カテゴリごとにグループ化
    const categories = Array.from(new Set(ALL_RANKINGS.map(r => r.category)))

    return (
        <div
            className="fixed inset-0 bg-black/50 flex items-end md:items-center justify-center z-50 p-0 md:p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-t-2xl md:rounded-2xl w-full md:w-[520px] max-h-[90vh] md:max-h-[85vh] overflow-hidden shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                {/* ドラッグハンドル(モバイル) */}
                <div className="flex justify-center pt-2 pb-1 md:hidden">
                    <div className="w-10 h-1 bg-gray-300 rounded-full" />
                </div>

                {/* ヘッダー */}
                <div className="px-4 py-3 md:p-5 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="text-base md:text-lg font-bold text-gray-800">⚙️ ランキング表示設定</h2>
                    <button
                        onClick={onClose}
                        className="p-2.5 hover:bg-gray-100 rounded-xl min-h-[44px] min-w-[44px] flex items-center justify-center"
                    >
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                {/* コンテンツ */}
                <div className="px-4 py-3 md:p-5 overflow-y-auto max-h-[55vh] md:max-h-[55vh]">
                    {/* 選択済み（並び替え可能） */}
                    {selected.length > 0 && (
                        <div className="mb-5">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                                表示中
                            </h3>
                            <div className="space-y-1.5">
                                {selected.map((id, i) => {
                                    const r = ALL_RANKINGS.find(r => r.id === id)
                                    if (!r) return null
                                    return (
                                        <div key={id} className="flex items-center gap-2 p-2.5 bg-blue-50 rounded-xl">
                                            <GripVertical size={14} className="text-gray-300" />
                                            <span className="text-base">{r.icon}</span>
                                            <span className="text-sm font-medium text-gray-800 flex-1 truncate">{r.label}</span>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => moveUp(i)}
                                                    disabled={i === 0}
                                                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-blue-100 disabled:opacity-30 text-sm"
                                                >↑</button>
                                                <button
                                                    onClick={() => moveDown(i)}
                                                    disabled={i === selected.length - 1}
                                                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-blue-100 disabled:opacity-30 text-sm"
                                                >↓</button>
                                            </div>
                                            <button
                                                onClick={() => toggle(id)}
                                                className="w-8 h-8 rounded-lg flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50"
                                            >✕</button>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

                    {/* カテゴリ別ランキング選択 */}
                    {categories.map(cat => (
                        <div key={cat} className="mb-4">
                            <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">{cat}</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {ALL_RANKINGS.filter(r => r.category === cat).map(r => {
                                    const isSelected = selected.includes(r.id)
                                    return (
                                        <button
                                            key={r.id}
                                            onClick={() => toggle(r.id)}
                                            className={`flex items-center gap-2 p-3 rounded-xl text-sm text-left transition-colors min-h-[48px]
                                                ${isSelected
                                                    ? 'bg-blue-50 border-2 border-blue-300 text-blue-700'
                                                    : r.comingSoon
                                                        ? 'bg-gray-50 text-gray-300 cursor-not-allowed'
                                                        : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200'
                                                }`}
                                            disabled={r.comingSoon}
                                        >
                                            <span className="text-base">{r.icon}</span>
                                            <span className="font-medium truncate">{r.label}</span>
                                            {r.comingSoon && <span className="text-[10px] text-gray-400">soon</span>}
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                {/* フッター */}
                <div className="px-4 py-3 md:p-5 border-t border-gray-100 flex flex-col md:flex-row items-center gap-3 md:justify-between safe-area-pb">
                    <button
                        onClick={reset}
                        className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 order-2 md:order-1"
                    >
                        <RotateCcw size={14} />
                        デフォルトに戻す
                    </button>
                    <div className="flex gap-3 w-full md:w-auto order-1 md:order-2">
                        <button
                            onClick={onClose}
                            className="flex-1 md:flex-none px-5 py-3 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 text-sm font-medium min-h-[48px]"
                        >
                            キャンセル
                        </button>
                        <button
                            onClick={save}
                            className="flex-1 md:flex-none px-5 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-xl hover:from-red-600 hover:to-orange-600 text-sm font-bold min-h-[48px] shadow-md"
                        >
                            保存
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
