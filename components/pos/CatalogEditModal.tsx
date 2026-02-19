'use client'

import { useState } from 'react'
import { updateCatalog } from '@/lib/pos/api'
import { formatPrice } from '@/lib/pos/constants'
import type { PosCatalog } from '@/lib/pos/types'

interface Props {
    catalog: PosCatalog
    onClose: () => void
    onSaved: (updated: PosCatalog) => void
}

export default function CatalogEditModal({ catalog, onClose, onSaved }: Props) {
    const [name, setName] = useState(catalog.name)
    const [category, setCategory] = useState(catalog.category || '')
    const [rarity, setRarity] = useState(catalog.rarity || '')
    const [cardNumber, setCardNumber] = useState(catalog.card_number || '')
    const [fixedPrice, setFixedPrice] = useState(catalog.fixed_price != null ? String(catalog.fixed_price) : '')
    const [imageUrl, setImageUrl] = useState(catalog.image_url || '')
    const [submitting, setSubmitting] = useState(false)
    const [error, setError] = useState('')

    const handleSave = async () => {
        if (!name.trim()) { setError('商品名を入力してください'); return }
        setSubmitting(true)
        setError('')
        try {
            const res = await updateCatalog(catalog.id, {
                name: name.trim(),
                category: category.trim() || null,
                rarity: rarity.trim() || null,
                card_number: cardNumber.trim() || null,
                fixed_price: fixedPrice.trim() !== '' ? parseInt(fixedPrice) || 0 : null,
                image_url: imageUrl.trim() || null,
            } as any)
            onSaved(res.data)
        } catch (err: any) {
            setError(err.message)
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center" onClick={onClose}>
            <div
                className="bg-white w-full md:max-w-lg md:rounded-xl rounded-t-2xl max-h-[90vh] overflow-y-auto"
                onClick={e => e.stopPropagation()}
            >
                <div className="sticky top-0 bg-white px-5 py-4 border-b border-gray-100 flex items-center justify-between z-10">
                    <h3 className="text-base font-bold text-gray-900">カタログ編集</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg p-1">✕</button>
                </div>

                <div className="p-5 space-y-4">
                    {/* 商品名 */}
                    <div>
                        <label className="text-sm font-bold text-gray-600 mb-2 block">商品名 <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400"
                        />
                    </div>

                    {/* カテゴリ・レアリティ */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-sm font-bold text-gray-600 mb-2 block">カテゴリ</label>
                            <input
                                type="text"
                                value={category}
                                onChange={e => setCategory(e.target.value)}
                                placeholder="例: ポケモン"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400"
                            />
                        </div>
                        <div>
                            <label className="text-sm font-bold text-gray-600 mb-2 block">レアリティ</label>
                            <input
                                type="text"
                                value={rarity}
                                onChange={e => setRarity(e.target.value)}
                                placeholder="例: SAR"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400"
                            />
                        </div>
                    </div>

                    {/* カード番号 */}
                    <div>
                        <label className="text-sm font-bold text-gray-600 mb-2 block">カード番号</label>
                        <input
                            type="text"
                            value={cardNumber}
                            onChange={e => setCardNumber(e.target.value)}
                            placeholder="例: 123/190"
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400"
                        />
                    </div>

                    {/* 販売設定価格 */}
                    <div>
                        <label className="text-sm font-bold text-gray-600 mb-2 block">販売設定価格</label>
                        <div className="relative">
                            <span className="absolute left-4 top-3.5 text-gray-400 text-sm">¥</span>
                            <input
                                type="number"
                                value={fixedPrice}
                                onChange={e => setFixedPrice(e.target.value)}
                                placeholder="未設定"
                                className="w-full px-4 py-3 pl-9 border border-gray-200 rounded-xl text-lg font-bold text-right focus:outline-none focus:border-gray-400"
                            />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">販売登録時のデフォルト単価として使用されます</p>
                    </div>

                    {/* 画像URL */}
                    <div>
                        <label className="text-sm font-bold text-gray-600 mb-2 block">画像URL</label>
                        <input
                            type="text"
                            value={imageUrl}
                            onChange={e => setImageUrl(e.target.value)}
                            placeholder="https://..."
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400"
                        />
                        {imageUrl && (
                            <div className="mt-2 flex justify-center">
                                <img src={imageUrl} alt="プレビュー" className="w-20 h-28 object-cover rounded-lg border border-gray-200" onError={e => (e.currentTarget.style.display = 'none')} />
                            </div>
                        )}
                    </div>

                    {/* API連携情報（読取専用） */}
                    {catalog.api_card_id && (
                        <div className="bg-blue-50 rounded-lg px-4 py-3">
                            <p className="text-xs text-blue-600 font-bold">🔗 API連携中</p>
                            <p className="text-xs text-blue-500 mt-0.5">カードID: {catalog.api_card_id}</p>
                        </div>
                    )}

                    {error && <p className="text-sm text-red-500 font-bold">{error}</p>}

                    <button
                        onClick={handleSave}
                        disabled={submitting}
                        className={`w-full py-4 rounded-xl text-base font-bold transition-colors ${submitting ? 'bg-gray-200 text-gray-400' : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-[0.98]'}`}
                    >
                        {submitting ? '保存中...' : '保存する'}
                    </button>
                </div>
            </div>
        </div>
    )
}
