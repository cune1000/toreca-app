'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { X, TrendingUp, TrendingDown, ExternalLink, RefreshCw, Store, Globe, Edit, Plus, Package, Eye, EyeOff } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import CardEditForm from './CardEditForm'
import SaleUrlForm from './SaleUrlForm'

// サイト別カラー
const SITE_COLORS = [
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#ec4899', // pink
]

// 買取価格の状態別カラー
const PURCHASE_CONDITION_COLORS: Record<string, { color: string; label: string }> = {
  normal: { color: '#3b82f6', label: '素体' },
  psa: { color: '#8b5cf6', label: 'PSA' },
  sealed: { color: '#06b6d4', label: '未開封' },
  opened: { color: '#f97316', label: '開封済み' },
}

// スニダン売買履歴のグレード別カラー
const SNKRDUNK_GRADE_COLORS: Record<string, string> = {
  PSA10: '#8b5cf6',    // purple
  PSA9: '#06b6d4',     // cyan
  'PSA8以下': '#64748b', // slate
  'BGS10BL': '#a855f7', // purple-500
  'BGS10GL': '#8b5cf6', // violet
  'BGS9.5': '#0ea5e9',  // sky
  'BGS9以下': '#6b7280', // gray
  'ARS10+': '#d946ef',  // fuchsia
  'ARS10': '#c026d3',   // fuchsia-600
  'ARS9': '#0891b2',    // cyan-600
  'ARS8以下': '#71717a', // zinc
  A: '#10b981',        // green
  B: '#f59e0b',        // amber
  C: '#ef4444',        // red
  D: '#dc2626',        // red-600
}

// 期間フィルタオプション
const PERIOD_OPTIONS = [
  { label: '本日', days: 1 },
  { label: '7日', days: 7 },
  { label: '30日', days: 30 },
  { label: '180日', days: 180 },
  { label: '1年', days: 365 },
  { label: '全期間', days: null },
]

export default function CardDetail({ card, onClose, onUpdated }) {
  const [purchasePrices, setPurchasePrices] = useState([])
  const [salePrices, setSalePrices] = useState([])
  const [saleUrls, setSaleUrls] = useState([])
  const [loading, setLoading] = useState(true)
  const [scraping, setScraping] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [showSaleUrlForm, setShowSaleUrlForm] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState(30)

  // 表示切り替え用state
  const [showPurchase, setShowPurchase] = useState(true)
  const [visibleSites, setVisibleSites] = useState<Record<string, { price: boolean; stock: boolean }>>({})

  // スニダン売買履歴用state
  const [snkrdunkSales, setSnkrdunkSales] = useState([])
  const [snkrdunkLoading, setSnkrdunkLoading] = useState(false)
  const [snkrdunkScraping, setSnkrdunkScraping] = useState(false)
  const [visibleGrades, setVisibleGrades] = useState({
    PSA10: true,
    PSA9: true,
    A: true,
    B: true,
    C: true
  })

  useEffect(() => {
    if (card?.id) {
      fetchPrices()
      fetchSnkrdunkSales()
    }
  }, [card?.id])

  const fetchPrices = async () => {
    setLoading(true)

    const { data: purchaseData } = await supabase
      .from('purchase_prices')
      .select('*, shop:shop_id(id, name, icon)')
      .eq('card_id', card.id)
      .order('created_at', { ascending: false })
      .limit(200)
    setPurchasePrices(purchaseData || [])

    const { data: saleData } = await supabase
      .from('sale_prices')
      .select('*, site:site_id(id, name, icon)')
      .eq('card_id', card.id)
      .order('created_at', { ascending: false })
      .limit(200)
    setSalePrices(saleData || [])

    const { data: urlData } = await supabase
      .from('card_sale_urls')
      .select('*, site:site_id(id, name, icon, url)')
      .eq('card_id', card.id)
    setSaleUrls(urlData || [])

    setLoading(false)
  }

  // スニダン売買履歴を取得
  const fetchSnkrdunkSales = async () => {
    setSnkrdunkLoading(true)
    try {
      const days = selectedPeriod || 365
      const res = await fetch(`/api/snkrdunk-sales?cardId=${card.id}&days=${days}`)
      const data = await res.json()
      if (data.success) {
        setSnkrdunkSales(data.data || [])
      }
    } catch (error) {
      console.error('Failed to fetch snkrdunk sales:', error)
    } finally {
      setSnkrdunkLoading(false)
    }
  }

  // スニダンスクレイピング実行
  const scrapeSnkrdunk = async () => {
    const snkrdunkUrl = saleUrls.find((url: any) =>
      url.site?.name?.toLowerCase().includes('スニダン') ||
      url.site?.name?.toLowerCase().includes('snkrdunk') ||
      url.product_url?.toLowerCase().includes('snkrdunk')
    )

    if (!snkrdunkUrl) {
      alert('スニダンのURLが設定されていません。販売サイトからURLを追加してください。')
      return
    }

    setSnkrdunkScraping(true)
    try {
      const res = await fetch('/api/snkrdunk-scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId: card.id, url: snkrdunkUrl.product_url })
      })
      const data = await res.json()
      if (data.success) {
        alert(`スクレイピング完了\n取得: ${data.total}件\n新規: ${data.inserted}件\nスキップ: ${data.skipped}件`)
        fetchSnkrdunkSales()
        fetchPrices() // saleUrlsを再取得
      } else {
        alert('エラー: ' + data.error)
      }
    } catch (error: any) {
      alert('エラー: ' + error.message)
    } finally {
      setSnkrdunkScraping(false)
    }
  }

  // 自動更新モードを変更
  const updateAutoScrapeMode = async (saleUrlId: string, mode: string) => {
    try {
      const { error } = await supabase
        .from('card_sale_urls')
        .update({ auto_scrape_mode: mode })
        .eq('id', saleUrlId)

      if (error) {
        console.error('Failed to update auto_scrape_mode:', error)
        throw error
      }

      alert('✅ 自動更新モードを変更しました')
      fetchPrices() // saleUrlsを再取得
    } catch (error: any) {
      alert('❌ エラー: ' + error.message)
    }
  }

  // 自動更新間隔を変更
  const updateScrapeInterval = async (saleUrlId: string, intervalMinutes: number) => {
    try {
      const { error } = await supabase
        .from('card_sale_urls')
        .update({ auto_scrape_interval_minutes: intervalMinutes })
        .eq('id', saleUrlId)

      if (error) {
        console.error('Failed to update auto_scrape_interval_minutes:', error)
        throw error
      }

      alert(`✅ 更新間隔を${intervalMinutes}分に変更しました`)
      fetchPrices() // saleUrlsを再取得
    } catch (error: any) {
      alert('❌ エラー: ' + error.message)
    }
  }

  // 相対時間を表示
  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 60) return `${diffMins}分前`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}時間前`
    const diffDays = Math.floor(diffHours / 24)
    return `${diffDays}日前`
  }

  // サイト一覧を取得（販売URL登録済み + 価格履歴あり）
  const siteList = useMemo(() => {
    const sites = new Map()
    // 販売URLから取得
    saleUrls.forEach((u: any) => {
      if (u.site?.id && !sites.has(u.site.id)) {
        sites.set(u.site.id, { id: u.site.id, name: u.site.name, icon: u.site.icon })
      }
    })
    // 価格履歴からも取得
    salePrices.forEach((p: any) => {
      if (p.site?.id && !sites.has(p.site.id)) {
        sites.set(p.site.id, { id: p.site.id, name: p.site.name, icon: p.site.icon })
      }
    })
    return Array.from(sites.values())
  }, [salePrices, saleUrls])

  // サイトリストが変わったら表示設定を初期化
  useEffect(() => {
    if (siteList.length === 0) return
    setVisibleSites(prev => {
      const newVisible: Record<string, { price: boolean; stock: boolean }> = {}
      siteList.forEach(site => {
        newVisible[site.id] = prev[site.id] || { price: true, stock: true }
      })
      return newVisible
    })
  }, [siteList])

  // スクレイピングで価格更新
  const updatePrice = async (saleUrl: any) => {
    setScraping(true)
    try {
      const siteName = saleUrl.site?.name?.toLowerCase() || ''
      let source = null
      if (siteName.includes('スニダン') || siteName.includes('snkrdunk')) {
        source = 'snkrdunk'
      } else if (siteName.includes('カードラッシュ') || siteName.includes('cardrush')) {
        source = 'cardrush'
      } else if (siteName.includes('トレカキャンプ') || siteName.includes('torecacamp')) {
        source = 'torecacamp'
      }

      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: saleUrl.product_url, source }),
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

        await supabase.from('sale_prices').insert({
          card_id: card.id,
          site_id: saleUrl.site_id,
          price: data.priceNumber || data.price,
          stock: stock
        })

        // card_sale_urlsのlast_price, last_stockも更新
        await supabase.from('card_sale_urls').update({
          last_price: data.priceNumber || data.price,
          last_stock: stock,
          last_checked_at: new Date().toISOString()
        }).eq('id', saleUrl.id)

        alert(`更新完了: ¥${(data.priceNumber || data.price).toLocaleString()}${stock !== null ? ` (在庫: ${stock})` : ''}`)
        fetchPrices()
      } else {
        alert('価格の取得に失敗: ' + (data.error || '不明なエラー'))
      }
    } catch (err: any) {
      alert('エラー: ' + err.message)
    } finally {
      setScraping(false)
    }
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return null
    return date
  }

  const filterByPeriod = (data: any[]) => {
    if (selectedPeriod === null) return data
    const now = new Date()
    const cutoff = new Date(now.getTime() - selectedPeriod * 24 * 60 * 60 * 1000)
    return data.filter(item => {
      const dateStr = item.tweet_time || item.recorded_at || item.created_at
      const date = formatDate(dateStr)
      return date && date >= cutoff
    })
  }

  // グラフデータを生成
  const chartData = useMemo(() => {
    const filteredPurchase = filterByPeriod(purchasePrices)
    const filteredSale = filterByPeriod(salePrices)

    const dataMap = new Map<number, any>()

    // 買取価格（状態別）
    filteredPurchase.forEach((p: any) => {
      const dateStr = p.tweet_time || p.recorded_at || p.created_at
      const date = formatDate(dateStr)
      if (!date) return

      const timestamp = date.getTime()
      const existing = dataMap.get(timestamp) || {
        timestamp,
        date: date.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      }

      // 状態別に価格を分ける
      const condition = p.condition || (p.is_psa ? 'psa' : 'normal')
      existing[`purchase_${condition}`] = p.price

      dataMap.set(timestamp, existing)
    })

    // 販売価格・在庫をサイト別に
    filteredSale.forEach((p: any) => {
      const dateStr = p.recorded_at || p.created_at
      const date = formatDate(dateStr)
      if (!date) return

      const timestamp = date.getTime()
      const existing = dataMap.get(timestamp) || {
        timestamp,
        date: date.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      }

      const siteId = p.site?.id || 'other'
      existing[`price_${siteId}`] = p.price
      if (p.stock !== null && p.stock !== undefined) {
        existing[`stock_${siteId}`] = p.stock
      }
      dataMap.set(timestamp, existing)
    })

    const sorted = Array.from(dataMap.values()).sort((a, b) => a.timestamp - b.timestamp)
    return sorted.slice(-100)
  }, [purchasePrices, salePrices, selectedPeriod])

  // 最新価格
  const latestPrices = useMemo(() => {
    const latest: Record<string, { price: number; stock: number | null; siteName: string }> = {}
    salePrices.forEach((p: any) => {
      const siteId = p.site?.id || 'other'
      if (!latest[siteId]) {
        latest[siteId] = { price: p.price, stock: p.stock, siteName: p.site?.name || 'その他' }
      }
    })
    return latest
  }, [salePrices])

  const latestPurchase = purchasePrices[0]?.price

  // 在庫データがあるかチェック
  const hasStockData = useMemo(() => {
    return salePrices.some((p: any) => p.stock !== null && p.stock !== undefined)
  }, [salePrices])

  // 買取価格のユニークな状態リスト
  const purchaseConditions = useMemo(() => {
    const conditions = new Set<string>()
    purchasePrices.forEach((p: any) => {
      const condition = p.condition || (p.is_psa ? 'psa' : 'normal')
      conditions.add(condition)
    })
    return Array.from(conditions)
  }, [purchasePrices])

  // スニダン売買履歴のグラフデータ
  const snkrdunkChartData = useMemo(() => {
    const dataMap = new Map<number, any>()

    snkrdunkSales.forEach((sale: any) => {
      const timestamp = new Date(sale.sold_at).getTime()
      const existing = dataMap.get(timestamp) || {
        timestamp,
        date: new Date(sale.sold_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        count: {}
      }

      // 同じ時刻・同じグレードの価格を配列で保持
      const gradeKey = `grade_${sale.grade}`
      if (!existing[gradeKey]) {
        existing[gradeKey] = []
      }
      existing[gradeKey].push(sale.price)

      // 件数をカウント
      existing.count[sale.grade] = (existing.count[sale.grade] || 0) + 1

      dataMap.set(timestamp, existing)
    })

    // 平均価格を計算
    return Array.from(dataMap.values()).map(item => {
      const result = { ...item }
      Object.keys(item).forEach(key => {
        if (key.startsWith('grade_') && Array.isArray(item[key])) {
          // 平均価格を計算
          result[key] = Math.round(
            item[key].reduce((sum: number, p: number) => sum + p, 0) / item[key].length
          )
        }
      })
      return result
    }).sort((a, b) => a.timestamp - b.timestamp).slice(-100)
  }, [snkrdunkSales])

  // スニダンのユニークなグレードリスト
  const snkrdunkGrades = useMemo(() => {
    const grades = new Set<string>()
    snkrdunkSales.forEach((sale: any) => {
      grades.add(sale.grade)
    })
    return Array.from(grades).sort()
  }, [snkrdunkSales])

  // サイト表示切り替え
  const toggleSitePrice = (siteId: string) => {
    setVisibleSites(prev => ({
      ...prev,
      [siteId]: { ...prev[siteId], price: !prev[siteId]?.price }
    }))
  }

  const toggleSiteStock = (siteId: string) => {
    setVisibleSites(prev => ({
      ...prev,
      [siteId]: { ...prev[siteId], stock: !prev[siteId]?.stock }
    }))
  }

  // サイト全体（価格+在庫）を一括トグル
  const toggleSiteAll = (siteId: string) => {
    setVisibleSites(prev => {
      const current = prev[siteId] || { price: true, stock: true }
      // 両方オンなら両方オフ、それ以外は両方オン
      const allOn = current.price !== false && current.stock !== false
      return {
        ...prev,
        [siteId]: { price: !allOn, stock: !allOn }
      }
    })
  }

  // サイトが非表示かどうか
  const isSiteHidden = (siteId: string) => {
    const v = visibleSites[siteId]
    return v?.price === false && v?.stock === false
  }

  // グレード表示切り替え
  const toggleGrade = (grade: string) => {
    setVisibleGrades(prev => ({
      ...prev,
      [grade]: !prev[grade]
    }))
  }

  // カスタムドット（◇ダイヤモンド型）
  const DiamondDot = (props: any) => {
    const { cx, cy, stroke, fill } = props
    if (cx === undefined || cy === undefined) return null
    const size = 4
    return (
      <path
        d={`M ${cx} ${cy - size} L ${cx + size} ${cy} L ${cx} ${cy + size} L ${cx - size} ${cy} Z`}
        stroke={stroke}
        fill={fill || 'white'}
        strokeWidth={2}
      />
    )
  }

  // カスタムツールチップ
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null

    return (
      <div className="bg-white border rounded-lg shadow-lg p-3 text-sm">
        <p className="font-medium text-gray-700 mb-2">{label}</p>
        {payload.map((entry: any, index: number) => {
          const isStock = entry.dataKey.startsWith('stock')
          return (
            <div key={index} className="flex items-center gap-2">
              <span style={{ color: entry.color }}>{isStock ? '◇' : '●'}</span>
              <span>{entry.name}: {isStock ? `${entry.value}個` : `¥${entry.value?.toLocaleString()}`}</span>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-[90vw] max-w-[1400px] max-h-[90vh] flex flex-col">
        {/* ヘッダー */}
        <div className="p-6 border-b border-gray-100 flex items-start gap-6">
          {card?.image_url ? (
            <img src={card.image_url} alt={card.name} className="w-40 h-56 object-cover rounded-xl shadow-lg" />
          ) : (
            <div className="w-40 h-56 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400">No Image</div>
          )}
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">{card?.name}</h2>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {card?.card_number && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-sm">
                      {card.card_number}
                    </span>
                  )}
                  {card?.rarity && (
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-sm font-medium">
                      {typeof card.rarity === 'object' ? card.rarity.name : card.rarity}
                    </span>
                  )}
                  {card?.expansion && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-sm">
                      {card.expansion}
                    </span>
                  )}
                </div>
                {card?.category_large && (
                  <p className="mt-2 text-gray-600">{card.category_large.icon} {card.category_large.name}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowEditForm(true)} className="p-2 hover:bg-gray-100 rounded-lg text-gray-600">
                  <Edit size={20} />
                </button>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg text-gray-500">
                  <X size={24} />
                </button>
              </div>
            </div>

            {/* 最新価格サマリー */}
            <div className="flex gap-4 mt-4">
              <div className="bg-blue-50 rounded-xl p-4 flex-1">
                <div className="flex items-center gap-2 text-blue-600 text-sm mb-1">
                  <Store size={16} />
                  最新買取価格
                </div>
                <p className="text-2xl font-bold text-blue-700">
                  {latestPurchase ? `¥${latestPurchase.toLocaleString()}` : '-'}
                </p>
              </div>
              {Object.entries(latestPrices).slice(0, 1).map(([siteId, data]) => (
                <div key={siteId} className="bg-green-50 rounded-xl p-4 flex-1">
                  <div className="flex items-center gap-2 text-green-600 text-sm mb-1">
                    <Globe size={16} />
                    {data.siteName}
                  </div>
                  <p className="text-2xl font-bold text-green-700">
                    ¥{data.price.toLocaleString()}
                  </p>
                  {data.stock !== null && (
                    <p className="text-sm text-green-600 flex items-center gap-1">
                      <Package size={14} />
                      在庫: {data.stock}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* コンテンツ */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="animate-spin text-blue-500" size={32} />
            </div>
          ) : (
            <>
              {/* 期間フィルタ */}
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">期間:</span>
                {PERIOD_OPTIONS.map(option => (
                  <button
                    key={option.label}
                    onClick={() => setSelectedPeriod(option.days)}
                    className={`px-3 py-1 rounded-lg text-sm transition-colors ${selectedPeriod === option.days
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {/* グラフ表示設定 */}
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-sm font-medium text-gray-700 mb-3">グラフ表示設定</p>
                <div className="flex flex-wrap gap-3">
                  {/* 買取価格 */}
                  <button
                    onClick={() => setShowPurchase(!showPurchase)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition-colors ${showPurchase
                      ? 'bg-blue-100 border-blue-300 text-blue-700'
                      : 'bg-white border-gray-200 text-gray-400'
                      }`}
                  >
                    <span className={`w-3 h-3 rounded-full ${showPurchase ? 'bg-blue-500' : 'bg-gray-300'}`}></span>
                    買取価格
                    <span className="flex items-center gap-0.5">
                      <input
                        type="checkbox"
                        checked={showPurchase}
                        onChange={() => setShowPurchase(!showPurchase)}
                        className="w-4 h-4 accent-blue-500"
                      />
                    </span>
                  </button>

                  {/* サイト別 */}
                  {siteList.map((site, index) => {
                    const color = SITE_COLORS[index % SITE_COLORS.length]
                    const hidden = isSiteHidden(site.id)
                    const v = visibleSites[site.id] || { price: true, stock: true }
                    return (
                      <div
                        key={site.id}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition-colors ${hidden
                          ? 'bg-white border-gray-200 text-gray-400'
                          : 'bg-green-50 border-green-200 text-green-700'
                          }`}
                      >
                        <span
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: hidden ? '#d1d5db' : color }}
                        ></span>
                        <span
                          className="cursor-pointer"
                          onClick={() => toggleSiteAll(site.id)}
                        >
                          {site.name}
                        </span>
                        <span className="flex items-center gap-1 ml-1 text-xs">
                          <label className="flex items-center gap-0.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={v.price !== false}
                              onChange={() => toggleSitePrice(site.id)}
                              className="w-3 h-3 accent-green-500"
                            />
                            <span>●価格</span>
                          </label>
                          <label className="flex items-center gap-0.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={v.stock !== false}
                              onChange={() => toggleSiteStock(site.id)}
                              className="w-3 h-3 accent-green-500"
                            />
                            <span>◇在庫</span>
                          </label>
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* グラフ */}
              {chartData.length > 0 ? (
                <div className="bg-white border rounded-xl p-4">
                  <h3 className="font-bold text-gray-800 mb-4">価格・在庫推移</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={chartData} margin={{ top: 5, right: 60, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis
                        yAxisId="price"
                        orientation="left"
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`}
                        domain={['auto', 'auto']}
                      />
                      {hasStockData && (
                        <YAxis
                          yAxisId="stock"
                          orientation="right"
                          tick={{ fontSize: 11 }}
                          tickFormatter={(v) => `${v}個`}
                          domain={[0, 'auto']}
                        />
                      )}
                      <Tooltip content={<CustomTooltip />} />

                      {/* 買取価格（状態別） */}
                      {showPurchase && purchaseConditions.map((condition) => {
                        const config = PURCHASE_CONDITION_COLORS[condition] || { color: '#3b82f6', label: condition }
                        return (
                          <Line
                            key={`purchase_${condition}`}
                            yAxisId="price"
                            type="monotone"
                            dataKey={`purchase_${condition}`}
                            stroke={config.color}
                            strokeWidth={2}
                            name={`買取(${config.label})`}
                            dot={{ r: 3 }}
                            connectNulls
                          />
                        )
                      })}

                      {/* サイト別価格 */}
                      {siteList
                        .filter(site => visibleSites[site.id]?.price !== false)
                        .map((site, index) => {
                          const colorIndex = siteList.findIndex(s => s.id === site.id)
                          const color = SITE_COLORS[colorIndex % SITE_COLORS.length]
                          return (
                            <Line
                              key={`price_${site.id}`}
                              yAxisId="price"
                              type="monotone"
                              dataKey={`price_${site.id}`}
                              stroke={color}
                              strokeWidth={2}
                              name={`${site.name}(価格)`}
                              dot={{ r: 3 }}
                              connectNulls
                            />
                          )
                        })}

                      {/* サイト別在庫 */}
                      {hasStockData && siteList
                        .filter(site => visibleSites[site.id]?.stock !== false)
                        .map((site, index) => {
                          const colorIndex = siteList.findIndex(s => s.id === site.id)
                          const color = SITE_COLORS[colorIndex % SITE_COLORS.length]
                          return (
                            <Line
                              key={`stock_${site.id}`}
                              yAxisId="stock"
                              type="stepAfter"
                              dataKey={`stock_${site.id}`}
                              stroke={color}
                              strokeWidth={1.5}
                              strokeDasharray="5 5"
                              name={`${site.name}(在庫)`}
                              dot={<DiamondDot stroke={color} />}
                              connectNulls
                            />
                          )
                        })}
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="flex justify-center gap-6 mt-3 text-xs text-gray-500">
                    <span>● 価格（左軸）</span>
                    <span>◇ 在庫（右軸）</span>
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-500">
                  <p>価格データがまだありません</p>
                </div>
              )}

              {/* スニダン売買履歴グラフ */}
              <div className="bg-white border rounded-xl p-4">
                <h3 className="font-bold text-gray-800 mb-4">スニダン売買履歴（グレード別）</h3>

                {/* 自動更新設定 */}
                {(() => {
                  const snkrdunkUrl = saleUrls.find((url: any) =>
                    url.site?.name?.toLowerCase().includes('スニダン') ||
                    url.site?.name?.toLowerCase().includes('snkrdunk') ||
                    url.product_url?.toLowerCase().includes('snkrdunk')
                  )

                  return (
                    <div className="bg-gray-50 rounded-xl p-4 mb-4">
                      <h4 className="font-bold text-sm mb-3">🤖 自動更新設定</h4>

                      {/* URL表示 */}
                      {snkrdunkUrl ? (
                        <>
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs text-gray-600">🔗 スニダンURL:</span>
                            <a
                              href={snkrdunkUrl.product_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-500 hover:underline flex items-center gap-1 truncate max-w-xs"
                            >
                              {snkrdunkUrl.product_url}
                              <ExternalLink size={12} />
                            </a>
                          </div>

                          {/* モード選択 */}
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-xs text-gray-600">🔄 自動更新:</span>
                            <select
                              value={snkrdunkUrl.auto_scrape_mode || 'off'}
                              onChange={(e) => updateAutoScrapeMode(snkrdunkUrl.id, e.target.value)}
                              className="px-2 py-1 border rounded text-xs"
                            >
                              <option value="off">停止</option>
                              <option value="auto">オートメーション（30分～6時間）</option>
                              <option value="manual">手動設定</option>
                            </select>
                          </div>

                          {/* 手動設定時の間隔選択 */}
                          {snkrdunkUrl.auto_scrape_mode === 'manual' && (
                            <div className="flex items-center gap-2 mb-3 ml-4">
                              <span className="text-xs text-gray-600">⏱️ 更新間隔:</span>
                              <select
                                value={snkrdunkUrl.auto_scrape_interval_minutes || 360}
                                onChange={(e) => updateScrapeInterval(snkrdunkUrl.id, parseInt(e.target.value))}
                                className="px-2 py-1 border rounded text-xs"
                              >
                                <option value="30">30分</option>
                                <option value="60">1時間</option>
                                <option value="120">2時間</option>
                                <option value="180">3時間</option>
                                <option value="240">4時間</option>
                                <option value="360">6時間</option>
                              </select>
                            </div>
                          )}

                          {/* 最終更新情報 */}
                          {snkrdunkUrl.last_scraped_at && (
                            <div className="text-xs text-gray-500 mb-2">
                              📊 最終更新: {new Date(snkrdunkUrl.last_scraped_at).toLocaleString('ja-JP')}
                              {' '}({formatRelativeTime(snkrdunkUrl.last_scraped_at)})
                            </div>
                          )}

                          {/* 次回更新予定 */}
                          {snkrdunkUrl.next_scrape_at && snkrdunkUrl.auto_scrape_mode !== 'off' && (
                            <div className="text-xs text-gray-500 mb-2">
                              ⏰ 次回更新: {new Date(snkrdunkUrl.next_scrape_at).toLocaleString('ja-JP')}
                              {' '}({formatRelativeTime(snkrdunkUrl.next_scrape_at)})
                            </div>
                          )}

                          {/* エラー表示 */}
                          {snkrdunkUrl.last_scrape_status === 'error' && (
                            <div className="bg-red-50 border border-red-200 rounded p-2 mb-2">
                              <p className="text-xs text-red-700">⚠️ エラーが発生しました</p>
                              <p className="text-xs text-red-600 mt-1">{snkrdunkUrl.last_scrape_error}</p>
                            </div>
                          )}

                          {/* 手動更新ボタン */}
                          <button
                            onClick={scrapeSnkrdunk}
                            disabled={snkrdunkScraping}
                            className="px-3 py-1 bg-purple-500 text-white rounded text-xs hover:bg-purple-600 disabled:opacity-50 flex items-center gap-1"
                          >
                            {snkrdunkScraping ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                            今すぐ更新
                          </button>
                        </>
                      ) : (
                        <div className="text-xs text-gray-500">
                          ⚠️ スニダンURLが未設定です。販売サイトからURLを追加してください。
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* グレード表示切り替え */}
                {snkrdunkGrades.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {snkrdunkGrades.map(grade => {
                      const color = SNKRDUNK_GRADE_COLORS[grade] || '#6b7280'
                      const isVisible = visibleGrades[grade] !== false
                      return (
                        <button
                          key={grade}
                          onClick={() => toggleGrade(grade)}
                          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition-colors ${isVisible
                            ? 'bg-purple-50 border-purple-200 text-purple-700'
                            : 'bg-white border-gray-200 text-gray-400'
                            }`}
                        >
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: isVisible ? color : '#d1d5db' }}
                          ></span>
                          {grade}
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* グラフ */}
                {snkrdunkLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <RefreshCw className="animate-spin text-purple-500" size={32} />
                  </div>
                ) : snkrdunkChartData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={snkrdunkChartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`}
                        domain={['auto', 'auto']}
                      />
                      <Tooltip content={<CustomTooltip />} />

                      {/* グレード別ライン */}
                      {snkrdunkGrades
                        .filter(grade => visibleGrades[grade] !== false)
                        .map(grade => {
                          const color = SNKRDUNK_GRADE_COLORS[grade] || '#6b7280'
                          return (
                            <Line
                              key={grade}
                              type="monotone"
                              dataKey={`grade_${grade}`}
                              stroke={color}
                              strokeWidth={2}
                              name={grade}
                              dot={{ r: 3 }}
                              connectNulls
                            />
                          )
                        })}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-500">
                    <p>売買履歴データがありません</p>
                    <p className="text-sm mt-2">「履歴更新」ボタンからスクレイピングを実行してください</p>
                  </div>
                )}
              </div>

              {/* 販売URL一覧 */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-gray-800">販売サイト</h3>
                  <button
                    onClick={() => setShowSaleUrlForm(true)}
                    className="px-3 py-1 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 flex items-center gap-1"
                  >
                    <Plus size={14} />
                    URL追加
                  </button>
                </div>
                {saleUrls.length > 0 ? (
                  <div className="space-y-2">
                    {saleUrls.map((url: any) => (
                      <div key={url.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">{url.site?.icon || '🌐'}</span>
                          <div>
                            <p className="font-medium text-gray-800">{url.site?.name || 'Unknown'}</p>
                            <a
                              href={url.product_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-blue-500 hover:underline flex items-center gap-1"
                            >
                              {url.product_url.substring(0, 50)}...
                              <ExternalLink size={12} />
                            </a>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {url.last_price && (
                            <div className="text-right">
                              <p className="font-bold text-green-700">¥{url.last_price.toLocaleString()}</p>
                              {url.last_stock !== null && (
                                <p className="text-xs text-gray-500">在庫: {url.last_stock}</p>
                              )}
                            </div>
                          )}
                          <button
                            onClick={() => updatePrice(url)}
                            disabled={scraping}
                            className="px-3 py-1 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1"
                          >
                            {scraping ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                            更新
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-center py-4">販売URLが登録されていません</p>
                )}
              </div>

              {/* 価格履歴テーブル */}
              <div className="grid grid-cols-2 gap-6">
                {/* 買取価格履歴 */}
                <div>
                  <h3 className="font-bold text-gray-800 mb-3">買取価格履歴</h3>
                  {purchasePrices.length > 0 ? (
                    <div className="max-h-[200px] overflow-auto border rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="text-left px-3 py-2">店舗</th>
                            <th className="text-center px-3 py-2">状態</th>
                            <th className="text-right px-3 py-2">価格</th>
                            <th className="text-right px-3 py-2">日時</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {filterByPeriod(purchasePrices).slice(0, 20).map((p: any, i) => {
                            const dateStr = p.tweet_time || p.recorded_at || p.created_at
                            const date = formatDate(dateStr)
                            const condition = p.condition || (p.is_psa ? 'psa' : 'normal')
                            const conditionConfig = PURCHASE_CONDITION_COLORS[condition] || { color: '#3b82f6', label: condition }
                            return (
                              <tr key={i} className="hover:bg-gray-50">
                                <td className="px-3 py-2">{p.shop?.name || '-'}</td>
                                <td className="px-3 py-2 text-center">
                                  <span
                                    className="px-2 py-0.5 rounded text-xs font-medium"
                                    style={{ backgroundColor: `${conditionConfig.color}20`, color: conditionConfig.color }}
                                  >
                                    {conditionConfig.label}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right font-medium">¥{p.price.toLocaleString()}</td>
                                <td className="px-3 py-2 text-right text-gray-500">
                                  {date ? date.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">履歴なし</p>
                  )}
                </div>

                {/* 販売価格履歴 */}
                <div>
                  <h3 className="font-bold text-gray-800 mb-3">販売価格履歴</h3>
                  {salePrices.length > 0 ? (
                    <div className="max-h-[200px] overflow-auto border rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 sticky top-0">
                          <tr>
                            <th className="text-left px-3 py-2">サイト</th>
                            <th className="text-right px-3 py-2">価格</th>
                            <th className="text-right px-3 py-2">在庫</th>
                            <th className="text-right px-3 py-2">日時</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {filterByPeriod(salePrices).slice(0, 20).map((p: any, i) => {
                            const date = formatDate(p.recorded_at || p.created_at)
                            return (
                              <tr key={i} className="hover:bg-gray-50">
                                <td className="px-3 py-2">{p.site?.name || '-'}</td>
                                <td className="px-3 py-2 text-right font-medium">¥{p.price.toLocaleString()}</td>
                                <td className="px-3 py-2 text-right text-gray-500">{p.stock ?? '-'}</td>
                                <td className="px-3 py-2 text-right text-gray-500">
                                  {date ? date.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="text-gray-500 text-center py-4">履歴なし</p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {showEditForm && (
        <CardEditForm
          card={card}
          onClose={() => setShowEditForm(false)}
          onSaved={() => { setShowEditForm(false); onUpdated?.() }}
        />
      )}

      {showSaleUrlForm && (
        <SaleUrlForm
          cardId={card.id}
          onClose={() => setShowSaleUrlForm(false)}
          onSaved={() => { setShowSaleUrlForm(false); fetchPrices() }}
        />
      )}
    </div>
  )
}
