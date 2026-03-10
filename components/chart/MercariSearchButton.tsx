'use client'

import { useState, useEffect, useMemo } from 'react'
import { Settings, X } from 'lucide-react'

export interface MercariSettings {
    sort: 'default' | 'created_time' | 'score' | 'price_asc' | 'price_desc'
    condition: string  // '' | '1' | '2' | '1,2' | '3'
    priceMin: string
    priceMax: string
    category: '' | '1289' | '82'
    status: '' | 'on_sale' | 'sold_out|trading'
    excludeKeyword: string
    anonymousShipping: boolean
}

const DEFAULT_SETTINGS: MercariSettings = {
    sort: 'created_time',
    condition: '',
    priceMin: '',
    priceMax: '',
    category: '1289',
    status: 'on_sale',
    excludeKeyword: 'PSA BGS',
    anonymousShipping: false,
}

const STORAGE_KEY = 'mercari-search-settings'

function loadSettings(): MercariSettings {
    if (typeof window === 'undefined') return DEFAULT_SETTINGS
    try {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) }
    } catch { }
    return DEFAULT_SETTINGS
}

function saveSettings(s: MercariSettings) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(s))
    } catch { }
}

export function buildMercariUrl(keyword: string, settings: MercariSettings): string {
    const params = new URLSearchParams()
    params.set('keyword', keyword)

    if (settings.sort === 'created_time' || settings.sort === 'score') {
        params.set('sort', settings.sort)
        params.set('order', 'desc')
    } else if (settings.sort === 'price_asc') {
        params.set('sort', 'price')
        params.set('order', 'asc')
    } else if (settings.sort === 'price_desc') {
        params.set('sort', 'price')
        params.set('order', 'desc')
    }

    if (settings.condition) {
        params.set('item_condition_id', settings.condition)
    }
    if (settings.priceMin) {
        params.set('price_min', settings.priceMin)
    }
    if (settings.priceMax) {
        params.set('price_max', settings.priceMax)
    }
    if (settings.category) {
        params.set('category_id', settings.category)
    }
    if (settings.status) {
        params.set('status', settings.status)
    }
    if (settings.excludeKeyword.trim()) {
        params.set('exclude_keyword', settings.excludeKeyword.trim())
    }
    if (settings.anonymousShipping) {
        params.set('shipping_method', 'anonymous')
    }

    return `https://jp.mercari.com/search?${params.toString()}`
}

interface Props {
    cardName: string
    cardNumber?: string
    rarity?: string
}

export default function MercariSearchButton({ cardName, cardNumber, rarity }: Props) {
    const [settings, setSettings] = useState<MercariSettings>(DEFAULT_SETTINGS)
    const [showModal, setShowModal] = useState(false)
    const [draft, setDraft] = useState<MercariSettings>(DEFAULT_SETTINGS)

    useEffect(() => {
        const loaded = loadSettings()
        setSettings(loaded)
        setDraft(loaded)
    }, [])

    const keyword = useMemo(() => {
        const parts = [cardName]
        if (cardNumber) parts.push(cardNumber)
        return parts.join(' ')
    }, [cardName, cardNumber])

    const url = useMemo(() => buildMercariUrl(keyword, settings), [keyword, settings])

    const openModal = () => {
        setDraft({ ...settings })
        setShowModal(true)
    }

    const handleSave = () => {
        setSettings(draft)
        saveSettings(draft)
        setShowModal(false)
    }

    const handleReset = () => {
        setDraft({ ...DEFAULT_SETTINGS })
    }

    const updateDraft = (key: keyof MercariSettings, value: any) => {
        setDraft(prev => ({ ...prev, [key]: value }))
    }

    return (
        <>
            <div className="flex gap-2 mb-3">
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-red-500 text-white rounded-xl px-4 py-3 flex items-center gap-3
                        transition-all active:scale-[0.98] hover:shadow-md"
                >
                    <span className="text-lg">🔍</span>
                    <div className="text-left">
                        <p className="text-sm font-bold">メルカリで検索</p>
                        <p className="text-[10px] opacity-80">カスタム設定で検索</p>
                    </div>
                    <span className="ml-auto text-white/60">→</span>
                </a>
                <button
                    onClick={openModal}
                    className="w-12 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
                    aria-label="メルカリ検索設定"
                >
                    <Settings size={18} className="text-gray-500" />
                </button>
            </div>

            {/* 設定モーダル */}
            {showModal && (
                <div
                    className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center"
                    onClick={(e) => e.target === e.currentTarget && setShowModal(false)}
                >
                    <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-y-auto">
                        {/* ヘッダー */}
                        <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between rounded-t-2xl">
                            <h3 className="text-sm font-bold text-gray-800">メルカリ検索設定</h3>
                            <button
                                onClick={() => setShowModal(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
                            >
                                <X size={16} className="text-gray-400" />
                            </button>
                        </div>

                        <div className="px-4 py-4 space-y-5">
                            {/* 並び順 */}
                            <SettingSection label="並び順">
                                <SelectButtons
                                    value={draft.sort}
                                    onChange={(v) => updateDraft('sort', v)}
                                    options={[
                                        { value: 'created_time', label: '新しい順' },
                                        { value: 'score', label: 'おすすめ' },
                                        { value: 'price_asc', label: '安い順' },
                                        { value: 'price_desc', label: '高い順' },
                                        { value: 'default', label: '通常' },
                                    ]}
                                />
                            </SettingSection>

                            {/* 商品の状態 */}
                            <SettingSection label="商品の状態">
                                <SelectButtons
                                    value={draft.condition}
                                    onChange={(v) => updateDraft('condition', v)}
                                    options={[
                                        { value: '', label: '指定なし' },
                                        { value: '1', label: '新品/未使用' },
                                        { value: '2', label: '未使用に近い' },
                                        { value: '1,2', label: '新品+未使用に近い' },
                                        { value: '3', label: '傷汚れなし' },
                                    ]}
                                />
                            </SettingSection>

                            {/* 価格帯 */}
                            <SettingSection label="価格帯">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        placeholder="下限"
                                        value={draft.priceMin}
                                        onChange={(e) => updateDraft('priceMin', e.target.value)}
                                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                                    />
                                    <span className="text-gray-400 text-sm">〜</span>
                                    <input
                                        type="number"
                                        placeholder="上限"
                                        value={draft.priceMax}
                                        onChange={(e) => updateDraft('priceMax', e.target.value)}
                                        className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                                    />
                                    <span className="text-gray-400 text-xs">円</span>
                                </div>
                            </SettingSection>

                            {/* カテゴリ */}
                            <SettingSection label="カテゴリ">
                                <SelectButtons
                                    value={draft.category}
                                    onChange={(v) => updateDraft('category', v)}
                                    options={[
                                        { value: '1289', label: 'ポケモンカード' },
                                        { value: '82', label: 'トレカ全般' },
                                        { value: '', label: '指定なし' },
                                    ]}
                                />
                            </SettingSection>

                            {/* 販売状況 */}
                            <SettingSection label="販売状況">
                                <SelectButtons
                                    value={draft.status}
                                    onChange={(v) => updateDraft('status', v)}
                                    options={[
                                        { value: 'on_sale', label: '販売中' },
                                        { value: 'sold_out|trading', label: '売り切れ' },
                                        { value: '', label: 'すべて' },
                                    ]}
                                />
                            </SettingSection>

                            {/* 除外ワード */}
                            <SettingSection label="除外ワード">
                                <input
                                    type="text"
                                    placeholder="例: PSA BGS（スペース区切り）"
                                    value={draft.excludeKeyword}
                                    onChange={(e) => updateDraft('excludeKeyword', e.target.value)}
                                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300"
                                />
                            </SettingSection>

                            {/* 匿名配送 */}
                            <SettingSection label="配送方法">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <div
                                        className={`w-10 h-6 rounded-full transition-colors relative ${draft.anonymousShipping ? 'bg-red-500' : 'bg-gray-200'}`}
                                        onClick={() => updateDraft('anonymousShipping', !draft.anonymousShipping)}
                                    >
                                        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${draft.anonymousShipping ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                    </div>
                                    <span className="text-sm text-gray-600">匿名配送のみ</span>
                                </label>
                            </SettingSection>

                            {/* プレビュー */}
                            <div className="bg-gray-50 rounded-lg p-3">
                                <p className="text-[10px] text-gray-400 mb-1">検索URLプレビュー</p>
                                <p className="text-[11px] text-gray-500 break-all leading-relaxed">
                                    {buildMercariUrl(keyword, draft)}
                                </p>
                            </div>
                        </div>

                        {/* フッターボタン */}
                        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-4 py-3 flex gap-2">
                            <button
                                onClick={handleReset}
                                className="px-4 py-2.5 text-sm text-gray-500 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                            >
                                リセット
                            </button>
                            <button
                                onClick={handleSave}
                                className="flex-1 py-2.5 text-sm font-bold text-white bg-red-500 rounded-xl hover:bg-red-600 active:scale-[0.98] transition-all"
                            >
                                保存する
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}

function SettingSection({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div>
            <p className="text-xs font-bold text-gray-600 mb-2">{label}</p>
            {children}
        </div>
    )
}

function SelectButtons({ value, onChange, options }: {
    value: string
    onChange: (v: string) => void
    options: { value: string; label: string }[]
}) {
    return (
        <div className="flex flex-wrap gap-1.5">
            {options.map(opt => (
                <button
                    key={opt.value}
                    onClick={() => onChange(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                        ${value === opt.value
                            ? 'bg-red-500 text-white shadow-sm'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    )
}
