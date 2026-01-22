'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, X, RefreshCw } from 'lucide-react'

export default function ShopForm({ onClose, onSaved }) {
  const [loading, setLoading] = useState(false)
  
  const [form, setForm] = useState({
    name: '',
    x_account: '',
    icon: '🏪',
    status: 'active'
  })

  // アイコン候補
  const iconOptions = ['🏪', '🚀', '⚡', '🏠', '💎', '🎯', '🔥', '⭐', '🎴', '💳']

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    const { data, error } = await supabase
      .from('purchase_shops')
      .insert([{
        name: form.name,
        x_account: form.x_account,
        icon: form.icon,
        status: form.status
      }])
      .select()

    setLoading(false)

    if (error) {
      alert('エラー: ' + error.message)
      return
    }

    alert('買取店舗を登録しました！')
    if (onSaved) onSaved()
    if (onClose) onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-[500px] max-h-[90vh] overflow-auto">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">買取店舗追加</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* アイコン選択 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              アイコン
            </label>
            <div className="flex flex-wrap gap-2">
              {iconOptions.map(icon => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setForm({ ...form, icon })}
                  className={`w-10 h-10 text-xl rounded-lg border-2 transition-colors ${
                    form.icon === icon
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* 店舗名 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              店舗名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="例: Blue Rocket"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Xアカウント */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Xアカウント
            </label>
            <div className="flex">
              <span className="px-3 py-2 bg-gray-100 border border-r-0 border-gray-200 rounded-l-lg text-gray-500">@</span>
              <input
                type="text"
                value={form.x_account}
                onChange={(e) => setForm({ ...form, x_account: e.target.value })}
                placeholder="bluerocket_tcg"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-r-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">買取表を投稿するXアカウント</p>
          </div>

          {/* ステータス */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ステータス
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="active"
                  checked={form.status === 'active'}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="text-blue-500"
                />
                <span className="text-sm">監視中</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="status"
                  value="paused"
                  checked={form.status === 'paused'}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                  className="text-blue-500"
                />
                <span className="text-sm">停止中</span>
              </label>
            </div>
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
