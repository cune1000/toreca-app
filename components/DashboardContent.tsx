'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Database, Store, Globe, Clock, TrendingUp } from 'lucide-react'

export default function DashboardContent() {
  const [cards, setCards] = useState([])
  const [categories, setCategories] = useState([])
  const [purchaseShops, setPurchaseShops] = useState([])
  const [saleSites, setSaleSites] = useState([])
  const [recognitionQueue, setRecognitionQueue] = useState([])
  const [loading, setLoading] = useState(true)

  // サンプル価格推移データ
  const priceHistory = [
    { date: '1/14', purchase: 58000, sale: 64000 },
    { date: '1/15', purchase: 59000, sale: 65000 },
    { date: '1/16', purchase: 60000, sale: 66000 },
    { date: '1/17', purchase: 61000, sale: 67000 },
    { date: '1/18', purchase: 60000, sale: 66000 },
    { date: '1/19', purchase: 62000, sale: 68000 },
    { date: '1/20', purchase: 62000, sale: 68000 },
  ]

  useEffect(() => {
    async function fetchData() {
      // カード数
      const { data: cardsData } = await supabase.from('cards').select('*')
      setCards(cardsData || [])

      // 大カテゴリ
      const { data: catData } = await supabase.from('category_large').select('*')
      setCategories(catData || [])

      // 買取店舗
      const { data: shopsData } = await supabase.from('purchase_shops').select('*')
      setPurchaseShops(shopsData || [])

      // 販売サイト
      const { data: sitesData } = await supabase.from('sale_sites').select('*')
      setSaleSites(sitesData || [])

      // 認識キュー
      const { data: queueData } = await supabase.from('recognition_queue').select('*').eq('status', 'pending')
      setRecognitionQueue(queueData || [])

      setLoading(false)
    }
    fetchData()
  }, [])

  if (loading) {
    return <div className="p-6">読み込み中...</div>
  }

  return (
    <div className="p-6 space-y-6">
      {/* 統計カード */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">登録カード</p>
              <p className="text-2xl font-bold text-gray-800">{cards.length}</p>
            </div>
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Database size={20} className="text-blue-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">買取店舗</p>
              <p className="text-2xl font-bold text-gray-800">{purchaseShops.length}</p>
            </div>
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Store size={20} className="text-green-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">販売サイト</p>
              <p className="text-2xl font-bold text-gray-800">{saleSites.length}</p>
            </div>
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Globe size={20} className="text-purple-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">認識待ち</p>
              <p className="text-2xl font-bold text-yellow-600">{recognitionQueue.length}</p>
            </div>
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock size={20} className="text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* 価格推移グラフ */}
        <div className="col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800">価格推移サンプル</h2>
            <select className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm">
              <option>過去7日間</option>
              <option>過去30日間</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={priceHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `¥${(v/1000)}k`} />
              <Tooltip formatter={(value) => `¥${value.toLocaleString()}`} />
              <Area type="monotone" dataKey="sale" stroke="#10b981" fill="#10b98120" strokeWidth={2} name="販売価格" />
              <Area type="monotone" dataKey="purchase" stroke="#3b82f6" fill="#3b82f620" strokeWidth={2} name="買取価格" />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-xs text-gray-600">買取価格</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-xs text-gray-600">販売価格</span>
            </div>
          </div>
        </div>

        {/* DBデータ確認 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-bold text-gray-800 mb-4">DBデータ</h2>
          
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500 mb-2">大カテゴリ</p>
              {categories.map(cat => (
                <div key={cat.id} className="flex items-center gap-2 py-1">
                  <span>{cat.icon}</span>
                  <span className="text-sm">{cat.name}</span>
                </div>
              ))}
            </div>

            <div>
              <p className="text-sm text-gray-500 mb-2">販売サイト</p>
              {saleSites.map(site => (
                <div key={site.id} className="flex items-center gap-2 py-1">
                  <span>{site.icon}</span>
                  <span className="text-sm">{site.name}</span>
                  <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${
                    site.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {site.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* カード一覧（DBから） */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-800">登録カード一覧（DB）</h2>
          <span className="text-sm text-gray-500">{cards.length}件</span>
        </div>
        {cards.length > 0 ? (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">カード名</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">カード番号</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">登録日</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {cards.map(card => (
                <tr key={card.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{card.name}</td>
                  <td className="px-4 py-3 text-gray-600">{card.card_number}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-500">
                    {new Date(card.created_at).toLocaleDateString('ja-JP')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <p>まだカードが登録されていません</p>
            <p className="text-sm mt-2">「カード管理」からカードを追加してください</p>
          </div>
        )}
      </div>
    </div>
  )
}
