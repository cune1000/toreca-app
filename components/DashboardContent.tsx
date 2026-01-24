'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Database, Store, Globe, Clock, Search, RefreshCw, TrendingUp, AlertCircle } from 'lucide-react'

export default function DashboardContent() {
  const [stats, setStats] = useState({ cards: 0, shops: 0, sites: 0, pending: 0 })
  const [categories, setCategories] = useState([])
  const [saleSites, setSaleSites] = useState([])
  const [recentCards, setRecentCards] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [isSearching, setIsSearching] = useState(false)
  const [priceChanges, setPriceChanges] = useState([])
  const [cronStats, setCronStats] = useState({ success: 0, errors: 0, changes: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    
    // カード数（カウントのみ）
    const { count: cardCount } = await supabase.from('cards').select('*', { count: 'exact', head: true })
    
    // 買取店舗数
    const { count: shopCount } = await supabase.from('purchase_shops').select('*', { count: 'exact', head: true })
    
    // 販売サイト数
    const { count: siteCount } = await supabase.from('sale_sites').select('*', { count: 'exact', head: true })
    
    // 保留中
    const { count: pendingCount } = await supabase.from('pending_images').select('*', { count: 'exact', head: true }).eq('status', 'pending')
    
    setStats({
      cards: cardCount || 0,
      shops: shopCount || 0,
      sites: siteCount || 0,
      pending: pendingCount || 0
    })

    // 大カテゴリ
    const { data: catData } = await supabase.from('category_large').select('*').order('sort_order')
    setCategories(catData || [])

    // 販売サイト
    const { data: sitesData } = await supabase.from('sale_sites').select('*')
    setSaleSites(sitesData || [])

    // 最近登録されたカード（50件）
    const { data: cardsData } = await supabase
      .from('cards')
      .select('id, name, card_number, created_at')
      .order('created_at', { ascending: false })
      .limit(50)
    setRecentCards(cardsData || [])

    // 価格変動（過去24時間）
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: changesData } = await supabase
      .from('cron_logs')
      .select('card_name, site_name, old_price, new_price, executed_at')
      .eq('price_changed', true)
      .gte('executed_at', oneDayAgo)
      .order('executed_at', { ascending: false })
      .limit(10)
    setPriceChanges(changesData || [])

    // Cron統計（過去24時間）
    const { data: cronData } = await supabase
      .from('cron_logs')
      .select('status, price_changed')
      .gte('executed_at', oneDayAgo)
    
    if (cronData) {
      setCronStats({
        success: cronData.filter(l => l.status === 'success').length,
        errors: cronData.filter(l => l.status === 'error').length,
        changes: cronData.filter(l => l.price_changed).length
      })
    }

    setLoading(false)
  }

  // リアルタイム検索
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      const { data } = await supabase
        .from('cards')
        .select('id, name, card_number, image_url')
        .or(`name.ilike.%${searchQuery}%,card_number.ilike.%${searchQuery}%`)
        .limit(10)
      setSearchResults(data || [])
      setIsSearching(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

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

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <RefreshCw className="animate-spin text-gray-400" size={32} />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* 統計カード */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">登録カード</p>
              <p className="text-2xl font-bold text-gray-800">{stats.cards.toLocaleString()}</p>
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
              <p className="text-2xl font-bold text-gray-800">{stats.shops}</p>
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
              <p className="text-2xl font-bold text-gray-800">{stats.sites}</p>
            </div>
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Globe size={20} className="text-purple-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">保留中</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock size={20} className="text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      {/* 監視状況（24h） */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-green-50 rounded-xl p-4 border border-green-200">
          <p className="text-sm text-green-600">24h チェック成功</p>
          <p className="text-2xl font-bold text-green-700">{cronStats.success}</p>
        </div>
        <div className="bg-red-50 rounded-xl p-4 border border-red-200">
          <p className="text-sm text-red-600">24h エラー</p>
          <p className="text-2xl font-bold text-red-700">{cronStats.errors}</p>
        </div>
        <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
          <p className="text-sm text-blue-600">24h 価格変動</p>
          <p className="text-2xl font-bold text-blue-700">{cronStats.changes}</p>
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

        {/* 最近の価格変動 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-blue-500" />
            最近の価格変動
          </h2>
          {priceChanges.length > 0 ? (
            <div className="space-y-3 max-h-[280px] overflow-auto">
              {priceChanges.map((change, i) => (
                <div key={i} className="p-2 bg-gray-50 rounded-lg">
                  <p className="text-sm font-medium text-gray-800 truncate">{change.card_name}</p>
                  <p className="text-xs text-gray-500">{change.site_name}</p>
                  <p className="text-sm">
                    <span className="text-gray-400">¥{change.old_price?.toLocaleString()}</span>
                    <span className="mx-1">→</span>
                    <span className={change.new_price > change.old_price ? 'text-red-600' : 'text-green-600'}>
                      ¥{change.new_price?.toLocaleString()}
                    </span>
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">24時間以内の変動なし</p>
          )}
        </div>
      </div>

      {/* カード検索 + 一覧 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-gray-800">カード検索・一覧</h2>
            <span className="text-sm text-gray-500">最新50件表示</span>
          </div>
          
          {/* 検索ボックス */}
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="カード名・型番で検索（2文字以上）"
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
            />
            {isSearching && <RefreshCw size={18} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-blue-500" />}
          </div>
          
          {/* 検索結果 */}
          {searchResults.length > 0 && (
            <div className="mt-3 p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-blue-600 mb-2">検索結果: {searchResults.length}件</p>
              <div className="flex flex-wrap gap-2">
                {searchResults.map(card => (
                  <div key={card.id} className="flex items-center gap-2 px-2 py-1 bg-white rounded border text-sm">
                    {card.image_url && <img src={card.image_url} alt="" className="w-6 h-8 object-cover rounded" />}
                    <span className="truncate max-w-[150px]">{card.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
            <p className="mt-3 text-sm text-gray-500">「{searchQuery}」に一致するカードが見つかりません</p>
          )}
        </div>
        
        {/* 最近のカード一覧 */}
        {recentCards.length > 0 ? (
          <div className="max-h-[400px] overflow-auto">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">カード名</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">カード番号</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">登録日</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentCards.map(card => (
                  <tr key={card.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{card.name}</td>
                    <td className="px-4 py-3 text-gray-600">{card.card_number || '-'}</td>
                    <td className="px-4 py-3 text-right text-sm text-gray-500">
                      {new Date(card.created_at).toLocaleDateString('ja-JP')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
