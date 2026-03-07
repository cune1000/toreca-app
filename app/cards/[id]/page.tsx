'use client'

import { useState, useEffect, useMemo, use } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { RefreshCw, ArrowLeft, Home } from 'lucide-react'
import Link from 'next/link'
import CardDetailHeader from '@/components/card-detail/CardDetailHeader'
import PriceChartTab from '@/components/card-detail/PriceChartTab'
import SnkrdunkTab from '@/components/card-detail/SnkrdunkTab'
import SettingsTab from '@/components/card-detail/SettingsTab'
import CardEditForm from '@/components/CardEditForm'
import { GRADE_SORT_ORDER } from '@/components/card-detail/constants'
import { isSnkrdunkSiteName, isSnkrdunkUrl } from '@/lib/snkrdunk-api'

interface Props {
  params: Promise<{ id: string }>
}

export default function CardDetailPage({ params }: Props) {
  const { id } = use(params)
  const router = useRouter()

  // ── Card data ──
  const [card, setCard] = useState<any>(null)
  const [cardLoading, setCardLoading] = useState(true)

  // ── Core data state ──
  const [purchasePrices, setPurchasePrices] = useState<any[]>([])
  const [salePrices, setSalePrices] = useState<any[]>([])
  const [saleUrls, setSaleUrls] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [purchaseLinks, setPurchaseLinks] = useState<any[]>([])

  // ── UI state ──
  const [showEditForm, setShowEditForm] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(30)
  const [cardImageUrl, setCardImageUrl] = useState<string | null>(null)
  const [chartTab, setChartTab] = useState<'price' | 'snkrdunk' | 'settings'>('price')
  const [visibleSites, setVisibleSites] = useState<Record<string, { price: boolean; stock: boolean }>>({})

  // ── Snkrdunk state ──
  const [selectedSnkrdunkCategory, setSelectedSnkrdunkCategory] = useState('all')
  const [snkrdunkSales, setSnkrdunkSales] = useState<any[]>([])
  const [snkrdunkLoading, setSnkrdunkLoading] = useState(false)
  const [snkrdunkScraping, setSnkrdunkScraping] = useState(false)

  // ── Overseas price state ──
  const [overseasLatest, setOverseasLatest] = useState<any | null>(null)
  const [overseasHistory, setOverseasHistory] = useState<any[]>([])

  // ── JustTCG NM price history ──
  const [justTcgHistory, setJustTcgHistory] = useState<any[]>([])
  const [exchangeRate, setExchangeRate] = useState<number>(155)

  // ── Fetch card data ──
  useEffect(() => {
    const fetchCard = async () => {
      setCardLoading(true)
      try {
        const { data } = await supabase
          .from('cards')
          .select('*, category_large:category_large_id(id, name, icon), rarities:rarity_id(id, name)')
          .eq('id', id)
          .single()
        if (data) {
          setCard(data)
          setCardImageUrl(data.image_url || null)
        }
      } catch (err) {
        console.error('Failed to fetch card:', err)
      } finally {
        setCardLoading(false)
      }
    }
    fetchCard()
  }, [id])

  // ── Fetch prices & related data when card is loaded ──
  useEffect(() => {
    if (card?.id) {
      fetchPrices()
      fetchSnkrdunkSales()
      fetchPurchaseLinks()
      fetchOverseasPrices()
      fetchJustTcgHistory()
    }
  }, [card?.id, card?.pricecharting_id])

  const fetchPurchaseLinks = async () => {
    try {
      const res = await fetch(`/api/purchase-links?card_id=${card.id}`)
      const json = await res.json()
      if (json.success) setPurchaseLinks(json.data || [])
    } catch (err) { console.error('Failed to fetch purchase links:', err) }
  }

  const fetchPrices = async () => {
    setLoading(true)
    try {
      const [purchaseRes, saleRes, urlRes] = await Promise.all([
        supabase.from('purchase_prices').select('*, shop:shop_id(id, name, icon), link:link_id(label)').eq('card_id', card.id).order('created_at', { ascending: false }).limit(200),
        supabase.from('sale_prices').select('*, site:site_id(id, name, icon), grade').eq('card_id', card.id).order('created_at', { ascending: false }).limit(200),
        supabase.from('card_sale_urls').select('*, site:site_id(id, name, icon, url)').eq('card_id', card.id),
      ])
      setPurchasePrices(purchaseRes.data || [])
      setSalePrices(saleRes.data || [])
      setSaleUrls(urlRes.data || [])
    } catch (err) { console.error('Failed to fetch prices:', err) } finally { setLoading(false) }
  }

  const fetchSnkrdunkSales = async () => {
    setSnkrdunkLoading(true)
    try {
      const res = await fetch(`/api/snkrdunk-sales?cardId=${card.id}&days=0`)
      const data = await res.json()
      if (data.success) setSnkrdunkSales(data.data || [])
    } catch (error) { console.error('Failed to fetch snkrdunk sales:', error) } finally { setSnkrdunkLoading(false) }
  }

  const fetchOverseasPrices = async () => {
    if (!card.pricecharting_id) return
    try {
      const res = await fetch(`/api/overseas-prices?card_id=${card.id}&days=0`)
      const json = await res.json()
      if (json.success && json.data?.length > 0) {
        setOverseasHistory(json.data)
        setOverseasLatest(json.data[json.data.length - 1])
      }
    } catch (err) { console.error('Failed to fetch overseas prices:', err) }
  }

  const fetchJustTcgHistory = async () => {
    try {
      const [{ data: history }, { data: rateData }] = await Promise.all([
        supabase
          .from('justtcg_price_history')
          .select('recorded_at, price_usd')
          .eq('card_id', card.id)
          .order('recorded_at', { ascending: true }),
        supabase
          .from('exchange_rates')
          .select('rate')
          .eq('base_currency', 'USD')
          .eq('target_currency', 'JPY')
          .order('recorded_at', { ascending: false })
          .limit(1),
      ])
      if (rateData?.[0]?.rate) setExchangeRate(rateData[0].rate)
      setJustTcgHistory(history || [])
    } catch (err) { console.error('Failed to fetch JustTCG history:', err) }
  }

  const handleCardUpdated = async () => {
    const { data } = await supabase
      .from('cards')
      .select('*, category_large:category_large_id(id, name, icon), rarities:rarity_id(id, name)')
      .eq('id', id)
      .single()
    if (data) {
      setCard(data)
      setCardImageUrl(data.image_url || null)
    }
  }

  // ── Actions ──
  const scrapeSnkrdunk = async () => {
    const snkrdunkUrl = saleUrls.find((url: any) =>
      isSnkrdunkSiteName(url.site?.name || '') || isSnkrdunkUrl(url.product_url || '')
    )
    if (!snkrdunkUrl) { alert('スニダンのURLが設定されていません。'); return }
    setSnkrdunkScraping(true)
    try {
      const res = await fetch('/api/snkrdunk-scrape', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cardId: card.id, url: snkrdunkUrl.product_url }) })
      const data = await res.json()
      if (!data.success) { alert('エラー: ' + data.error); return }
      alert(`完了: ${data.total}件 (新規: ${data.inserted}件)`); fetchSnkrdunkSales(); fetchPrices()
    } catch (error: any) { alert('エラー: ' + error.message) } finally { setSnkrdunkScraping(false) }
  }

  const editSaleUrl = async (saleUrlId: string, newUrl: string) => {
    try {
      const { error } = await supabase.from('card_sale_urls').update({ product_url: newUrl }).eq('id', saleUrlId)
      if (error) throw error
      fetchPrices()
    } catch (error: any) { alert('URL変更エラー: ' + error.message) }
  }

  const deleteSaleUrl = async (saleUrlId: string) => {
    try {
      const { error } = await supabase.from('card_sale_urls').delete().eq('id', saleUrlId)
      if (error) throw error
      fetchPrices()
    } catch (error: any) { alert('URL削除エラー: ' + error.message) }
  }

  // ── Computed data (useMemo) ──
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null
    const date = new Date(dateStr)
    return isNaN(date.getTime()) ? null : date
  }

  const filterByPeriod = (data: any[]) => {
    if (selectedPeriod === null) return data
    const cutoff = new Date(Date.now() - selectedPeriod * 24 * 60 * 60 * 1000)
    return data.filter(item => { const d = formatDate(item.tweet_time || item.recorded_at || item.created_at); return d && d >= cutoff })
  }

  const siteList = useMemo(() => {
    const sites = new Map()
    saleUrls.forEach((u: any) => { if (u.site?.id && !sites.has(u.site.id)) sites.set(u.site.id, { id: u.site.id, name: u.site.name, icon: u.site.icon }) })
    salePrices.forEach((p: any) => { if (p.site?.id && !sites.has(p.site.id)) sites.set(p.site.id, { id: p.site.id, name: p.site.name, icon: p.site.icon }) })
    return Array.from(sites.values())
  }, [salePrices, saleUrls])

  useEffect(() => {
    if (siteList.length === 0) return
    setVisibleSites(prev => {
      const n: Record<string, { price: boolean; stock: boolean }> = {}
      siteList.forEach(site => { n[site.id] = prev[site.id] || { price: true, stock: true } })
      return n
    })
  }, [siteList])

  const chartData = useMemo(() => {
    const filteredPurchase = filterByPeriod(purchasePrices)
    const filteredSale = filterByPeriod(salePrices)
    const dataMap = new Map<number, any>()
    const makeDateLabel = (d: Date) => d.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })

    filteredPurchase.forEach((p: any) => {
      const d = formatDate(p.tweet_time || p.recorded_at || p.created_at); if (!d) return
      const rd = new Date(Math.floor(d.getTime() / 60000) * 60000); const ts = rd.getTime()
      const existing = dataMap.get(ts) || { timestamp: ts, date: makeDateLabel(rd) }
      const pKey = `purchase_${p.condition || (p.is_psa ? 'psa' : '素体')}`
      existing[pKey] = Math.max(existing[pKey] || 0, p.price)  // 同一時刻は最高値を採用
      dataMap.set(ts, existing)
    })
    filteredSale.forEach((p: any) => {
      const d = formatDate(p.recorded_at || p.created_at); if (!d) return
      const rd = new Date(Math.floor(d.getTime() / 60000) * 60000); const ts = rd.getTime()
      const existing = dataMap.get(ts) || { timestamp: ts, date: makeDateLabel(rd) }
      if (p.grade) {
        const gKey = `sale_grade_${p.grade}`
        if (!(gKey in existing)) existing[gKey] = p.price  // 最新値を優先
        if (p.stock != null && !(`stock_grade_${p.grade}` in existing)) existing[`stock_grade_${p.grade}`] = p.stock
      } else {
        const siteId = p.site?.id || 'other'
        if (!(`price_${siteId}` in existing)) existing[`price_${siteId}`] = p.price
        if (p.stock != null && !(`stock_${siteId}` in existing)) existing[`stock_${siteId}`] = p.stock
      }
      dataMap.set(ts, existing)
    })

    // 海外価格データを日次で追加
    if (overseasHistory.length > 0) {
      const cutoff = selectedPeriod ? new Date(Date.now() - selectedPeriod * 86400000) : null
      for (const op of overseasHistory) {
        const d = formatDate(op.recorded_at); if (!d) continue
        if (cutoff && d < cutoff) continue
        const dayNoon = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0)
        const ts = dayNoon.getTime()
        const existing = dataMap.get(ts) || { timestamp: ts, date: makeDateLabel(dayNoon) }
        if (op.loose_price_jpy) existing.overseas_loose = op.loose_price_jpy
        if (op.graded_price_jpy) existing.overseas_graded = op.graded_price_jpy
        dataMap.set(ts, existing)
      }
    }

    // JustTCG NM価格データを日次で追加（USD→JPY変換）
    if (justTcgHistory.length > 0) {
      const cutoff = selectedPeriod ? new Date(Date.now() - selectedPeriod * 86400000) : null
      for (const jh of justTcgHistory) {
        const d = formatDate(jh.recorded_at); if (!d) continue
        if (cutoff && d < cutoff) continue
        const dayNoon = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0)
        const ts = dayNoon.getTime()
        const existing = dataMap.get(ts) || { timestamp: ts, date: makeDateLabel(dayNoon) }
        if (jh.price_usd) existing.justtcg_nm_jpy = Math.round(jh.price_usd * exchangeRate)
        dataMap.set(ts, existing)
      }
    }

    // 売買日次平均を追加
    if (snkrdunkSales.length > 0) {
      const cutoff = selectedPeriod ? new Date(Date.now() - selectedPeriod * 86400000) : null
      const tradeByDay: Record<number, number[]> = {}
      for (const s of snkrdunkSales) {
        const d = formatDate(s.sold_at); if (!d || !s.price || s.price <= 0) continue
        if (cutoff && d < cutoff) continue
        const dayNoon = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0)
        const ts = dayNoon.getTime()
        if (!tradeByDay[ts]) tradeByDay[ts] = []
        tradeByDay[ts].push(s.price)
      }
      for (const [tsStr, prices] of Object.entries(tradeByDay)) {
        const ts = Number(tsStr)
        const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length)
        const existing = dataMap.get(ts) || { timestamp: ts, date: makeDateLabel(new Date(ts)) }
        existing.daily_trade_avg = avg
        dataMap.set(ts, existing)
      }
    }

    return Array.from(dataMap.values()).sort((a, b) => a.timestamp - b.timestamp).slice(-300)
  }, [purchasePrices, salePrices, overseasHistory, justTcgHistory, exchangeRate, snkrdunkSales, selectedPeriod])

  const latestPrices = useMemo(() => {
    const latest: Record<string, { price: number; stock: number | null; siteName: string }> = {}
    salePrices.forEach((p: any) => { if (p.grade) return; const siteId = p.site?.id || 'other'; if (!latest[siteId]) latest[siteId] = { price: p.price, stock: p.stock, siteName: p.site?.name || 'その他' } })
    return latest
  }, [salePrices])

  const latestPurchaseByLabel = useMemo(() => {
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
      if (!byLabelShop[key][shopId]) byLabelShop[key][shopId] = { price: p.price, label: displayLabel, date: p.created_at, shopName: p.shop?.name || '-' }
    }
    const result: Record<string, { price: number; label: string; date: string; shopName: string }> = {}
    for (const [key, shops] of Object.entries(byLabelShop)) { const best = Object.values(shops).sort((a, b) => b.price - a.price)[0]; if (best) result[key] = best }
    return result
  }, [purchasePrices])

  const latestPurchase = useMemo(() => {
    const entries = Object.values(latestPurchaseByLabel); return entries.length === 0 ? null : Math.max(...entries.map(e => e.price))
  }, [latestPurchaseByLabel])

  const hasGradeStockData = useMemo(() => salePrices.some((p: any) => p.stock != null && p.grade), [salePrices])
  const purchaseConditions = useMemo(() => {
    const order: Record<string, number> = { 'PSA10': 1, '素体': 2, '未開封': 3, '開封済み': 4 }
    const c = new Set<string>(); purchasePrices.forEach((p: any) => c.add(p.condition || (p.is_psa ? 'psa' : '素体')))
    return Array.from(c).sort((a, b) => (order[a] ?? 99) - (order[b] ?? 99))
  }, [purchasePrices])
  const saleGrades = useMemo(() => { const g = new Set<string>(); salePrices.forEach((p: any) => { if (p.grade) g.add(p.grade) }); return Array.from(g).sort((a, b) => (GRADE_SORT_ORDER[a] ?? 999) - (GRADE_SORT_ORDER[b] ?? 999)) }, [salePrices])

  const snkrdunkLatestByGrade = useMemo(() => {
    const result: Record<string, { price: number; stock: number | null; grade: string; date: string; topPrices?: number[] }> = {}
    for (const p of salePrices as any[]) {
      if (!isSnkrdunkSiteName(p.site?.name || '')) continue
      if (!p.grade) continue
      if (!result[p.grade]) result[p.grade] = {
        price: p.price, stock: p.stock, grade: p.grade, date: p.created_at,
        topPrices: p.top_prices || [p.price],
      }
    }
    return Object.values(result).sort((a, b) => (GRADE_SORT_ORDER[a.grade] ?? 999) - (GRADE_SORT_ORDER[b.grade] ?? 999))
  }, [salePrices])

  // ── Price diffs for header badge (海外で売る vs 国内買取 の差額) ──
  const priceDiffs = useMemo(() => {
    if (!overseasLatest) return []
    const diffs: { label: string; displayLabel: string; diffJpy: number; diffPercent: number }[] = []
    // PSA10: 海外graded vs 国内買取PSA10
    const gradedJpy = overseasLatest.graded_price_jpy
    const purchasePSA10 = latestPurchaseByLabel['psa10']
    if (gradedJpy && purchasePSA10 && purchasePSA10.price > 0) {
      const profit = gradedJpy - purchasePSA10.price
      diffs.push({ label: 'psa10', displayLabel: 'PSA10→海外', diffJpy: profit, diffPercent: Math.round((profit / purchasePSA10.price) * 1000) / 10 })
    }
    // 素体: 海外loose vs 国内買取素体
    const looseJpy = overseasLatest.loose_price_jpy
    const purchaseNormal = latestPurchaseByLabel['normal']
    if (looseJpy && purchaseNormal && purchaseNormal.price > 0) {
      const profit = looseJpy - purchaseNormal.price
      diffs.push({ label: 'normal', displayLabel: '素体→海外', diffJpy: profit, diffPercent: Math.round((profit / purchaseNormal.price) * 1000) / 10 })
    }
    return diffs
  }, [overseasLatest, latestPurchaseByLabel])

  // ── Chart settings persistence ──

  // ── Site visibility toggles ──
  const toggleSitePrice = (siteId: string) => setVisibleSites(prev => ({ ...prev, [siteId]: { ...prev[siteId], price: !prev[siteId]?.price } }))
  const toggleSiteStock = (siteId: string) => setVisibleSites(prev => ({ ...prev, [siteId]: { ...prev[siteId], stock: !prev[siteId]?.stock } }))
  const toggleSiteAll = (siteId: string) => setVisibleSites(prev => { const c = prev[siteId] || { price: true, stock: true }; const allOn = c.price !== false || c.stock !== false; return { ...prev, [siteId]: { price: !allOn, stock: !allOn } } })
  const isSiteHidden = (siteId: string) => { const v = visibleSites[siteId]; return v?.price === false && v?.stock === false }

  // ── Loading state ──
  if (cardLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <RefreshCw className="animate-spin text-blue-500" size={32} />
      </div>
    )
  }

  if (!card) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 mb-4">カードが見つかりません</p>
          <Link href="/" className="text-blue-500 hover:underline">ホームに戻る</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* トップバー */}
      <header className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-[1400px] mx-auto px-6 py-3 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-700 transition-colors text-sm"
          >
            <ArrowLeft size={16} />
            戻る
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-slate-800 truncate">{card.name}</h1>
          </div>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-slate-400 hover:text-slate-600 transition-colors text-sm"
          >
            <Home size={16} />
          </Link>
        </div>
      </header>

      {/* メインコンテンツ */}
      <main className="max-w-[1400px] mx-auto">
        {/* ヘッダー */}
        <div className="bg-white border-b border-slate-200">
          <CardDetailHeader
            card={card}
            cardImageUrl={cardImageUrl}
            latestPurchase={latestPurchase}
            latestPurchaseByLabel={latestPurchaseByLabel}
            latestPrices={latestPrices}
            priceDiffs={priceDiffs}
            snkrdunkLatestByGrade={snkrdunkLatestByGrade}
            overseasLatest={overseasLatest}
            onClose={() => router.back()}
            onEdit={() => setShowEditForm(true)}
            onUpdated={handleCardUpdated}
            onImageChanged={setCardImageUrl}
          />
        </div>

        {/* タブコンテンツ */}
        <div className="p-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="animate-spin text-blue-500" size={32} />
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              {/* タブヘッダー（3タブ） */}
              <div className="flex gap-1 mb-4 bg-slate-100 rounded-lg p-1">
                {([
                  { key: 'price' as const, label: '📈 価格推移' },
                  { key: 'snkrdunk' as const, label: '🔮 スニダン売買' },
                  { key: 'settings' as const, label: '⚙️ 設定' },
                ] as const).map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setChartTab(tab.key)}
                    className={`flex-1 px-3 py-2 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                      chartTab === tab.key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* 価格推移タブ */}
              {chartTab === 'price' && (
                <PriceChartTab
                  card={card}
                  chartData={chartData}
                  selectedPeriod={selectedPeriod}
                  onPeriodChange={setSelectedPeriod}
                  siteList={siteList}
                  visibleSites={visibleSites}
                  onToggleSitePrice={toggleSitePrice}
                  onToggleSiteStock={toggleSiteStock}
                  onToggleSiteAll={toggleSiteAll}
                  isSiteHidden={isSiteHidden}
                  purchaseConditions={purchaseConditions}
                  saleGrades={saleGrades}
                  hasGradeStockData={hasGradeStockData}
                  onRefreshOverseas={fetchOverseasPrices}
                />
              )}

              {/* スニダン売買タブ */}
              {chartTab === 'snkrdunk' && (
                <SnkrdunkTab
                  cardId={card.id}
                  snkrdunkSales={snkrdunkSales}
                  snkrdunkLoading={snkrdunkLoading}
                  snkrdunkScraping={snkrdunkScraping}
                  selectedSnkrdunkCategory={selectedSnkrdunkCategory}
                  onCategoryChange={setSelectedSnkrdunkCategory}
                  onScrape={scrapeSnkrdunk}
                  purchasePrices={purchasePrices}
                  salePrices={salePrices}
                  latestPurchaseByLabel={latestPurchaseByLabel}
                  snkrdunkLatestByGrade={snkrdunkLatestByGrade}
                  formatDate={formatDate}
                />
              )}

              {/* 設定タブ */}
              {chartTab === 'settings' && (
                <SettingsTab
                  card={card}
                  saleUrls={saleUrls}
                  purchaseLinks={purchaseLinks}
                  snkrdunkScraping={snkrdunkScraping}
                  onScrapeSnkrdunk={scrapeSnkrdunk}
                  onLinksChanged={() => { fetchPurchaseLinks(); fetchPrices(); handleCardUpdated() }}
                  onUpdated={handleCardUpdated}
                  onEditSaleUrl={editSaleUrl}
                  onDeleteSaleUrl={deleteSaleUrl}
                />
              )}
            </div>
          )}
        </div>
      </main>

      {showEditForm && (
        <CardEditForm
          card={card}
          onClose={() => setShowEditForm(false)}
          onSaved={() => { setShowEditForm(false); handleCardUpdated() }}
        />
      )}

    </div>
  )
}
