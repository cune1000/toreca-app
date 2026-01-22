'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, X, Upload, Check, RefreshCw } from 'lucide-react'

export default function CardForm({ onClose, onSaved }) {
  const [loading, setLoading] = useState(false)
  const [categories, setCategories] = useState([])
  const [rarities, setRarities] = useState([])
  const [mediumCategories, setMediumCategories] = useState([])
  
  // フォームデータ
  const [form, setForm] = useState({
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
      const { data } = await supabase
        .from('category_large')
        .select('*')
        .order('sort_order')
      setCategories(data || [])
    }
    fetchCategories()
  }, [])

  // 大カテゴリが変わったらレアリティと中カテゴリを取得
  useEffect(() => {
    async function fetchRarities() {
      if (!form.category_large_id) {
        setRarities([])
        setMediumCategories([])
        return
      }
      
      // レアリティ取得
      const { data: rarityData } = await supabase
        .from('rarities')
        .select('*')
        .eq('large_id', form.category_large_id)
        .order('sort_order')
      setRarities(rarityData || [])
      
      // 中カテゴリ取得
      const { data: mediumData } = await supabase
        .from('category_medium')
        .select('*')
        .eq('large_id', form.category_large_id)
        .order('sort_order')
      setMediumCategories(mediumData || [])
    }
    fetchRarities()
  }, [form.category_large_id])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    const { data, error } = await supabase
      .from('cards')
      .insert([{
        name: form.name,
        card_number: form.card_number,
        category_large_id: form.category_large_id || null,
        category_medium_id: form.category_medium_id || null,
        rarity_id: form.rarity_id || null,
        image_url: form.image_url || null
      }])
      .select()

    setLoading(false)

    if (error) {
      alert('エラー: ' + error.message)
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
              {categories.map(cat => (
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
                {mediumCategories.map(cat => (
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
                {rarities.map(rarity => (
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

          {/* 画像URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              画像URL（オプション）
            </label>
            <input
              type="text"
              value={form.image_url}
              onChange={(e) => setForm({ ...form, image_url: e.target.value })}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

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
              disabled={loading || !form.name}
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
