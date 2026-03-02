'use client'

import { useState, useEffect } from 'react'
import {
  getDashboardStats,
  getPriceChanges,
  getCronStats,
  searchCardsForDashboard,
  getLargeCategories,
} from '@/lib/api/dashboard'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { Database, Store, Globe, Clock, Search, RefreshCw, TrendingUp, AlertCircle, Sparkles } from 'lucide-react'

interface Stats {
  cards: number
  shops: number
  sites: number
}

interface CronStats {
  success: number
  errors: number
  changes: number
}

interface PriceChange {
  card_id?: string
  card_name: string
  site_name: string
  site_url?: string
  old_price: number | null
  new_price: number | null
  executed_at: string
}

interface SearchResult {
  id: string
  name: string
  card_number?: string
  image_url?: string
  price_a?: number
  price_a_date?: string
  price_psa10?: number
  price_psa10_date?: string
  justtcg_nm_price_usd?: number
  pc_loose_usd?: number
  pc_loose_jpy?: number
  pc_graded_usd?: number
  pc_graded_jpy?: number
}

// 価格変動閾値（10%以上 or 1000円以上）
const PRICE_CHANGE_THRESHOLD_PERCENT = 10
const PRICE_CHANGE_THRESHOLD_YEN = 1000

export default function DashboardContent() {
  const [stats, setStats] = useState<Stats>({ cards: 0, shops: 0, sites: 0 })
  const [categories, setCategories] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [priceChanges, setPriceChanges] = useState<PriceChange[]>([])
  const [cronStats, setCronStats] = useState<CronStats>({ success: 0, errors: 0, changes: 0 })
  const [loading, setLoading] = useState(true)
  const [priceIndexData, setPriceIndexData] = useState<any[]>([])
  const [indexDays, setIndexDays] = useState(7)
  const [selectedCard, setSelectedCard] = useState<SearchResult | null>(null)
  const [newProducts, setNewProducts] = useState<any>({})
  const [newProductDays, setNewProductDays] = useState(7)
  const [newProductLoading, setNewProductLoading] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)

    // 並列で全データ取得（lib/api使用）
    const [statsData, categoriesData, changesData, cronStatsData] = await Promise.all([
      getDashboardStats(),
      getLargeCategories(),
      getPriceChanges(24, 50),
      getCronStats(24)
    ])

    setStats(statsData)
    setCategories(categoriesData)
    setPriceChanges(changesData)
    setCronStats(cronStatsData)

    // 価格インデックス取得
    await fetchPriceIndex(indexDays)

    // 新着商品取得
    await fetchNewProducts(newProductDays)

    setLoading(false)
  }

  const fetchPriceIndex = async (days: number) => {
    try {
      const res = await fetch(`/api/price-index?category=ポケモン&days=${days}`)
      const json = await res.json()
      if (json.success && json.chart) {
        setPriceIndexData(json.chart)
      }
    } catch (e) {
      console.error('Price index fetch error:', e)
    }
  }

  useEffect(() => {
    if (!loading) fetchPriceIndex(indexDays)
  }, [indexDays])

  const fetchNewProducts = async (days: number) => {
    setNewProductLoading(true)
    try {
      const res = await fetch(`/api/new-products?days=${days}`)
      const json = await res.json()
      if (json.success) {
        setNewProducts(json)
      }
    } catch (e) {
      console.error('New products fetch error:', e)
    }
    setNewProductLoading(false)
  }

  useEffect(() => {
    if (!loading) fetchNewProducts(newProductDays)
  }, [newProductDays])

  // リアルタイム検索
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([])
      return
    }

    const timer = setTimeout(async () => {
      setIsSearching(true)
      const results = await searchCardsForDashboard(searchQuery, 10)
      setSearchResults(results)
      setIsSearching(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery])

  // 価格インデックス用にデータを変換
  const chartDataForDisplay = priceIndexData.map((row: any) => ({
    date: row.date?.slice(5) || '',
    ...row
  }))

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
        {/* 価格インデックスグラフ */}
        <div className="col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800">📊 価格インデックス（ポケモン）</h2>
            <select
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
              value={indexDays}
              onChange={(e) => setIndexDays(Number(e.target.value))}
            >
              <option value={7}>過去7日間</option>
              <option value={30}>過去30日間</option>
              <option value={90}>過去90日間</option>
            </select>
          </div>
          {chartDataForDisplay.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <AreaChart data={chartDataForDisplay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `¥${(v / 1000)}k`} />
                <Tooltip formatter={(value: number) => `¥${value?.toLocaleString() || 0}`} />
                <Area type="monotone" dataKey="SAR_PSA10_sale" stroke="#ef4444" fill="#ef444420" strokeWidth={2} name="SAR PSA10" />
                <Area type="monotone" dataKey="SAR_A_sale" stroke="#f97316" fill="#f9731620" strokeWidth={2} name="SAR 状態A" />
                <Area type="monotone" dataKey="AR_PSA10_sale" stroke="#3b82f6" fill="#3b82f620" strokeWidth={2} name="AR PSA10" />
                <Area type="monotone" dataKey="SAR_ALL_purchase" stroke="#22c55e" fill="#22c55e20" strokeWidth={2} name="SAR 買取" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex items-center justify-center text-gray-400">
              <p>データがありません（集計待ち）</p>
            </div>
          )}
          <div className="flex justify-center gap-4 mt-2 flex-wrap">
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-xs text-gray-600">SAR PSA10</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
              <span className="text-xs text-gray-600">SAR 状態A</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-xs text-gray-600">AR PSA10</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-xs text-gray-600">SAR 買取</span>
            </div>
          </div>
        </div>

        {/* 最近の価格変動（フィルタリング済み） */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-bold text-gray-800 mb-2 flex items-center gap-2">
            <TrendingUp size={18} className="text-blue-500" />
            重要な価格変動
          </h2>
          <p className="text-xs text-gray-400 mb-3">{PRICE_CHANGE_THRESHOLD_PERCENT}%以上 or ¥{PRICE_CHANGE_THRESHOLD_YEN.toLocaleString()}以上</p>
          {(() => {
            const filtered = priceChanges.filter(c => {
              if (!c.old_price || !c.new_price) return false
              const diff = Math.abs(c.new_price - c.old_price)
              const percent = (diff / c.old_price) * 100
              return percent >= PRICE_CHANGE_THRESHOLD_PERCENT || diff >= PRICE_CHANGE_THRESHOLD_YEN
            })
            return filtered.length > 0 ? (
              <div className="space-y-2 max-h-[280px] overflow-auto">
                {filtered.slice(0, 10).map((change, i) => {
                  const diff = (change.new_price || 0) - (change.old_price || 0)
                  const isUp = diff > 0
                  return (
                    <div
                      key={i}
                      className="p-3 bg-gray-50 rounded-lg"
                    >
                      <p className="text-sm font-medium text-gray-800 truncate mb-1">{change.card_name}</p>
                      <p className="text-xs text-gray-500 mb-1">{change.site_name}</p>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">¥{change.old_price?.toLocaleString()}</span>
                        <span className="text-gray-400">→</span>
                        <span className="text-sm font-medium text-gray-800">¥{change.new_price?.toLocaleString()}</span>
                        <span className={`text-sm font-bold ${isUp ? 'text-red-600' : 'text-green-600'}`}>
                          ({isUp ? '+' : ''}{diff.toLocaleString()})
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-500 text-center py-4">大きな変動なし</p>
            )
          })()}
        </div>
      </div>

      {/* 🆕 新着商品 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-gray-800 flex items-center gap-2">
            <Sparkles size={18} className="text-yellow-500" />
            新着商品（買取表）
          </h2>
          <div className="flex items-center gap-2">
            {newProductLoading && <RefreshCw size={14} className="animate-spin text-gray-400" />}
            <select
              className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
              value={newProductDays}
              onChange={(e) => setNewProductDays(Number(e.target.value))}
            >
              <option value={1}>今日</option>
              <option value={3}>3日間</option>
              <option value={7}>7日間</option>
            </select>
          </div>
        </div>
        {newProducts.total > 0 ? (
          <div className="space-y-4 max-h-[400px] overflow-auto">
            {Object.entries(newProducts.grouped || {}).map(([date, items]: [string, any]) => (
              <div key={date}>
                <p className="text-xs font-medium text-gray-400 mb-2 sticky top-0 bg-white py-1">{date} ({items.length}件)</p>
                <div className="space-y-1.5">
                  {items.map((item: any, i: number) => (
                    <div key={i} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium flex-shrink-0 ${item.source === 'シンソク'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-purple-100 text-purple-700'
                        }`}>
                        {item.source === 'シンソク' ? 'シンソク' : 'ラウンジ'}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 truncate">{item.name}</p>
                        {item.rarity && (
                          <span className="text-xs text-gray-400">{item.rarity}</span>
                        )}
                      </div>
                      {item.price > 0 && (
                        <span className="text-sm font-bold text-gray-700 flex-shrink-0">
                          ¥{item.price.toLocaleString()}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500 text-center py-8">新着商品なし</p>
        )}
        {newProducts.total > 0 && (
          <div className="flex justify-center gap-4 mt-3 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-400">
              シンソク: {newProducts.shinsokuCount || 0}件 / ラウンジ: {newProducts.loungeCount || 0}件
            </span>
          </div>
        )}
      </div>

      {/* カード検索 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <h2 className="font-bold text-gray-800 mb-3">🔍 カード検索</h2>

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

        {/* 検索結果（Aランク・PSA10価格付き） */}
        {searchResults.length > 0 && (
          <div className="mt-4 space-y-2 max-h-[400px] overflow-auto">
            {searchResults.map(card => (
              <div
                key={card.id}
                className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                onClick={() => window.open(`/cards/${card.id}`, '_blank')}
              >
                {card.image_url && (
                  <img src={card.image_url} alt="" className="w-10 h-14 object-cover rounded shadow flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">{card.name}</p>
                  {card.card_number && (
                    <p className="text-xs text-gray-500 mb-1">{card.card_number}</p>
                  )}
                  <div className="space-y-1 mt-1">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="text-xs">
                        <span className="text-gray-500">A: </span>
                        {card.price_a ? (
                          <>
                            <span className="font-bold text-blue-600">¥{card.price_a.toLocaleString()}</span>
                            <span className="text-gray-400 ml-1">({card.price_a_date ? new Date(card.price_a_date).toLocaleDateString('ja-JP') : '-'})</span>
                          </>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                      <div className="text-xs">
                        <span className="text-gray-500">PSA10: </span>
                        {card.price_psa10 ? (
                          <>
                            <span className="font-bold text-red-600">¥{card.price_psa10.toLocaleString()}</span>
                            <span className="text-gray-400 ml-1">({card.price_psa10_date ? new Date(card.price_psa10_date).toLocaleDateString('ja-JP') : '-'})</span>
                          </>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="text-xs">
                        <span className="text-gray-500">JT NM: </span>
                        {card.justtcg_nm_price_usd ? (
                          <span className="font-bold text-emerald-600">${card.justtcg_nm_price_usd.toFixed(2)}</span>
                        ) : <span className="text-gray-400">-</span>}
                      </div>
                      <div className="text-xs">
                        <span className="text-gray-500">PC素体: </span>
                        {card.pc_loose_usd ? (
                          <>
                            <span className="font-bold text-purple-600">${card.pc_loose_usd.toFixed(2)}</span>
                            {card.pc_loose_jpy != null && <span className="text-gray-400 ml-0.5">(¥{card.pc_loose_jpy.toLocaleString()})</span>}
                          </>
                        ) : <span className="text-gray-400">-</span>}
                      </div>
                      <div className="text-xs">
                        <span className="text-gray-500">PC PSA10: </span>
                        {card.pc_graded_usd ? (
                          <>
                            <span className="font-bold text-orange-600">${card.pc_graded_usd.toFixed(2)}</span>
                            {card.pc_graded_jpy != null && <span className="text-gray-400 ml-0.5">(¥{card.pc_graded_jpy.toLocaleString()})</span>}
                          </>
                        ) : <span className="text-gray-400">-</span>}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
          <p className="mt-3 text-sm text-gray-500 text-center">「{searchQuery}」に一致するカードが見つかりません</p>
        )}
        {searchQuery.length < 2 && (
          <p className="mt-3 text-sm text-gray-400 text-center">2文字以上入力して検索</p>
        )}
      </div>
    </div>
  )
}
