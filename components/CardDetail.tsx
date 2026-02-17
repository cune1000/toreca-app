'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { X, ExternalLink, RefreshCw, Store, Globe, Edit, Package } from 'lucide-react'
import OverseasPriceChart from '@/components/chart/OverseasPriceChart'
import MarketChart from './MarketChart'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import CardEditForm from './CardEditForm'
import SaleUrlForm from './SaleUrlForm'
import SettingsTab from './card-detail/SettingsTab'
import {
  SITE_COLORS, PURCHASE_CONDITION_COLORS, SNKRDUNK_GRADE_COLORS,
  GRADE_SORT_ORDER, isBoxGrade, SINGLE_CATEGORIES, SALE_GRADE_COLORS,
  PERIOD_OPTIONS, formatRelativeTime,
} from './card-detail/constants'

export default function CardDetail({ card, onClose, onUpdated }) {
  const [purchasePrices, setPurchasePrices] = useState([])
  const [salePrices, setSalePrices] = useState([])
  const [saleUrls, setSaleUrls] = useState([])
  const [loading, setLoading] = useState(true)
  const [scraping, setScraping] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [showSaleUrlForm, setShowSaleUrlForm] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(30)
  const [purchaseLinks, setPurchaseLinks] = useState<any[]>([])
  const [isDragging, setIsDragging] = useState(false)
  const [imageUploading, setImageUploading] = useState(false)
  const [cardImageUrl, setCardImageUrl] = useState(card?.image_url || null)

  // 表示切り替え用state
  const [showPurchase, setShowPurchase] = useState(true)
  const [chartTab, setChartTab] = useState<'price' | 'snkrdunk' | 'daily' | 'settings'>('price')
  const [visibleSites, setVisibleSites] = useState<Record<string, { price: boolean; stock: boolean }>>({})

  // スニダン売買履歴用state
  const [selectedSnkrdunkCategory, setSelectedSnkrdunkCategory] = useState('all')
  const [snkrdunkSales, setSnkrdunkSales] = useState([])
  const [snkrdunkLoading, setSnkrdunkLoading] = useState(false)
  const [snkrdunkScraping, setSnkrdunkScraping] = useState(false)

  useEffect(() => {
    if (card?.id) {
      fetchPrices()
      fetchSnkrdunkSales()
      fetchPurchaseLinks()
      setCardImageUrl(card?.image_url || null)
    }
  }, [card?.id])

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

  const resizeImage = (base64: string, maxSize: number = 1200): Promise<string> => {
    return new Promise((resolve, reject) => {
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
        const ctx = canvas.getContext('2d')
        if (!ctx) { reject(new Error('Canvas context unavailable')); return }
        ctx.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.onerror = () => reject(new Error('画像の読み込みに失敗しました'))
      img.src = base64
    })
  }

  const handleImageDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (!file || !file.type.startsWith('image/')) return

    setImageUploading(true)
    try {
      const reader = new FileReader()
      const base64Raw = await new Promise<string>((resolve, reject) => {
        reader.onload = (e) => resolve(e.target?.result as string)
        reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'))
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
    try {
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
    } catch (err) {
      console.error('Failed to fetch prices:', err)
    } finally {
      setLoading(false)
    }
  }

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

      if (!data.success) {
        alert('エラー: ' + data.error)
        return
      }

      if (data.jobId) {
        alert(`スクレイピングを開始しました (Job ID: ${data.jobId})\n結果を取得中...`)

        const pollInterval = 2000
        const maxAttempts = 60
        let attempts = 0

        const pollJob = async (): Promise<boolean> => {
          attempts++

          const statusRes = await fetch(`${process.env.NEXT_PUBLIC_TORECA_SCRAPER_URL}/scrape/status/${data.jobId}`)
          const statusData = await statusRes.json()

          if (statusData.status === 'completed') {
            const result = statusData.result
            alert(`スクレイピング完了\n取得: ${result.count}件`)
            fetchSnkrdunkSales()
            fetchPrices()
            return true
          } else if (statusData.status === 'failed') {
            alert('エラー: ' + (statusData.error || '不明なエラー'))
            return true
          } else if (attempts >= maxAttempts) {
            alert('タイムアウト: 処理に時間がかかっています。後ほど確認してください。')
            return true
          }

          await new Promise(resolve => setTimeout(resolve, pollInterval))
          return pollJob()
        }

        await pollJob()
      } else {
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
      fetchPrices()
    } catch (error: any) {
      alert('❌ エラー: ' + error.message)
    }
  }

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
      fetchPrices()
    } catch (error: any) {
      alert('❌ エラー: ' + error.message)
    }
  }

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

  const siteList = useMemo(() => {
    const sites = new Map()
    saleUrls.forEach((u: any) => {
      if (u.site?.id && !sites.has(u.site.id)) {
        sites.set(u.site.id, { id: u.site.id, name: u.site.name, icon: u.site.icon })
      }
    })
    salePrices.forEach((p: any) => {
      if (p.site?.id && !sites.has(p.site.id)) {
        sites.set(p.site.id, { id: p.site.id, name: p.site.name, icon: p.site.icon })
      }
    })
    return Array.from(sites.values())
  }, [salePrices, saleUrls])

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

        if (data.gradePrices && data.gradePrices.length > 0) {
          await supabase.from('sale_prices').insert({
            card_id: card.id,
            site_id: saleUrl.site_id,
            price: data.price,
            stock: stock,
            grade: null
          })

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
          await supabase.from('sale_prices').insert({
            card_id: card.id,
            site_id: saleUrl.site_id,
            price: data.priceNumber || data.price,
            stock: stock
          })
          alert(`更新完了: ¥${(data.priceNumber || data.price).toLocaleString()}${stock !== null ? ` (在庫: ${stock})` : ''}`)
        }

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

    filteredPurchase.forEach((p: any) => {
      const dateStr = p.tweet_time || p.recorded_at || p.created_at
      const date = formatDate(dateStr)
      if (!date) return

      const roundedDate = new Date(Math.floor(date.getTime() / 60000) * 60000)
      const timestamp = roundedDate.getTime()
      const existing = dataMap.get(timestamp) || {
        timestamp,
        date: roundedDate.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      }

      const condition = p.condition || (p.is_psa ? 'psa' : 'normal')
      existing[`purchase_${condition}`] = p.price

      dataMap.set(timestamp, existing)
    })

    filteredSale.forEach((p: any) => {
      const dateStr = p.recorded_at || p.created_at
      const date = formatDate(dateStr)
      if (!date) return

      const roundedDate = new Date(Math.floor(date.getTime() / 60000) * 60000)
      const timestamp = roundedDate.getTime()
      const existing = dataMap.get(timestamp) || {
        timestamp,
        date: roundedDate.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
      }

      if (p.grade) {
        existing[`sale_grade_${p.grade}`] = p.price
      } else {
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

  // 最新価格（グレードなし=全体最安値のみ）
  const latestPrices = useMemo(() => {
    const latest: Record<string, { price: number; stock: number | null; siteName: string }> = {}
    salePrices.forEach((p: any) => {
      if (p.grade) return // グレード付きはスキップ（PSA10等の個別価格を除外）
      const siteId = p.site?.id || 'other'
      if (!latest[siteId]) {
        latest[siteId] = { price: p.price, stock: p.stock, siteName: p.site?.name || 'その他' }
      }
    })
    return latest
  }, [salePrices])

  // 買取価格をラベル別に最高額店舗を取得
  const latestPurchaseByLabel = useMemo(() => {
    // 各ラベル×店舗の最新データを集め、最高額の店舗を返す
    const byLabelShop: Record<string, Record<string, { price: number; label: string; date: string; shopName: string }>> = {}
    for (const p of purchasePrices as any[]) {
      const rawLabel = (p.link as any)?.label || ''
      let key: string; let displayLabel: string
      if (rawLabel.includes('PSA10') || rawLabel.includes('psa10')) { key = 'psa10'; displayLabel = 'PSA10' }
      else if (rawLabel.includes('未開封')) { key = 'sealed'; displayLabel = '未開封' }
      else if (rawLabel.includes('開封')) { key = 'opened'; displayLabel = '開封品' }
      else { key = 'normal'; displayLabel = '素体' }
      const shopId = p.shop?.id || 'unknown'
      if (!byLabelShop[key]) byLabelShop[key] = {}
      if (!byLabelShop[key][shopId]) {
        byLabelShop[key][shopId] = { price: p.price, label: displayLabel, date: p.created_at, shopName: p.shop?.name || '-' }
      }
    }
    const result: Record<string, { price: number; label: string; date: string; shopName: string }> = {}
    for (const [key, shops] of Object.entries(byLabelShop)) {
      const best = Object.values(shops).sort((a, b) => b.price - a.price)[0]
      if (best) result[key] = best
    }
    return result
  }, [purchasePrices])

  // 最新買取価格 = 各ラベルの最新のうち最高額
  const latestPurchase = useMemo(() => {
    const entries = Object.values(latestPurchaseByLabel)
    if (entries.length === 0) return null
    return Math.max(...entries.map(e => e.price))
  }, [latestPurchaseByLabel])

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

  // スニダン販売中最安値をグレード別に取得
  const snkrdunkLatestByGrade = useMemo(() => {
    const result: Record<string, { price: number; stock: number | null; grade: string; date: string }> = {}
    for (const p of salePrices as any[]) {
      const siteName = p.site?.name?.toLowerCase() || ''
      if (!siteName.includes('スニダン') && !siteName.includes('snkrdunk')) continue
      if (!p.grade) continue
      if (!result[p.grade]) {
        result[p.grade] = { price: p.price, stock: p.stock, grade: p.grade, date: p.created_at }
      }
    }
    return Object.values(result).sort((a, b) => {
      const orderA = GRADE_SORT_ORDER[a.grade] ?? 999
      const orderB = GRADE_SORT_ORDER[b.grade] ?? 999
      return orderA - orderB
    })
  }, [salePrices])

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

  const toggleSiteAll = (siteId: string) => {
    setVisibleSites(prev => {
      const current = prev[siteId] || { price: true, stock: true }
      const allOn = current.price !== false && current.stock !== false
      return {
        ...prev,
        [siteId]: { price: !allOn, stock: !allOn }
      }
    })
  }

  const isSiteHidden = (siteId: string) => {
    const v = visibleSites[siteId]
    return v?.price === false && v?.stock === false
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
            className={`relative group cursor-pointer ${isDragging ? 'ring-4 ring-blue-400 ring-offset-2' : ''}`}
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
            {isDragging && (
              <div className="absolute inset-0 bg-blue-500/30 rounded-xl flex items-center justify-center">
                <p className="text-white font-bold text-sm bg-blue-600 px-3 py-1.5 rounded-lg">ドロップ</p>
              </div>
            )}
            {imageUploading && (
              <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </div>
            )}
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
                {Object.keys(latestPurchaseByLabel).length > 0 && (
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                    {Object.entries(latestPurchaseByLabel)
                      .sort((a, b) => b[1].price - a[1].price)
                      .map(([key, data]) => (
                        <span key={key} className="text-xs text-blue-500">
                          {data.label} ¥{data.price.toLocaleString()}
                          <span className="text-blue-400 ml-0.5">({data.shopName})</span>
                        </span>
                      ))}
                  </div>
                )}
              </div>
              {Object.entries(latestPrices)
                .filter(([, data]) => data.stock !== 0)
                .sort((a, b) => a[1].price - b[1].price)
                .slice(0, 3)
                .map(([siteId, data], index) => (
                  <div key={siteId} className={`rounded-xl p-4 flex-1 ${index === 0 ? 'bg-green-50' : index === 1 ? 'bg-emerald-50' : 'bg-teal-50'}`}>
                    <div className={`flex items-center gap-2 text-sm mb-1 ${index === 0 ? 'text-green-600' : index === 1 ? 'text-emerald-600' : 'text-teal-600'}`}>
                      <Globe size={16} />
                      {data.siteName}
                    </div>
                    <p className={`text-2xl font-bold ${index === 0 ? 'text-green-700' : index === 1 ? 'text-emerald-700' : 'text-teal-700'}`}>
                      ¥{data.price.toLocaleString()}
                    </p>
                    {data.stock !== null && (
                      <p className={`text-sm flex items-center gap-1 ${index === 0 ? 'text-green-600' : index === 1 ? 'text-emerald-600' : 'text-teal-600'}`}>
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
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="animate-spin text-blue-500" size={32} />
            </div>
          ) : (
            <div className="bg-white border rounded-xl p-4">
              {/* タブヘッダー */}
              <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 overflow-x-auto">
                <button
                  onClick={() => setChartTab('price')}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${chartTab === 'price'
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  📈 価格・在庫推移
                </button>
                <button
                  onClick={() => setChartTab('snkrdunk')}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${chartTab === 'snkrdunk'
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  🔮 スニダン売買履歴
                </button>
                <button
                  onClick={() => setChartTab('daily')}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${chartTab === 'daily'
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  📊 日次平均推移
                </button>
                <button
                  onClick={() => setChartTab('settings')}
                  className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${chartTab === 'settings'
                    ? 'bg-white text-gray-800 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  ⚙️ 設定
                </button>
              </div>

              {/* ===== 価格・在庫推移タブ ===== */}
              {chartTab === 'price' && (
                <div className="space-y-4">
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
                      <button
                        onClick={() => setShowPurchase(!showPurchase)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition-colors ${showPurchase
                          ? 'bg-blue-100 border-blue-300 text-blue-700'
                          : 'bg-white border-gray-200 text-gray-400'
                          }`}
                      >
                        <span className={`w-3 h-3 rounded-full ${showPurchase ? 'bg-blue-500' : 'bg-gray-300'}`}></span>
                        買取価格
                        <input
                          type="checkbox"
                          checked={showPurchase}
                          onChange={() => setShowPurchase(!showPurchase)}
                          className="w-4 h-4 accent-blue-500"
                        />
                      </button>

                      {siteList.map((site) => {
                        const colorIndex = siteList.findIndex(s => s.id === site.id)
                        const color = SITE_COLORS[colorIndex % SITE_COLORS.length]
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
                            <span className="cursor-pointer" onClick={() => toggleSiteAll(site.id)}>
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

                  {/* 価格・在庫グラフ */}
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

                          {siteList
                            .filter(site => visibleSites[site.id]?.price !== false)
                            .map((site) => {
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

                          {hasStockData && siteList
                            .filter(site => visibleSites[site.id]?.stock !== false)
                            .map((site) => {
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

                  {/* 海外価格（統合） */}
                  {card.pricecharting_id && (
                    <div className="border-t pt-4 mt-4">
                      <h4 className="font-bold text-sm text-gray-700 mb-3">🌐 海外価格（PriceCharting）</h4>
                      <OverseasPriceChart
                        cardId={card.id}
                        pricechartingId={card.pricecharting_id}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* ===== スニダン売買履歴タブ（3カラム） ===== */}
              {chartTab === 'snkrdunk' && (
                <div className="grid grid-cols-3 gap-5">
                  {/* ── カラム1: スニダン売買例歴 ── */}
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    {/* ヘッダー */}
                    <div className="bg-purple-50 px-4 py-3 border-b border-purple-100">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold text-sm text-purple-800">🔮 スニダン売買例歴</h4>
                        <button
                          onClick={scrapeSnkrdunk}
                          disabled={snkrdunkScraping}
                          className="px-2.5 py-1 bg-purple-500 text-white rounded-lg text-[11px] hover:bg-purple-600 disabled:opacity-50 flex items-center gap-1 shadow-sm"
                        >
                          {snkrdunkScraping ? <RefreshCw size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                          更新
                        </button>
                      </div>
                      {snkrdunkSales.length > 0 && (
                        <p className="text-[10px] text-purple-500 mt-1">
                          最終取引: {formatRelativeTime((snkrdunkSales as any[]).sort((a: any, b: any) => new Date(b.sold_at).getTime() - new Date(a.sold_at).getTime())[0]?.sold_at)}
                        </p>
                      )}
                    </div>

                    <div className="p-3 space-y-3">
                      {/* カテゴリタブ */}
                      {(() => {
                        const hasBoxData = snkrdunkSales.some((s: any) => isBoxGrade(s.grade))
                        const hasSingleData = snkrdunkSales.some((s: any) => !isBoxGrade(s.grade))
                        const isBoxCard = hasBoxData && !hasSingleData

                        const boxQuantities = isBoxCard
                          ? [...new Set(snkrdunkSales.map((s: any) => s.grade))]
                              .filter(isBoxGrade)
                              .sort((a, b) => (parseInt(a) || 999) - (parseInt(b) || 999))
                          : []

                        const categories = isBoxCard
                          ? [
                              { key: 'all', label: 'すべて', grades: null as string[] | null },
                              ...boxQuantities.map(q => ({ key: q, label: q, grades: [q] })),
                            ]
                          : SINGLE_CATEGORIES

                        return (
                          <div className="flex flex-wrap gap-1">
                            {categories.map(cat => {
                              const hasData = cat.grades === null
                                ? true
                                : snkrdunkSales.some((s: any) => cat.grades!.includes(s.grade))
                              if (!hasData && cat.key !== 'all') return null
                              return (
                                <button
                                  key={cat.key}
                                  onClick={() => setSelectedSnkrdunkCategory(cat.key)}
                                  className={`px-2 py-0.5 rounded-lg text-[11px] font-medium transition-colors ${
                                    selectedSnkrdunkCategory === cat.key
                                      ? 'bg-purple-600 text-white shadow-sm'
                                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                  }`}
                                >
                                  {cat.label}
                                </button>
                              )
                            })}
                          </div>
                        )
                      })()}

                      {/* サマリー + リスト */}
                      {snkrdunkLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <RefreshCw className="animate-spin text-purple-500" size={24} />
                        </div>
                      ) : (() => {
                        const hasBoxData = snkrdunkSales.some((s: any) => isBoxGrade(s.grade))
                        const hasSingleData = snkrdunkSales.some((s: any) => !isBoxGrade(s.grade))
                        const isBoxCard = hasBoxData && !hasSingleData

                        const categories = isBoxCard
                          ? [{ key: 'all', label: 'すべて', grades: null as string[] | null }]
                          : SINGLE_CATEGORIES
                        const cat = categories.find(c => c.key === selectedSnkrdunkCategory)
                          || (isBoxCard && selectedSnkrdunkCategory !== 'all'
                            ? { key: selectedSnkrdunkCategory, label: selectedSnkrdunkCategory, grades: [selectedSnkrdunkCategory] }
                            : categories[0])

                        const filtered = [...snkrdunkSales]
                          .filter((s: any) => {
                            if (isBoxCard) {
                              if (!isBoxGrade(s.grade)) return false
                              if (cat.grades === null) return true
                              return cat.grades.includes(s.grade)
                            } else {
                              if (isBoxGrade(s.grade)) return false
                              if (cat.grades === null) return true
                              return cat.grades.includes(s.grade)
                            }
                          })
                          .sort((a: any, b: any) => new Date(b.sold_at).getTime() - new Date(a.sold_at).getTime())

                        if (filtered.length === 0) {
                          return (
                            <div className="bg-gray-50 rounded-xl p-6 text-center text-gray-400 text-sm">
                              売買履歴データがありません
                            </div>
                          )
                        }

                        const prices = filtered.map((s: any) => s.price)
                        const latestPrice = prices[0]
                        const avg = Math.round(prices.reduce((a: number, b: number) => a + b, 0) / prices.length)
                        const min = Math.min(...prices)

                        return (
                          <>
                            <div className="grid grid-cols-3 gap-1.5">
                              <div className="bg-gradient-to-b from-purple-50 to-purple-100/50 rounded-lg p-2 text-center">
                                <p className="text-[10px] text-purple-500 font-medium">最新</p>
                                <p className="text-xs font-bold text-purple-700">¥{latestPrice.toLocaleString()}</p>
                              </div>
                              <div className="bg-gradient-to-b from-gray-50 to-gray-100/50 rounded-lg p-2 text-center">
                                <p className="text-[10px] text-gray-500 font-medium">平均</p>
                                <p className="text-xs font-bold text-gray-700">¥{avg.toLocaleString()}</p>
                              </div>
                              <div className="bg-gradient-to-b from-blue-50 to-blue-100/50 rounded-lg p-2 text-center">
                                <p className="text-[10px] text-blue-500 font-medium">最安</p>
                                <p className="text-xs font-bold text-blue-700">¥{min.toLocaleString()}</p>
                              </div>
                            </div>

                            <div className="max-h-[380px] overflow-auto rounded-lg border border-gray-100">
                              <table className="w-full text-sm">
                                <thead className="bg-purple-50/80 sticky top-0 z-10">
                                  <tr>
                                    <th className="text-left px-3 py-2 text-[11px] font-medium text-purple-600">日時</th>
                                    <th className="text-center px-2 py-2 text-[11px] font-medium text-purple-600">グレード</th>
                                    <th className="text-right px-3 py-2 text-[11px] font-medium text-purple-600">価格</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                  {filtered.map((sale: any, i: number) => {
                                    const date = new Date(sale.sold_at)
                                    const gradeColor = SNKRDUNK_GRADE_COLORS[sale.grade] || '#6b7280'
                                    return (
                                      <tr key={i} className="hover:bg-purple-50/30 transition-colors">
                                        <td className="px-3 py-2 text-[11px] text-gray-500">
                                          {date.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                        <td className="px-2 py-2 text-center">
                                          <span
                                            className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                                            style={{ backgroundColor: `${gradeColor}15`, color: gradeColor }}
                                          >
                                            {sale.grade}
                                          </span>
                                        </td>
                                        <td className="px-3 py-2 text-right font-semibold text-gray-800 text-xs">
                                          ¥{sale.price.toLocaleString()}
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </>
                        )
                      })()}
                    </div>
                  </div>

                  {/* ── カラム2: 買取 ── */}
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    {/* ヘッダー */}
                    <div className="bg-blue-50 px-4 py-3 border-b border-blue-100">
                      <h4 className="font-bold text-sm text-blue-800">🏪 買取（最高額店舗）</h4>
                      {purchasePrices.length > 0 && (
                        <p className="text-[10px] text-blue-500 mt-1">
                          更新: {formatRelativeTime((purchasePrices as any[])[0]?.created_at)}
                        </p>
                      )}
                    </div>

                    <div className="p-3 space-y-3">
                      {/* 買取ラベル別 最高額店舗 */}
                      {Object.keys(latestPurchaseByLabel).length > 0 ? (
                        <div className="space-y-2">
                          {Object.entries(latestPurchaseByLabel)
                            .sort((a, b) => b[1].price - a[1].price)
                            .map(([key, data]) => {
                              const config = PURCHASE_CONDITION_COLORS[key] || { color: '#3b82f6', label: data.label }
                              return (
                                <div key={key} className="bg-gradient-to-r from-gray-50 to-white border border-gray-100 rounded-lg p-3">
                                  <div className="flex items-center justify-between mb-1">
                                    <span
                                      className="px-2 py-0.5 rounded-md text-[11px] font-semibold"
                                      style={{ backgroundColor: `${config.color}12`, color: config.color }}
                                    >
                                      {data.label}
                                    </span>
                                    <span className="font-bold text-gray-900 text-base">¥{data.price.toLocaleString()}</span>
                                  </div>
                                  <div className="flex items-center justify-between text-[10px] text-gray-400">
                                    <span>{data.shopName}</span>
                                    <span>{formatRelativeTime(data.date)}</span>
                                  </div>
                                </div>
                              )
                            })}
                        </div>
                      ) : (
                        <div className="bg-gray-50 rounded-xl p-6 text-center text-gray-400 text-sm">
                          買取データなし
                        </div>
                      )}

                      {/* 買取履歴テーブル */}
                      {purchasePrices.length > 0 && (
                        <div className="max-h-[320px] overflow-auto rounded-lg border border-gray-100">
                          <table className="w-full text-sm">
                            <thead className="bg-blue-50/80 sticky top-0 z-10">
                              <tr>
                                <th className="text-left px-3 py-2 text-[11px] font-medium text-blue-600">店舗</th>
                                <th className="text-center px-2 py-2 text-[11px] font-medium text-blue-600">状態</th>
                                <th className="text-right px-3 py-2 text-[11px] font-medium text-blue-600">価格</th>
                                <th className="text-right px-2 py-2 text-[11px] font-medium text-blue-600">日時</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {(purchasePrices as any[]).slice(0, 30).map((p: any, i) => {
                                const rawLabel = (p.link as any)?.label || ''
                                let condKey = 'normal'
                                if (rawLabel.includes('PSA10') || rawLabel.includes('psa10')) condKey = 'psa'
                                else if (rawLabel.includes('未開封')) condKey = 'sealed'
                                else if (rawLabel.includes('開封')) condKey = 'opened'
                                const condConfig = PURCHASE_CONDITION_COLORS[condKey] || { color: '#3b82f6', label: condKey }
                                const date = formatDate(p.tweet_time || p.recorded_at || p.created_at)
                                return (
                                  <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                                    <td className="px-3 py-2 text-[11px] text-gray-600">{p.shop?.name || '-'}</td>
                                    <td className="px-2 py-2 text-center">
                                      <span
                                        className="px-1.5 py-0.5 rounded text-[10px] font-medium"
                                        style={{ backgroundColor: `${condConfig.color}15`, color: condConfig.color }}
                                      >
                                        {condConfig.label}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-right font-semibold text-gray-800 text-xs">
                                      ¥{p.price.toLocaleString()}
                                    </td>
                                    <td className="px-2 py-2 text-right text-[10px] text-gray-400">
                                      {date ? date.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── カラム3: スニダン販売中最安値一覧 ── */}
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    {/* ヘッダー */}
                    <div className="bg-green-50 px-4 py-3 border-b border-green-100">
                      <h4 className="font-bold text-sm text-green-800">🛒 スニダン販売中最安値</h4>
                      {snkrdunkLatestByGrade.length > 0 && (
                        <p className="text-[10px] text-green-500 mt-1">
                          更新: {formatRelativeTime(snkrdunkLatestByGrade[0]?.date)}
                        </p>
                      )}
                    </div>

                    <div className="p-3 space-y-3">
                      {snkrdunkLatestByGrade.length > 0 ? (
                        <div className="space-y-2">
                          {snkrdunkLatestByGrade.map((item) => {
                            const gradeColor = SNKRDUNK_GRADE_COLORS[item.grade] || '#6b7280'
                            return (
                              <div key={item.grade} className="bg-gradient-to-r from-gray-50 to-white border border-gray-100 rounded-lg p-3">
                                <div className="flex items-center justify-between mb-1">
                                  <span
                                    className="px-2 py-0.5 rounded-md text-[11px] font-semibold"
                                    style={{ backgroundColor: `${gradeColor}12`, color: gradeColor }}
                                  >
                                    {item.grade}
                                  </span>
                                  <div className="text-right">
                                    <span className="font-bold text-gray-900 text-base">¥{item.price.toLocaleString()}</span>
                                    {item.stock !== null && (
                                      <span className="text-[10px] text-gray-400 ml-1.5">({item.stock}件)</span>
                                    )}
                                  </div>
                                </div>
                                <div className="text-right text-[10px] text-gray-400">
                                  {formatRelativeTime(item.date)}
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="bg-gray-50 rounded-xl p-6 text-center text-gray-400 text-sm">
                          販売中データなし
                        </div>
                      )}

                      {/* 販売価格履歴テーブル */}
                      {salePrices.length > 0 && (
                        <div className="max-h-[320px] overflow-auto rounded-lg border border-gray-100">
                          <table className="w-full text-sm">
                            <thead className="bg-green-50/80 sticky top-0 z-10">
                              <tr>
                                <th className="text-left px-3 py-2 text-[11px] font-medium text-green-600">サイト</th>
                                <th className="text-center px-2 py-2 text-[11px] font-medium text-green-600">グレード</th>
                                <th className="text-right px-3 py-2 text-[11px] font-medium text-green-600">価格</th>
                                <th className="text-right px-2 py-2 text-[11px] font-medium text-green-600">日時</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                              {(salePrices as any[]).slice(0, 30).map((p: any, i) => {
                                const date = formatDate(p.recorded_at || p.created_at)
                                return (
                                  <tr key={i} className="hover:bg-green-50/30 transition-colors">
                                    <td className="px-3 py-2 text-[11px] text-gray-600">{p.site?.name || '-'}</td>
                                    <td className="px-2 py-2 text-center">
                                      {p.grade ? (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-gray-100 text-gray-600 font-medium">{p.grade}</span>
                                      ) : '-'}
                                    </td>
                                    <td className="px-3 py-2 text-right font-semibold text-gray-800 text-xs">
                                      ¥{p.price.toLocaleString()}
                                    </td>
                                    <td className="px-2 py-2 text-right text-[10px] text-gray-400">
                                      {date ? date.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'}
                                    </td>
                                  </tr>
                                )
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* ===== 日次平均推移タブ ===== */}
              {chartTab === 'daily' && (
                <MarketChart cardId={card.id} />
              )}

              {/* ===== 設定タブ ===== */}
              {chartTab === 'settings' && (
                <SettingsTab
                  card={card}
                  saleUrls={saleUrls}
                  purchaseLinks={purchaseLinks}
                  snkrdunkScraping={snkrdunkScraping}
                  scraping={scraping}
                  onScrapeSnkrdunk={scrapeSnkrdunk}
                  onUpdateAutoScrapeMode={updateAutoScrapeMode}
                  onUpdateScrapeInterval={updateScrapeInterval}
                  onUpdateCheckInterval={updateCheckInterval}
                  onUpdatePrice={updatePrice}
                  onShowSaleUrlForm={() => setShowSaleUrlForm(true)}
                  onLinksChanged={() => { fetchPurchaseLinks(); fetchPrices(); onUpdated?.() }}
                  onUpdated={onUpdated}
                />
              )}
            </div>
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
