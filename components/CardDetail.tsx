'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { X, TrendingUp, TrendingDown, ExternalLink, RefreshCw, Store, Globe, Edit, Plus, Package, Eye, EyeOff } from 'lucide-react'
import ShinsokuLink from '@/components/chart/ShinsokuLink'
import LoungeLink from '@/components/chart/LoungeLink'
import PriceChartingLink from '@/components/chart/PriceChartingLink'
import OverseasPriceChart from '@/components/chart/OverseasPriceChart'
import MarketChart from './MarketChart'
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
  // BOX個数
  '1個': '#3b82f6',     // blue
  '2個': '#06b6d4',     // cyan
  '3個': '#10b981',     // green
  '4個': '#22c55e',     // green-500
  '5個': '#84cc16',     // lime
  '6個': '#eab308',     // yellow
  '7個': '#f59e0b',     // amber
  '8個': '#f97316',     // orange
  '9個': '#ef4444',     // red
  '10個': '#dc2626',    // red-600
}

// グレードソート順序
const GRADE_SORT_ORDER: Record<string, number> = {
  PSA10: 1, PSA9: 2, 'PSA8以下': 3,
  'BGS10BL': 10, 'BGS10GL': 11, 'BGS9.5': 12, 'BGS9以下': 13,
  'ARS10+': 20, 'ARS10': 21, 'ARS9': 22, 'ARS8以下': 23,
  A: 30, B: 31, C: 32, D: 33,
  '1個': 100, '2個': 101, '3個': 102, '4個': 103, '5個': 104,
  '6個': 105, '7個': 106, '8個': 107, '9個': 108, '10個': 109,
}

// グレード別最安値カラー（価格・在庫推移グラフ用）
const SALE_GRADE_COLORS: Record<string, { color: string; label: string }> = {
  PSA10: { color: '#8b5cf6', label: 'PSA10最安' },
  A: { color: '#10b981', label: '状態A最安' },
  BOX: { color: '#f59e0b', label: 'BOX最安' },
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
  const [purchaseLinks, setPurchaseLinks] = useState<any[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [imageUploading, setImageUploading] = useState(false)
  const [cardImageUrl, setCardImageUrl] = useState(card?.image_url || null)

  // 表示切り替え用state
  const [showPurchase, setShowPurchase] = useState(true)
  const [chartTab, setChartTab] = useState<'price' | 'snkrdunk' | 'daily' | 'overseas'>('price')
  const [visibleSites, setVisibleSites] = useState<Record<string, { price: boolean; stock: boolean }>>({})

  // スニダン売買履歴用state
  const [snkrdunkSales, setSnkrdunkSales] = useState([])
  const [snkrdunkLoading, setSnkrdunkLoading] = useState(false)
  const [snkrdunkScraping, setSnkrdunkScraping] = useState(false)
  const [visibleGrades, setVisibleGrades] = useState<Record<string, boolean>>({
    PSA10: true,
    PSA9: true,
    A: true,
    B: true,
    C: true
  })
  const [gradesHydrated, setGradesHydrated] = useState(false)

  // マウント後にlocalStorageから復元
  useEffect(() => {
    const saved = localStorage.getItem('visibleGrades')
    if (saved) {
      try {
        setVisibleGrades(JSON.parse(saved))
      } catch { }
    }
    setGradesHydrated(true)
  }, [])

  // visibleGradesが変更されたらlocalStorageに保存（ハイドレーション後のみ）
  useEffect(() => {
    if (gradesHydrated) {
      localStorage.setItem('visibleGrades', JSON.stringify(visibleGrades))
    }
  }, [visibleGrades, gradesHydrated])

  useEffect(() => {
    if (card?.id) {
      fetchPrices()
      fetchSnkrdunkSales()
      fetchPurchaseLinks()
      setCardImageUrl(card?.image_url || null)
    }
  }, [card?.id])

  // 買取紐付けを取得
  const fetchPurchaseLinks = async () => {
    try {
      const res = await fetch(`/api/purchase-links?card_id=${card.id}`)
      const json = await res.json()
      if (json.success) {
        setPurchaseLinks(json.data || [])
      }
    } catch (err) {
      console.error('Failed to fetch purchase links:', err)
    }
  }

  // 画像リサイズ
  const resizeImage = (base64: string, maxSize: number = 1200): Promise<string> => {
    return new Promise((resolve) => {
      const img = document.createElement('img')
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let { width, height } = img
        if (width > maxSize || height > maxSize) {
          if (width > height) {
            height = Math.round(height * maxSize / width)
            width = maxSize
          } else {
            width = Math.round(width * maxSize / height)
            height = maxSize
          }
        }
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.src = base64
    })
  }

  // 画像ドラッグ&ドロップアップロード
  const handleImageDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (!file || !file.type.startsWith('image/')) return

    setImageUploading(true)
    try {
      const reader = new FileReader()
      const base64Raw = await new Promise<string>((resolve) => {
        reader.onload = (e) => resolve(e.target?.result as string)
        reader.readAsDataURL(file)
      })

      const base64 = await resizeImage(base64Raw)

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image: base64,
          fileName: `${card.id}_${Date.now()}.jpg`
        }),
      })

      if (!res.ok) throw new Error(res.status === 413 ? '画像が大きすぎます' : `エラー: ${res.status}`)

      const data = await res.json()
      if (data.success) {
        // DBのimage_urlを更新
        await supabase.from('cards').update({ image_url: data.url }).eq('id', card.id)
        setCardImageUrl(data.url)
        onUpdated?.()
      }
    } catch (err: any) {
      alert('アップロードエラー: ' + err.message)
    } finally {
      setImageUploading(false)
    }
  }

  const fetchPrices = async () => {
    setLoading(true)

    const [purchaseRes, saleRes, urlRes] = await Promise.all([
      supabase
        .from('purchase_prices')
        .select('*, shop:shop_id(id, name, icon), link:link_id(label)')
        .eq('card_id', card.id)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('sale_prices')
        .select('*, site:site_id(id, name, icon), grade')
        .eq('card_id', card.id)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('card_sale_urls')
        .select('*, site:site_id(id, name, icon, url)')
        .eq('card_id', card.id),
    ])

    setPurchasePrices(purchaseRes.data || [])
    setSalePrices(saleRes.data || [])
    setSaleUrls(urlRes.data || [])

    setLoading(false)
  }

  // スニダン売買履歴を取得
  const fetchSnkrdunkSales = async () => {
    setSnkrdunkLoading(true)
    try {
      const res = await fetch(`/api/snkrdunk-sales?cardId=${card.id}&days=0`)
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
      // バックグラウンド処理を開始
      const res = await fetch('/api/snkrdunk-scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId: card.id, url: snkrdunkUrl.product_url })
      })
      const data = await res.json()

      if (!data.success) {
        alert('エラー: ' + data.error)
        return
      }

      // ジョブIDを受け取った場合、ポーリングして結果を取得
      if (data.jobId) {
        alert(`スクレイピングを開始しました (Job ID: ${data.jobId})\n結果を取得中...`)

        // ポーリング処理
        const pollInterval = 2000 // 2秒ごと
        const maxAttempts = 60 // 最大2分
        let attempts = 0

        const pollJob = async (): Promise<boolean> => {
          attempts++

          const statusRes = await fetch(`${process.env.NEXT_PUBLIC_TORECA_SCRAPER_URL}/scrape/status/${data.jobId}`)
          const statusData = await statusRes.json()

          if (statusData.status === 'completed') {
            // 成功: データベースに保存
            const result = statusData.result
            alert(`スクレイピング完了\n取得: ${result.count}件`)
            fetchSnkrdunkSales()
            fetchPrices()
            return true
          } else if (statusData.status === 'failed') {
            // 失敗
            alert('エラー: ' + (statusData.error || '不明なエラー'))
            return true
          } else if (attempts >= maxAttempts) {
            // タイムアウト
            alert('タイムアウト: 処理に時間がかかっています。後ほど確認してください。')
            return true
          }

          // まだ処理中: 再度ポーリング
          await new Promise(resolve => setTimeout(resolve, pollInterval))
          return pollJob()
        }

        await pollJob()
      } else {
        // 同期処理の場合(後方互換性)
        alert(`スクレイピング完了\n取得: ${data.total}件\n新規: ${data.inserted}件\nスキップ: ${data.skipped}件`)
        fetchSnkrdunkSales()
        fetchPrices()
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

  // 販売価格チェック間隔を変更
  const updateCheckInterval = async (saleUrlId: string, intervalMinutes: number) => {
    try {
      const { error } = await supabase
        .from('card_sale_urls')
        .update({
          check_interval: intervalMinutes,
          next_check_at: new Date(Date.now() + intervalMinutes * 60000).toISOString()
        })
        .eq('id', saleUrlId)

      if (error) throw error
      fetchPrices()
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

      if (data.success && (data.price || data.price === 0)) {
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

        // スニダン（gradePrices あり）の場合、グレード別 + 全体の4レコードを保存
        if (data.gradePrices && data.gradePrices.length > 0) {
          // ① 全体最安値 + 出品数（grade=null）
          await supabase.from('sale_prices').insert({
            card_id: card.id,
            site_id: saleUrl.site_id,
            price: data.price,
            stock: stock,
            grade: null
          })

          // ② グレード別（PSA10, A, BOXなど）
          for (const gp of data.gradePrices) {
            await supabase.from('sale_prices').insert({
              card_id: card.id,
              site_id: saleUrl.site_id,
              price: gp.price,
              grade: gp.grade,
            })
          }

          const gradeInfo = data.gradePrices.map((gp: any) => `${gp.grade}: ¥${gp.price.toLocaleString()}`).join(', ')
          alert(`更新完了: 全体¥${data.price.toLocaleString()}${stock !== null ? ` (${stock}件)` : ''} / ${gradeInfo}`)
        } else {
          // 通常サイト
          await supabase.from('sale_prices').insert({
            card_id: card.id,
            site_id: saleUrl.site_id,
            price: data.priceNumber || data.price,
            stock: stock
          })
          alert(`更新完了: ¥${(data.priceNumber || data.price).toLocaleString()}${stock !== null ? ` (在庫: ${stock})` : ''}`)
        }

        // card_sale_urlsのlast_price, last_stockも更新
        await supabase.from('card_sale_urls').update({
          last_price: data.priceNumber || data.price,
          last_stock: stock,
          last_checked_at: new Date().toISOString()
        }).eq('id', saleUrl.id)

        fetchPrices()
      } else {
        alert('価格の取得に失敗: ' + (data.error || (data.price === null ? '出品が見つかりません' : '不明なエラー')))
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

      // 同じバッチのデータを統合するため分単位に丸める
      const roundedDate = new Date(Math.floor(date.getTime() / 60000) * 60000)
      const timestamp = roundedDate.getTime()
      const existing = dataMap.get(timestamp) || {
        timestamp,
        date: roundedDate.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      }

      // 状態別に価格を分ける
      const condition = p.condition || (p.is_psa ? 'psa' : 'normal')
      existing[`purchase_${condition}`] = p.price

      dataMap.set(timestamp, existing)
    })

    // 販売価格・在庫をサイト別に（grade付きはグレード別ラインに分離）
    filteredSale.forEach((p: any) => {
      const dateStr = p.recorded_at || p.created_at
      const date = formatDate(dateStr)
      if (!date) return

      // 同じスクレイプバッチのデータ（秒単位の微差）を統合するため、分単位に丸める
      const roundedDate = new Date(Math.floor(date.getTime() / 60000) * 60000)
      const timestamp = roundedDate.getTime()
      const existing = dataMap.get(timestamp) || {
        timestamp,
        date: roundedDate.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      }

      if (p.grade) {
        // グレード付きデータ → グレード別ライン
        existing[`sale_grade_${p.grade}`] = p.price
      } else {
        // グレードなし → 従来のサイト別ライン
        const siteId = p.site?.id || 'other'
        existing[`price_${siteId}`] = p.price
        if (p.stock !== null && p.stock !== undefined) {
          existing[`stock_${siteId}`] = p.stock
        }
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

  // sale_pricesのユニークなグレードリスト
  const saleGrades = useMemo(() => {
    const grades = new Set<string>()
    salePrices.forEach((p: any) => {
      if (p.grade) grades.add(p.grade)
    })
    return Array.from(grades).sort((a, b) => {
      const orderA = GRADE_SORT_ORDER[a] ?? 999
      const orderB = GRADE_SORT_ORDER[b] ?? 999
      return orderA - orderB
    })
  }, [salePrices])

  // スニダン売買履歴のグラフデータ（期間フィルター適用）
  const snkrdunkChartData = useMemo(() => {
    // 期間でフィルター
    const now = new Date()
    const cutoff = selectedPeriod ? new Date(now.getTime() - selectedPeriod * 24 * 60 * 60 * 1000) : null

    // すべての売買データを個別の点として表示（平均化しない）
    return snkrdunkSales
      .filter((sale: any) => {
        if (!cutoff) return true
        const saleDate = new Date(sale.sold_at)
        return saleDate >= cutoff
      })
      .map((sale: any, index: number) => {
        const result: any = {
          id: `${sale.sold_at}_${index}`, // 一意のID
          timestamp: new Date(sale.sold_at).getTime(),
          date: new Date(sale.sold_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
        }

        // グレードごとに価格を設定
        result[`grade_${sale.grade}`] = sale.price

        return result
      }).sort((a, b) => a.timestamp - b.timestamp).slice(-100)
  }, [snkrdunkSales, selectedPeriod])

  // スニダンのユニークなグレードリスト（ソート済み）
  const snkrdunkGrades = useMemo(() => {
    const grades = new Set<string>()
    snkrdunkSales.forEach((sale: any) => {
      grades.add(sale.grade)
    })
    return Array.from(grades).sort((a, b) => {
      const orderA = GRADE_SORT_ORDER[a] ?? 999
      const orderB = GRADE_SORT_ORDER[b] ?? 999
      return orderA - orderB
    })
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

    // 値があるエントリのみ表示し、価格の高い順にソート
    const validEntries = payload
      .filter((entry: any) => entry.value !== null && entry.value !== undefined)
      .sort((a: any, b: any) => {
        const aIsStock = a.dataKey.startsWith('stock')
        const bIsStock = b.dataKey.startsWith('stock')
        if (aIsStock !== bIsStock) return aIsStock ? 1 : -1
        return (b.value || 0) - (a.value || 0)
      })
    if (validEntries.length === 0) return null

    return (
      <div className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl px-4 py-3 text-sm" style={{ minWidth: 180 }}>
        <p className="font-medium text-gray-300 mb-2 text-xs border-b border-gray-700 pb-1.5">{label}</p>
        <div className="space-y-1">
          {validEntries.map((entry: any, index: number) => {
            const isStock = entry.dataKey.startsWith('stock')
            return (
              <div key={index} className="flex items-center justify-between gap-4">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: entry.color }} />
                  <span className="text-gray-400 text-xs">{entry.name}</span>
                </span>
                <span className="font-mono font-semibold text-white text-xs">
                  {isStock ? `${entry.value}個` : `¥${entry.value?.toLocaleString()}`}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl w-[90vw] max-w-[1400px] max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* ヘッダー */}
        <div className="p-6 border-b border-gray-100 flex items-start gap-6">
          <div
            className={`relative group cursor-pointer ${isDragging ? 'ring-4 ring-blue-400 ring-offset-2' : ''
              }`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragEnter={(e) => { e.preventDefault(); setIsDragging(true) }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleImageDrop}
            onClick={() => {
              const input = document.createElement('input')
              input.type = 'file'
              input.accept = 'image/*'
              input.onchange = (e: any) => {
                const file = e.target.files[0]
                if (file) {
                  const dt = new DataTransfer()
                  dt.items.add(file)
                  handleImageDrop({ preventDefault: () => { }, stopPropagation: () => { }, dataTransfer: dt } as any)
                }
              }
              input.click()
            }}
          >
            {cardImageUrl ? (
              <img src={cardImageUrl} alt={card.name} className="w-40 h-56 object-cover rounded-xl shadow-lg" />
            ) : (
              <div className="w-40 h-56 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400">No Image</div>
            )}
            {/* ドラッグオーバーレイ */}
            {isDragging && (
              <div className="absolute inset-0 bg-blue-500/30 rounded-xl flex items-center justify-center">
                <p className="text-white font-bold text-sm bg-blue-600 px-3 py-1.5 rounded-lg">ドロップ</p>
              </div>
            )}
            {/* アップロード中 */}
            {imageUploading && (
              <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {/* ホバーヒント */}
            {!isDragging && !imageUploading && (
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 rounded-xl flex items-center justify-center transition-colors">
                <p className="text-white text-xs font-medium opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 px-2 py-1 rounded">📷 画像変更</p>
              </div>
            )}
          </div>
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">{card?.name}</h2>
                {card?.pricecharting_name && (
                  <p className="text-sm text-gray-400 mt-0.5">{card.pricecharting_name}</p>
                )}
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
              {/* 上位3サイト（在庫0除外、価格順） */}
              {Object.entries(latestPrices)
                .filter(([, data]) => data.stock !== 0) // 在庫0を除外
                .sort((a, b) => a[1].price - b[1].price) // 価格の安い順
                .slice(0, 3)
                .map(([siteId, data], index) => (
                  <div key={siteId} className={`rounded-xl p-4 flex-1 ${index === 0 ? 'bg-green-50' : index === 1 ? 'bg-emerald-50' : 'bg-teal-50'
                    }`}>
                    <div className={`flex items-center gap-2 text-sm mb-1 ${index === 0 ? 'text-green-600' : index === 1 ? 'text-emerald-600' : 'text-teal-600'
                      }`}>
                      <Globe size={16} />
                      {data.siteName}
                    </div>
                    <p className={`text-2xl font-bold ${index === 0 ? 'text-green-700' : index === 1 ? 'text-emerald-700' : 'text-teal-700'
                      }`}>
                      ¥{data.price.toLocaleString()}
                    </p>
                    {data.stock !== null && (
                      <p className={`text-sm flex items-center gap-1 ${index === 0 ? 'text-green-600' : index === 1 ? 'text-emerald-600' : 'text-teal-600'
                        }`}>
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

              {/* グラフタブ */}
              <div className="bg-white border rounded-xl p-4">
                {/* タブヘッダー */}
                <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => setChartTab('price')}
                    className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${chartTab === 'price'
                      ? 'bg-white text-gray-800 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                      }`}
                  >
                    📈 価格・在庫推移
                  </button>
                  <button
                    onClick={() => setChartTab('snkrdunk')}
                    className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${chartTab === 'snkrdunk'
                      ? 'bg-white text-gray-800 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                      }`}
                  >
                    🔮 スニダン売買履歴
                  </button>
                  <button
                    onClick={() => setChartTab('daily')}
                    className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${chartTab === 'daily'
                      ? 'bg-white text-gray-800 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                      }`}
                  >
                    📊 日次平均推移
                  </button>
                  <button
                    onClick={() => setChartTab('overseas')}
                    className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all ${chartTab === 'overseas'
                      ? 'bg-white text-gray-800 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                      }`}
                  >
                    🌐 海外価格
                  </button>
                </div>

                {/* 価格・在庫推移タブ */}
                {chartTab === 'price' && (
                  <>
                    {chartData.length > 0 ? (
                      <>
                        <ResponsiveContainer width="100%" height={400}>
                          <LineChart data={chartData} margin={{ top: 10, right: 60, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
                            <YAxis
                              yAxisId="price"
                              orientation="left"
                              tick={{ fontSize: 10, fill: '#9ca3af' }}
                              tickLine={false}
                              axisLine={false}
                              tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`}
                              domain={[(dataMin: number) => Math.floor(dataMin * 0.85), (dataMax: number) => Math.ceil(dataMax * 1.05)]}
                              allowDataOverflow={false}
                            />
                            {hasStockData && (
                              <YAxis
                                yAxisId="stock"
                                orientation="right"
                                tick={{ fontSize: 10, fill: '#9ca3af' }}
                                tickLine={false}
                                axisLine={false}
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
                                  strokeWidth={2.5}
                                  name={`買取(${config.label})`}
                                  dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                                  activeDot={{ r: 7, strokeWidth: 2, stroke: '#fff' }}
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
                                    strokeWidth={2.5}
                                    name={`${site.name}(価格)`}
                                    dot={{ r: 4, strokeWidth: 2, fill: '#fff' }}
                                    activeDot={{ r: 7, strokeWidth: 2, stroke: '#fff' }}
                                    connectNulls
                                  />
                                )
                              })}

                            {/* グレード別最安値（PSA10/A/BOX） */}
                            {saleGrades.map((grade) => {
                              const config = SALE_GRADE_COLORS[grade] || { color: '#6b7280', label: `${grade}最安` }
                              return (
                                <Line
                                  key={`sale_grade_${grade}`}
                                  yAxisId="price"
                                  type="monotone"
                                  dataKey={`sale_grade_${grade}`}
                                  stroke={config.color}
                                  strokeWidth={2.5}
                                  strokeDasharray="8 4"
                                  name={config.label}
                                  dot={{ r: 5, strokeWidth: 2, fill: '#fff' }}
                                  activeDot={{ r: 7, strokeWidth: 2, stroke: '#fff' }}
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
                        <div className="flex justify-center gap-6 mt-4 text-xs text-gray-400">
                          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-gray-500 inline-block rounded"></span> 価格（左軸）</span>
                          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-gray-500 inline-block rounded" style={{ borderTop: '2px dashed #9ca3af' }}></span> 在庫（右軸）</span>
                        </div>
                      </>
                    ) : (
                      <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-500">
                        <p>価格データがまだありません</p>
                      </div>
                    )}
                  </>
                )}

                {/* スニダン売買履歴タブ */}
                {chartTab === 'snkrdunk' && (
                  <>
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
                                  <option value="auto">オートメーション（3時間～72時間）</option>
                                  <option value="manual">手動設定</option>
                                </select>
                              </div>

                              {/* 手動設定時の間隔選択 */}
                              {snkrdunkUrl.auto_scrape_mode === 'manual' && (
                                <div className="flex items-center gap-2 mb-3 ml-4">
                                  <span className="text-xs text-gray-600">⏱️ 更新間隔:</span>
                                  <select
                                    value={snkrdunkUrl.auto_scrape_interval_minutes || 1440}
                                    onChange={(e) => updateScrapeInterval(snkrdunkUrl.id, parseInt(e.target.value))}
                                    className="px-2 py-1 border rounded text-xs"
                                  >
                                    <option value="180">3時間</option>
                                    <option value="360">6時間</option>
                                    <option value="720">12時間</option>
                                    <option value="1440">24時間</option>
                                    <option value="2880">48時間</option>
                                    <option value="4320">72時間</option>
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
                      <ResponsiveContainer width="100%" height={400}>
                        <LineChart data={snkrdunkChartData} margin={{ top: 10, right: 20, left: 20, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                          <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={{ stroke: '#e5e7eb' }} />
                          <YAxis
                            tick={{ fontSize: 10, fill: '#9ca3af' }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`}
                            domain={[(dataMin: number) => Math.floor(dataMin * 0.85), (dataMax: number) => Math.ceil(dataMax * 1.05)]}
                            allowDataOverflow={false}
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
                                  strokeWidth={2.5}
                                  name={grade}
                                  dot={snkrdunkChartData.length > 30 ? false : { r: 4, strokeWidth: 2, fill: '#fff' }}
                                  activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }}
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
                  </>
                )}

                {/* 日次平均推移タブ */}
                {chartTab === 'daily' && (
                  <MarketChart cardId={card.id} />
                )}

                {chartTab === 'overseas' && (
                  <OverseasPriceChart
                    cardId={card.id}
                    pricechartingId={card.pricecharting_id}
                  />
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
                          <select
                            value={url.check_interval || 180}
                            onChange={(e) => updateCheckInterval(url.id, parseInt(e.target.value))}
                            className="px-2 py-1 border rounded text-xs"
                            title="価格チェック間隔"
                          >
                            <option value="180">3h</option>
                            <option value="360">6h</option>
                            <option value="720">12h</option>
                            <option value="1440">24h</option>
                            <option value="2880">48h</option>
                            <option value="4320">72h</option>
                          </select>
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
              <div className="grid grid-cols-3 gap-6">
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

                {/* スニダン取引履歴 */}
                <div>
                  <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="text-purple-500">🔄</span>
                    スニダン取引履歴
                  </h3>
                  {snkrdunkSales.length > 0 ? (
                    <div className="max-h-[200px] overflow-auto border rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-purple-50 sticky top-0">
                          <tr>
                            <th className="text-left px-3 py-2">日時</th>
                            <th className="text-center px-3 py-2">グレード</th>
                            <th className="text-right px-3 py-2">価格</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {[...snkrdunkSales].sort((a: any, b: any) =>
                            new Date(b.sold_at).getTime() - new Date(a.sold_at).getTime()
                          ).slice(0, 20).map((sale: any, i: number) => {
                            const date = new Date(sale.sold_at)
                            const gradeColor = SNKRDUNK_GRADE_COLORS[sale.grade] || '#6b7280'
                            return (
                              <tr key={i} className="hover:bg-purple-50">
                                <td className="px-3 py-2 text-gray-600">
                                  {date.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td className="px-3 py-2 text-center">
                                  <span
                                    className="px-2 py-0.5 rounded text-xs font-medium"
                                    style={{ backgroundColor: `${gradeColor}20`, color: gradeColor }}
                                  >
                                    {sale.grade}
                                  </span>
                                </td>
                                <td className="px-3 py-2 text-right font-medium">
                                  ¥{sale.price.toLocaleString()}
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
                            <th className="text-center px-3 py-2">グレード</th>
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
                                <td className="px-3 py-2 text-center">
                                  {p.grade ? (
                                    <span className="px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-700">{p.grade}</span>
                                  ) : '-'}
                                </td>
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

                {/* シンソク買取 紐付け */}
                <div>
                  <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="text-green-500">🔗</span>
                    シンソク買取 紐付け
                  </h3>
                  <p className="text-xs text-gray-400 mb-3">
                    シンソクの商品と紐付けると、買取価格を自動追跡します（6時間ごと）。複数紐付け可能です。
                  </p>
                  <ShinsokuLink
                    cardId={card.id}
                    cardName={card.name}
                    links={purchaseLinks.filter((l: any) => l.shop?.name === 'シンソク（郵送買取）')}
                    onLinksChanged={() => { fetchPurchaseLinks(); fetchPrices(); onUpdated?.() }}
                  />
                </div>

                {/* トレカラウンジ買取 紐付け */}
                <div>
                  <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="text-orange-500">🏪</span>
                    トレカラウンジ買取 紐付け
                  </h3>
                  <p className="text-xs text-gray-400 mb-3">
                    トレカラウンジの商品と紐付けると、買取価格を自動追跡します。複数紐付け可能です。
                  </p>
                  <LoungeLink
                    cardId={card.id}
                    cardName={card.name}
                    links={purchaseLinks.filter((l: any) => l.shop?.name === 'トレカラウンジ（郵送買取）')}
                    onLinksChanged={() => { fetchPurchaseLinks(); fetchPrices(); onUpdated?.() }}
                  />
                </div>

                {/* PriceCharting 海外価格 紐付け */}
                <div>
                  <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="text-blue-500">🌐</span>
                    PriceCharting 海外価格 紐付け
                  </h3>
                  <p className="text-xs text-gray-400 mb-3">
                    PriceChartingの商品と紐付けると、海外価格（USD）を自動追跡します。紐付けは1つのみです。
                  </p>
                  <PriceChartingLink
                    cardId={card.id}
                    cardName={card.name}
                    pricechartingId={card.pricecharting_id}
                    pricechartingName={card.pricecharting_name}
                    onLinked={() => { onUpdated?.() }}
                  />
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
