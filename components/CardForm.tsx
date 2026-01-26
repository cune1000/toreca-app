'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { getLargeCategories, getMediumCategories, getRarities } from '@/lib/api/categories'
import { addCard } from '@/lib/api/cards'
import { Plus, X, RefreshCw, Image } from 'lucide-react'

interface Category {
  id: string
  name: string
  icon?: string
}

interface Rarity {
  id: string
  name: string
}

interface FormData {
  name: string
  card_number: string
  category_large_id: string
  category_medium_id: string
  rarity_id: string
  image_url: string
}

interface Props {
  onClose: () => void
  onSaved?: () => void
}

export default function CardForm({ onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [categories, setCategories] = useState<Category[]>([])
  const [rarities, setRarities] = useState<Rarity[]>([])
  const [mediumCategories, setMediumCategories] = useState<Category[]>([])
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // フォームデータ
  const [form, setForm] = useState<FormData>({
    name: '',
    card_number: '',
    category_large_id: '',
    category_medium_id: '',
    rarity_id: '',
    image_url: ''
  })

  // 大カテゴリ取得
  useEffect(() => {
    async function fetchCategories() {
      const data = await getLargeCategories()
      setCategories(data)
    }
    fetchCategories()
  }, [])

  // 大カテゴリが変わったらレアリティと中カテゴリを取得
  useEffect(() => {
    async function fetchRelatedData() {
      if (!form.category_large_id) {
        setRarities([])
        setMediumCategories([])
        return
      }
      
      const [rarityData, mediumData] = await Promise.all([
        getRarities(form.category_large_id),
        getMediumCategories(form.category_large_id)
      ])
      
      setRarities(rarityData)
      setMediumCategories(mediumData)
    }
    fetchRelatedData()
  }, [form.category_large_id])

  // 画像選択
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = e.target?.result as string
      setImagePreview(base64)
      
      // アップロード
      setUploading(true)
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            image: base64,
            fileName: `${Date.now()}_${file.name}`
          }),
        })
        const data = await res.json()
        
        if (data.success) {
          setForm({ ...form, image_url: data.url })
        } else {
          alert('アップロードに失敗しました: ' + data.error)
        }
      } catch (err: any) {
        alert('アップロードエラー: ' + err.message)
      }
      setUploading(false)
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const result = await addCard({
      name: form.name,
      card_number: form.card_number || undefined,
      category_large_id: form.category_large_id || undefined,
      category_medium_id: form.category_medium_id || undefined,
      rarity_id: form.rarity_id || undefined,
      image_url: form.image_url || undefined
    })

    setLoading(false)

    if (!result) {
      alert('カードの登録に失敗しました')
      return
    }

    alert('カードを登録しました！')
    if (onSaved) onSaved()
    if (onClose) onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-[600px] max-h-[90vh] overflow-auto">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">カード追加</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 画像アップロード */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              カード画像
            </label>
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
            >
              {imagePreview ? (
                <div className="relative">
                  <img src={imagePreview} alt="Preview" className="max-h-40 mx-auto rounded-lg" />
                  {uploading && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg">
                      <RefreshCw className="animate-spin text-blue-500" size={24} />
                      <span className="ml-2 text-blue-500">アップロード中...</span>
                    </div>
                  )}
                  {form.image_url && !uploading && (
                    <p className="text-xs text-green-600 mt-2">✓ アップロード完了</p>
                  )}
                </div>
              ) : (
                <div className="py-4">
                  <Image size={32} className="mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">クリックして画像を選択</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
          </div>

          {/* カード名 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              カード名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="例: メガカイリューex"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* カード番号 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              カード番号
            </label>
            <input
              type="text"
              value={form.card_number}
              onChange={(e) => setForm({ ...form, card_number: e.target.value })}
              placeholder="例: 246/193"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 大カテゴリ */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              大カテゴリ
            </label>
            <select
              value={form.category_large_id}
              onChange={(e) => setForm({ ...form, category_large_id: e.target.value, category_medium_id: '', rarity_id: '' })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">選択してください</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
              ))}
            </select>
          </div>

          {/* 中カテゴリ */}
          {mediumCategories.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                中カテゴリ
              </label>
              <select
                value={form.category_medium_id}
                onChange={(e) => setForm({ ...form, category_medium_id: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">選択してください</option>
                {mediumCategories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* レアリティ */}
          {rarities.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                レアリティ
              </label>
              <div className="flex flex-wrap gap-2">
                {rarities.map((rarity) => (
                  <button
                    key={rarity.id}
                    type="button"
                    onClick={() => setForm({ ...form, rarity_id: rarity.id })}
                    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                      form.rarity_id === rarity.id
                        ? 'bg-purple-100 border-purple-300 text-purple-700'
                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {rarity.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ボタン */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading || uploading || !form.name}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  登録中...
                </>
              ) : (
                <>
                  <Plus size={16} />
                  登録
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
