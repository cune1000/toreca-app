'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { X, ExternalLink, Edit, Store, Globe, Package, TrendingUp, TrendingDown } from 'lucide-react'

interface PriceDiff {
  label: string
  displayLabel: string
  diffJpy: number
  diffPercent: number
}

interface CardDetailHeaderProps {
  card: any
  cardImageUrl: string | null
  latestPurchase: number | null
  latestPurchaseByLabel: Record<string, { price: number; label: string; shopName: string; date: string }>
  latestPrices: Record<string, { price: number; stock: number | null; siteName: string }>
  priceDiffs: PriceDiff[]
  onClose: () => void
  onEdit: () => void
  onUpdated?: () => void
  onImageChanged: (url: string) => void
}

export default function CardDetailHeader({
  card, cardImageUrl, latestPurchase, latestPurchaseByLabel, latestPrices,
  priceDiffs, onClose, onEdit, onUpdated, onImageChanged,
}: CardDetailHeaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [imageUploading, setImageUploading] = useState(false)

  const resizeImage = (base64: string, maxSize: number = 1200): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = document.createElement('img')
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round(height * maxSize / width)
            width = maxSize
          } else {
            width = Math.round(width * maxSize / height)
            height = maxSize
          }
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('Canvas context unavailable')); return }
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
      img.src = base64
    })
  }

  const handleImageDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (!file || !file.type.startsWith('image/')) return

    setImageUploading(true)
    try {
      const reader = new FileReader()
      const base64Raw = await new Promise<string>((resolve, reject) => {
        reader.onload = (e) => resolve(e.target?.result as string)
        reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'))
        reader.readAsDataURL(file)
      })

      const base64 = await resizeImage(base64Raw)

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64,
          fileName: `${card.id}_${Date.now()}.jpg`
        }),
      })

      if (!res.ok) throw new Error(res.status === 413 ? '画像が大きすぎます' : `エラー: ${res.status}`)

      const data = await res.json()
      if (data.success) {
        await supabase.from('cards').update({ image_url: data.url }).eq('id', card.id)
        onImageChanged(data.url)
        onUpdated?.()
      }
    } catch (err: any) {
      alert('アップロードエラー: ' + err.message)
    } finally {
      setImageUploading(false)
    }
  }

  const handleImageClick = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = (e: any) => {
      const file = e.target.files[0]
      if (file) {
        const dt = new DataTransfer()
        dt.items.add(file)
        handleImageDrop({ preventDefault: () => { }, stopPropagation: () => { }, dataTransfer: dt } as any)
      }
    }
    input.click()
  }

  return (
    <div className="p-6 border-b border-slate-100 flex items-start gap-6">
      {/* 画像 */}
      <div
        className={`relative group cursor-pointer flex-shrink-0 ${isDragging ? 'ring-4 ring-blue-400 ring-offset-2' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragEnter={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleImageDrop}
        onClick={handleImageClick}
      >
        {cardImageUrl ? (
          <img src={cardImageUrl} alt={card.name} className="w-40 h-56 object-cover rounded-xl shadow-lg" />
        ) : (
          <div className="w-40 h-56 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400">No Image</div>
        )}
        {isDragging && (
          <div className="absolute inset-0 bg-blue-500/30 rounded-xl flex items-center justify-center">
            <p className="text-white font-bold text-sm bg-blue-600 px-3 py-1.5 rounded-lg">ドロップ</p>
          </div>
        )}
        {imageUploading && (
          <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
        {!isDragging && !imageUploading && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-xl flex items-center justify-center transition-colors">
            <p className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 px-2 py-1 rounded">画像変更</p>
          </div>
        )}
      </div>

      {/* カード情報 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">{card?.name}</h2>
            {card?.pricecharting_name && (
              <p className="text-sm text-slate-400 mt-0.5">{card.pricecharting_name}</p>
            )}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {card?.card_number && (
                <span className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-sm">{card.card_number}</span>
              )}
              {card?.rarity && (
                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-sm font-medium">
                  {typeof card.rarity === 'object' ? card.rarity.name : card.rarity}
                </span>
              )}
              {card?.expansion && (
                <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">{card.expansion}</span>
              )}
            </div>
            {card?.category_large && (
              <p className="mt-2 text-slate-600">{card.category_large.icon} {card.category_large.name}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={onEdit} className="p-2 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors">
              <Edit size={20} />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors">
              <X size={24} />
            </button>
          </div>
        </div>

        {/* 価格サマリー */}
        <div className="flex flex-wrap gap-3 mt-4">
          {/* 買取価格カード */}
          <div className="bg-blue-50 rounded-xl p-4 min-w-[160px] flex-1">
            <div className="flex items-center gap-2 text-blue-600 text-sm mb-1">
              <Store size={16} />
              最新買取価格
            </div>
            <p className="text-2xl font-bold text-blue-700 tabular-nums">
              {latestPurchase ? `¥${latestPurchase.toLocaleString()}` : '-'}
            </p>
            {Object.keys(latestPurchaseByLabel).length > 0 && (
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                {Object.entries(latestPurchaseByLabel)
                  .sort((a, b) => b[1].price - a[1].price)
                  .map(([key, data]) => (
                    <span key={key} className="text-xs text-blue-500">
                      {data.label} ¥{data.price.toLocaleString()}
                      <span className="text-blue-400 ml-0.5">({data.shopName})</span>
                    </span>
                  ))}
              </div>
            )}
            {/* 海外価格差バッジ */}
            {priceDiffs.length > 0 && (
              <div className="mt-2 pt-2 border-t border-blue-100">
                <p className="text-[10px] text-blue-400 font-medium mb-1">vs 海外</p>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                  {priceDiffs.map(diff => {
                    const isPositive = diff.diffJpy > 0
                    const colorClass = isPositive ? 'text-emerald-600' : 'text-rose-600'
                    const Icon = isPositive ? TrendingUp : TrendingDown
                    return (
                      <span key={diff.label} className={`text-xs font-medium flex items-center gap-0.5 ${colorClass}`}>
                        <Icon size={11} />
                        {diff.displayLabel}
                        {' '}{isPositive ? '+' : ''}¥{diff.diffJpy.toLocaleString()}
                        {' '}({isPositive ? '+' : ''}{diff.diffPercent.toFixed(1)}%)
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 販売価格カード（最大3つ） */}
          {Object.entries(latestPrices)
            .filter(([, data]) => data.stock !== 0)
            .sort((a, b) => a[1].price - b[1].price)
            .slice(0, 3)
            .map(([siteId, data], index) => (
              <div key={siteId} className={`rounded-xl p-4 min-w-[140px] flex-1 ${
                index === 0 ? 'bg-green-50' : index === 1 ? 'bg-emerald-50' : 'bg-teal-50'
              }`}>
                <div className={`flex items-center gap-2 text-sm mb-1 ${
                  index === 0 ? 'text-green-600' : index === 1 ? 'text-emerald-600' : 'text-teal-600'
                }`}>
                  <Globe size={16} />
                  {data.siteName}
                </div>
                <p className={`text-2xl font-bold tabular-nums ${
                  index === 0 ? 'text-green-700' : index === 1 ? 'text-emerald-700' : 'text-teal-700'
                }`}>
                  ¥{data.price.toLocaleString()}
                </p>
                {data.stock !== null && (
                  <p className={`text-sm flex items-center gap-1 ${
                    index === 0 ? 'text-green-600' : index === 1 ? 'text-emerald-600' : 'text-teal-600'
                  }`}>
                    <Package size={14} />
                    在庫: {data.stock}
                  </p>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
