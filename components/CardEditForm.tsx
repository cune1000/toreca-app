'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { X, Save, RefreshCw, Image, Trash2 } from 'lucide-react'

export default function CardEditForm({ card, onClose, onSaved }) {
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [categories, setCategories] = useState([])
  const [rarities, setRarities] = useState([])
  const [mediumCategories, setMediumCategories] = useState([])
  const [imagePreview, setImagePreview] = useState(card?.image_url || null)
  const [expansionSuggestions, setExpansionSuggestions] = useState<string[]>([])
  const [raritySuggestions, setRaritySuggestions] = useState<string[]>([])
  const [showExpansionDropdown, setShowExpansionDropdown] = useState(false)
  const [showRarityDropdown, setShowRarityDropdown] = useState(false)
  const fileInputRef = useRef(null)
  const expansionInputRef = useRef<HTMLInputElement>(null)
  const rarityInputRef = useRef<HTMLInputElement>(null)
  
  const [form, setForm] = useState({
    name: card?.name || '',
    card_number: card?.card_number || '',
    category_large_id: card?.category_large_id || '',
    category_medium_id: card?.category_medium_id || '',
    rarity_id: card?.rarity_id || '',
    rarity: card?.rarity || '',
    expansion: card?.expansion || '',
    image_url: card?.image_url || ''
  })

  // 大カテゴリ取得
  useEffect(() => {
    async function fetchCategories() {
      const { data } = await supabase
        .from('category_large')
        .select('*')
        .order('sort_order')
      setCategories(data || [])
    }
    fetchCategories()
  }, [])

  // 過去の収録弾・レアリティを取得（サジェスト用）
  useEffect(() => {
    async function fetchSuggestions() {
      // 収録弾のユニーク値を取得
      const { data: expansionData } = await supabase
        .from('cards')
        .select('expansion')
        .not('expansion', 'is', null)
        .order('expansion')
      
      if (expansionData) {
        const uniqueExpansions = [...new Set(expansionData.map(d => d.expansion).filter(Boolean))]
        setExpansionSuggestions(uniqueExpansions as string[])
      }

      // レアリティのユニーク値を取得（テキスト入力用）
      const { data: rarityData } = await supabase
        .from('cards')
        .select('rarity')
        .not('rarity', 'is', null)
        .order('rarity')
      
      if (rarityData) {
        const uniqueRarities = [...new Set(rarityData.map(d => d.rarity).filter(Boolean))]
        setRaritySuggestions(uniqueRarities as string[])
      }
    }
    fetchSuggestions()
  }, [])

  // 大カテゴリが変わったらレアリティと中カテゴリを取得
  useEffect(() => {
    async function fetchRarities() {
      if (!form.category_large_id) {
        setRarities([])
        setMediumCategories([])
        return
      }
      
      const { data: rarityData } = await supabase
        .from('rarities')
        .select('*')
        .eq('large_id', form.category_large_id)
        .order('sort_order')
      setRarities(rarityData || [])
      
      const { data: mediumData } = await supabase
        .from('category_medium')
        .select('*')
        .eq('large_id', form.category_large_id)
        .order('sort_order')
      setMediumCategories(mediumData || [])
    }
    fetchRarities()
  }, [form.category_large_id])

  // 画像選択
  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = async (e) => {
      const base64 = e.target?.result as string
      setImagePreview(base64)
      
      setUploading(true)
      try {
        const res = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            image: base64,
            fileName: `${card.id}_${Date.now()}.jpg`
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

  // 収録弾のフィルタリング
  const filteredExpansions = expansionSuggestions.filter(exp =>
    exp.toLowerCase().includes(form.expansion.toLowerCase())
  )

  // レアリティのフィルタリング
  const filteredRarities = raritySuggestions.filter(r =>
    r.toLowerCase().includes(form.rarity.toLowerCase())
  )

  // 保存
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase
      .from('cards')
      .update({
        name: form.name,
        card_number: form.card_number || null,
        category_large_id: form.category_large_id || null,
        category_medium_id: form.category_medium_id || null,
        rarity_id: form.rarity_id || null,
        rarity: form.rarity || null,
        expansion: form.expansion || null,
        image_url: form.image_url || null
      })
      .eq('id', card.id)

    setLoading(false)

    if (error) {
      alert('エラー: ' + error.message)
      return
    }

    alert('カードを更新しました！')
    if (onSaved) onSaved()
    if (onClose) onClose()
  }

  // 削除
  const handleDelete = async () => {
    if (!confirm('このカードを削除しますか？')) return
    
    setDeleting(true)

    const { error } = await supabase
      .from('cards')
      .delete()
      .eq('id', card.id)

    setDeleting(false)

    if (error) {
      alert('エラー: ' + error.message)
      return
    }

    alert('カードを削除しました')
    if (onSaved) onSaved()
    if (onClose) onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-[600px] max-h-[90vh] overflow-auto">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">カード編集</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 画像 */}
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
                  <img src={imagePreview} alt="Preview" className="max-h-48 mx-auto rounded-lg" />
                  {uploading && (
                    <div className="absolute inset-0 bg-white/80 flex items-center justify-center rounded-lg">
                      <RefreshCw className="animate-spin text-blue-500" size={24} />
                    </div>
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
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* カード番号 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              カード番号（型番）
            </label>
            <input
              type="text"
              value={form.card_number}
              onChange={(e) => setForm({ ...form, card_number: e.target.value })}
              placeholder="例: 110/080"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* 収録弾 */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              収録弾
            </label>
            <input
              ref={expansionInputRef}
              type="text"
              value={form.expansion}
              onChange={(e) => setForm({ ...form, expansion: e.target.value })}
              onFocus={() => setShowExpansionDropdown(true)}
              onBlur={() => setTimeout(() => setShowExpansionDropdown(false), 200)}
              placeholder="例: バイオレットex"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {showExpansionDropdown && filteredExpansions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                {filteredExpansions.slice(0, 10).map((exp, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setForm({ ...form, expansion: exp })
                      setShowExpansionDropdown(false)
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-blue-50 text-sm"
                  >
                    {exp}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* レアリティ（テキスト入力） */}
          <div className="relative">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              レアリティ
            </label>
            <input
              ref={rarityInputRef}
              type="text"
              value={form.rarity}
              onChange={(e) => setForm({ ...form, rarity: e.target.value })}
              onFocus={() => setShowRarityDropdown(true)}
              onBlur={() => setTimeout(() => setShowRarityDropdown(false), 200)}
              placeholder="例: SAR, SR, RR"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {showRarityDropdown && filteredRarities.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-auto">
                {filteredRarities.slice(0, 10).map((r, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setForm({ ...form, rarity: r })
                      setShowRarityDropdown(false)
                    }}
                    className="w-full px-3 py-2 text-left hover:bg-purple-50 text-sm"
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
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
              {categories.map((cat: any) => (
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
                {mediumCategories.map((cat: any) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          )}

          {/* レアリティ（ボタン選択）- カテゴリに紐づくもの */}
          {rarities.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                レアリティ（カテゴリ別）
              </label>
              <div className="flex flex-wrap gap-2">
                {rarities.map((rarity: any) => (
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
          <div className="flex justify-between pt-4">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50 flex items-center gap-2"
            >
              {deleting ? <RefreshCw size={16} className="animate-spin" /> : <Trash2 size={16} />}
              削除
            </button>
            <div className="flex gap-3">
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
                    保存中...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    保存
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
