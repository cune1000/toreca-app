'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { X, Plus, RefreshCw, Link } from 'lucide-react'

export default function SaleUrlForm({ card, onClose, onSaved }) {
  const [loading, setLoading] = useState(false)
  const [sites, setSites] = useState([])
  const [form, setForm] = useState({
    site_id: '',
    product_url: ''
  })

  // 販売サイト一覧を取得
  useEffect(() => {
    async function fetchSites() {
      const { data } = await supabase
        .from('sale_sites')
        .select('*')
        .order('name')
      setSites(data || [])
    }
    fetchSites()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    const { error } = await supabase
      .from('card_sale_urls')
      .insert([{
        card_id: card.id,
        site_id: form.site_id,
        product_url: form.product_url
      }])

    setLoading(false)

    if (error) {
      alert('エラー: ' + error.message)
      return
    }

    alert('販売URLを登録しました！')
    if (onSaved) onSaved()
    if (onClose) onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-[500px]">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Link size={20} className="text-green-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">販売URL追加</h2>
              <p className="text-sm text-gray-500">{card?.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 販売サイト選択 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              販売サイト <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={form.site_id}
              onChange={(e) => setForm({ ...form, site_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="">選択してください</option>
              {sites.map((site: any) => (
                <option key={site.id} value={site.id}>{site.icon} {site.name}</option>
              ))}
            </select>
          </div>

          {/* URL入力 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              商品ページURL <span className="text-red-500">*</span>
            </label>
            <input
              type="url"
              required
              value={form.product_url}
              onChange={(e) => setForm({ ...form, product_url: e.target.value })}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
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
              disabled={loading || !form.site_id || !form.product_url}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
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
