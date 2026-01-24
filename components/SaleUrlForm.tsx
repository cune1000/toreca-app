'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { X, Loader2 } from 'lucide-react'

interface SaleUrlFormProps {
  cardId: string
  onClose: () => void
  onSaved: () => void
}

export default function SaleUrlForm({ cardId, onClose, onSaved }: SaleUrlFormProps) {
  const [sites, setSites] = useState<any[]>([])
  const [form, setForm] = useState({ site_id: '', product_url: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchSites = async () => {
      const { data } = await supabase
        .from('sale_sites')
        .select('id, name, icon')
        .order('name')
      setSites(data || [])
    }
    fetchSites()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!form.site_id || !form.product_url) {
      setError('サイトとURLを入力してください')
      return
    }

    setSaving(true)
    try {
      const { error: insertError } = await supabase
        .from('card_sale_urls')
        .insert([{
          card_id: cardId,
          site_id: form.site_id,
          product_url: form.product_url
        }])

      if (insertError) throw insertError

      // 初回スクレイピングを実行
      const site = sites.find(s => s.id === form.site_id)
      const siteName = site?.name?.toLowerCase() || ''
      let source = null
      if (siteName.includes('スニダン') || siteName.includes('snkrdunk')) {
        source = 'snkrdunk'
      } else if (siteName.includes('カードラッシュ') || siteName.includes('cardrush')) {
        source = 'cardrush'
      } else if (siteName.includes('トレカキャンプ') || siteName.includes('torecacamp')) {
        source = 'torecacamp'
      }

      try {
        const res = await fetch('/api/scrape', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: form.product_url, source }),
        })
        const data = await res.json()

        if (data.success && data.price) {
          // 在庫数を取得（数値または文字列に対応）
          let stock = null
          if (data.stock !== null && data.stock !== undefined) {
            if (typeof data.stock === 'number') {
              stock = data.stock
            } else if (typeof data.stock === 'string') {
              const stockMatch = data.stock.match(/(\d+)/)
              if (stockMatch) {
                stock = parseInt(stockMatch[1], 10)
              } else if (data.stock.includes('あり') || data.stock.includes('在庫')) {
                stock = 1
              } else if (data.stock.includes('なし') || data.stock.includes('売切')) {
                stock = 0
              }
            }
          }

          // 価格を保存
          await supabase.from('sale_prices').insert({
            card_id: cardId,
            site_id: form.site_id,
            price: data.priceNumber || data.price,
            stock: stock
          })
        }
      } catch (scrapeErr) {
        console.log('Initial scrape failed:', scrapeErr)
        // スクレイピング失敗しても登録は成功
      }

      onSaved()
    } catch (err: any) {
      console.error('Save error:', err)
      setError('保存に失敗しました: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-2xl w-[500px] p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">販売URL追加</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">販売サイト</label>
            <select
              value={form.site_id}
              onChange={(e) => setForm({ ...form, site_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">選択してください</option>
              {sites.map(site => (
                <option key={site.id} value={site.id}>
                  {site.icon} {site.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">商品URL</label>
            <input
              type="url"
              value={form.product_url}
              onChange={(e) => setForm({ ...form, product_url: e.target.value })}
              placeholder="https://..."
              className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <p className="text-red-500 text-sm">{error}</p>
          )}

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
              disabled={saving}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
