'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { RefreshCw } from 'lucide-react'
import CardDetailHeader from './card-detail/CardDetailHeader'
import PriceChartTab from './card-detail/PriceChartTab'
import SnkrdunkTab from './card-detail/SnkrdunkTab'
import SettingsTab from './card-detail/SettingsTab'
import CardEditForm from './CardEditForm'
import SaleUrlForm from './SaleUrlForm'
import { GRADE_SORT_ORDER } from './card-detail/constants'

export default function CardDetail({ card, onClose, onUpdated }: { card: any; onClose: () => void; onUpdated?: () => void }) {
  // ── Core data state ──
  const [purchasePrices, setPurchasePrices] = useState<any[]>([])
  const [salePrices, setSalePrices] = useState<any[]>([])
  const [saleUrls, setSaleUrls] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [scraping, setScraping] = useState(false)
  const [purchaseLinks, setPurchaseLinks] = useState<any[]>([])

  // ── UI state ──
  const [showEditForm, setShowEditForm] = useState(false)
  const [showSaleUrlForm, setShowSaleUrlForm] = useState(false)
  const [selectedPeriod, setSelectedPeriod] = useState<number | null>(30)
  const [cardImageUrl, setCardImageUrl] = useState(card?.image_url || null)
  const [showPurchase, setShowPurchase] = useState(true)
  const [chartTab, setChartTab] = useState<'price' | 'snkrdunk' | 'settings'>('price')
  const [visibleSites, setVisibleSites] = useState<Record<string, { price: boolean; stock: boolean }>>({})

  // ── Snkrdunk state ──
  const [selectedSnkrdunkCategory, setSelectedSnkrdunkCategory] = useState('all')
  const [snkrdunkSales, setSnkrdunkSales] = useState<any[]>([])
  const [snkrdunkLoading, setSnkrdunkLoading] = useState(false)
  const [snkrdunkScraping, setSnkrdunkScraping] = useState(false)

  // ── Overseas price state ──
  const [overseasLatest, setOverseasLatest] = useState<any | null>(null)

  // ── Initial data fetch ──
  useEffect(() => {
    if (card?.id) {
      fetchPrices()
      fetchSnkrdunkSales()
      fetchPurchaseLinks()
      fetchOverseasLatest()
      setCardImageUrl(card?.image_url || null)
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

  const fetchOverseasLatest = async () => {
    if (!card.pricecharting_id) return
    try {
      const res = await fetch(`/api/overseas-prices?card_id=${card.id}&days=30`)
      const json = await res.json()
      if (json.success && json.data?.length > 0) {
        setOverseasLatest(json.data[json.data.length - 1])
      }
    } catch (err) { console.error('Failed to fetch overseas prices:', err) }
  }

  // ── Actions ──
  const scrapeSnkrdunk = async () => {
    const snkrdunkUrl = saleUrls.find((url: any) =>
      url.site?.name?.toLowerCase().includes('スニダン') || url.site?.name?.toLowerCase().includes('snkrdunk') || url.product_url?.toLowerCase().includes('snkrdunk')
    )
    if (!snkrdunkUrl) { alert('スニダンのURLが設定されていません。'); return }
    setSnkrdunkScraping(true)
    try {
      const res = await fetch('/api/snkrdunk-scrape', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cardId: card.id, url: snkrdunkUrl.product_url }) })
      const data = await res.json()
      if (!data.success) { alert('エラー: ' + data.error); return }
      if (data.jobId) {
        alert(`スクレイピングを開始しました`)
        let attempts = 0
        const pollJob = async (): Promise<boolean> => {
          attempts++
          const statusRes = await fetch(`${process.env.NEXT_PUBLIC_TORECA_SCRAPER_URL}/scrape/status/${data.jobId}`)
          const statusData = await statusRes.json()
          if (statusData.status === 'completed') { alert(`完了: ${statusData.result.count}件`); fetchSnkrdunkSales(); fetchPrices(); return true }
          else if (statusData.status === 'failed') { alert('エラー: ' + (statusData.error || '不明')); return true }
          else if (attempts >= 60) { alert('タイムアウト'); return true }
          await new Promise(resolve => setTimeout(resolve, 2000))
          return pollJob()
        }
        await pollJob()
      } else { alert(`完了: ${data.total}件 (新規: ${data.inserted}件)`); fetchSnkrdunkSales(); fetchPrices() }
    } catch (error: any) { alert('エラー: ' + error.message) } finally { setSnkrdunkScraping(false) }
  }

  const updateAutoScrapeMode = async (saleUrlId: string, mode: string) => {
    try {
      const { error } = await supabase.from('card_sale_urls').update({ auto_scrape_mode: mode }).eq('id', saleUrlId)
      if (error) throw error
      alert('✅ 自動更新モードを変更しました')
      fetchPrices()
    } catch (error: any) { alert('❌ エラー: ' + error.message) }
  }

  const updateScrapeInterval = async (saleUrlId: string, intervalMinutes: number) => {
    try {
      const { error } = await supabase.from('card_sale_urls').update({ auto_scrape_interval_minutes: intervalMinutes }).eq('id', saleUrlId)
      if (error) throw error
      alert(`✅ 更新間隔を${intervalMinutes}分に変更しました`)
      fetchPrices()
    } catch (error: any) { alert('❌ エラー: ' + error.message) }
  }

  const updateCheckInterval = async (saleUrlId: string, intervalMinutes: number) => {
    try {
      const { error } = await supabase.from('card_sale_urls').update({ check_interval: intervalMinutes, next_check_at: new Date(Date.now() + intervalMinutes * 60000).toISOString() }).eq('id', saleUrlId)
      if (error) throw error
      fetchPrices()
    } catch (error: any) { alert('❌ エラー: ' + error.message) }
  }

  const updatePrice = async (saleUrl: any) => {
    setScraping(true)
    try {
      const siteName = saleUrl.site?.name?.toLowerCase() || ''
      let source = null
      if (siteName.includes('スニダン') || siteName.includes('snkrdunk')) source = 'snkrdunk'
      else if (siteName.includes('カードラッシュ') || siteName.includes('cardrush')) source = 'cardrush'
      else if (siteName.includes('トレカキャンプ') || siteName.includes('torecacamp')) source = 'torecacamp'
      const res = await fetch('/api/scrape', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: saleUrl.product_url, source }) })
      const data = await res.json()
      if (data.success && (data.price || data.price === 0)) {
        let stock = null
        if (data.stock !== null && data.stock !== undefined) {
          if (typeof data.stock === 'number') stock = data.stock
          else if (typeof data.stock === 'string') {
            const stockMatch = data.stock.match(/(\d+)/)
            if (stockMatch) stock = parseInt(stockMatch[1], 10)
            else if (data.stock.includes('あり') || data.stock.includes('在庫')) stock = 1
            else if (data.stock.includes('なし') || data.stock.includes('売切')) stock = 0
          }
        }
        if (data.gradePrices && data.gradePrices.length > 0) {
          await supabase.from('sale_prices').insert({ card_id: card.id, site_id: saleUrl.site_id, price: data.price, stock, grade: null })
          for (const gp of data.gradePrices) { await supabase.from('sale_prices').insert({ card_id: card.id, site_id: saleUrl.site_id, price: gp.price, grade: gp.grade }) }
          alert(`更新完了: 全体¥${data.price.toLocaleString()}`)
        } else {
          await supabase.from('sale_prices').insert({ card_id: card.id, site_id: saleUrl.site_id, price: data.priceNumber || data.price, stock })
          alert(`更新完了: ¥${(data.priceNumber || data.price).toLocaleString()}`)
        }
        await supabase.from('card_sale_urls').update({ last_price: data.priceNumber || data.price, last_stock: stock, last_checked_at: new Date().toISOString() }).eq('id', saleUrl.id)
        fetchPrices()
      } else { alert('価格の取得に失敗: ' + (data.error || '不明なエラー')) }
    } catch (err: any) { alert('エラー: ' + err.message) } finally { setScraping(false) }
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
    filteredPurchase.forEach((p: any) => {
      const d = formatDate(p.tweet_time || p.recorded_at || p.created_at); if (!d) return
      const rd = new Date(Math.floor(d.getTime() / 60000) * 60000); const ts = rd.getTime()
      const existing = dataMap.get(ts) || { timestamp: ts, date: rd.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }
      existing[`purchase_${p.condition || (p.is_psa ? 'psa' : 'normal')}`] = p.price
      dataMap.set(ts, existing)
    })
    filteredSale.forEach((p: any) => {
      const d = formatDate(p.recorded_at || p.created_at); if (!d) return
      const rd = new Date(Math.floor(d.getTime() / 60000) * 60000); const ts = rd.getTime()
      const existing = dataMap.get(ts) || { timestamp: ts, date: rd.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) }
      if (p.grade) { existing[`sale_grade_${p.grade}`] = p.price }
      else { const siteId = p.site?.id || 'other'; existing[`price_${siteId}`] = p.price; if (p.stock != null) existing[`stock_${siteId}`] = p.stock }
      dataMap.set(ts, existing)
    })
    return Array.from(dataMap.values()).sort((a, b) => a.timestamp - b.timestamp).slice(-100)
  }, [purchasePrices, salePrices, selectedPeriod])

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

  const hasStockData = useMemo(() => salePrices.some((p: any) => p.stock != null), [salePrices])
  const purchaseConditions = useMemo(() => { const c = new Set<string>(); purchasePrices.forEach((p: any) => c.add(p.condition || (p.is_psa ? 'psa' : 'normal'))); return Array.from(c) }, [purchasePrices])
  const saleGrades = useMemo(() => { const g = new Set<string>(); salePrices.forEach((p: any) => { if (p.grade) g.add(p.grade) }); return Array.from(g).sort((a, b) => (GRADE_SORT_ORDER[a] ?? 999) - (GRADE_SORT_ORDER[b] ?? 999)) }, [salePrices])

  const snkrdunkLatestByGrade = useMemo(() => {
    const result: Record<string, { price: number; stock: number | null; grade: string; date: string }> = {}
    for (const p of salePrices as any[]) {
      const siteName = p.site?.name?.toLowerCase() || ''
      if (!siteName.includes('スニダン') && !siteName.includes('snkrdunk')) continue
      if (!p.grade) continue
      if (!result[p.grade]) result[p.grade] = { price: p.price, stock: p.stock, grade: p.grade, date: p.created_at }
    }
    return Object.values(result).sort((a, b) => (GRADE_SORT_ORDER[a.grade] ?? 999) - (GRADE_SORT_ORDER[b.grade] ?? 999))
  }, [salePrices])

  // ── Price diffs for header badge ──
  const priceDiffs = useMemo(() => {
    if (!overseasLatest) return []
    const diffs: { label: string; displayLabel: string; diffJpy: number; diffPercent: number }[] = []
    const normalP = latestPurchaseByLabel['normal']
    const looseJpy = overseasLatest.loose_price_jpy
    if (normalP && looseJpy) {
      const diff = normalP.price - looseJpy
      diffs.push({ label: 'normal', displayLabel: '素体', diffJpy: diff, diffPercent: Math.round((diff / looseJpy) * 1000) / 10 })
    }
    const psa10P = latestPurchaseByLabel['psa10']
    const gradedJpy = overseasLatest.graded_price_jpy
    if (psa10P && gradedJpy) {
      const diff = psa10P.price - gradedJpy
      diffs.push({ label: 'psa10', displayLabel: 'PSA10', diffJpy: diff, diffPercent: Math.round((diff / gradedJpy) * 1000) / 10 })
    }
    return diffs
  }, [overseasLatest, latestPurchaseByLabel])

  // ── Site visibility toggles ──
  const toggleSitePrice = (siteId: string) => setVisibleSites(prev => ({ ...prev, [siteId]: { ...prev[siteId], price: !prev[siteId]?.price } }))
  const toggleSiteStock = (siteId: string) => setVisibleSites(prev => ({ ...prev, [siteId]: { ...prev[siteId], stock: !prev[siteId]?.stock } }))
  const toggleSiteAll = (siteId: string) => setVisibleSites(prev => { const c = prev[siteId] || { price: true, stock: true }; const allOn = c.price !== false && c.stock !== false; return { ...prev, [siteId]: { price: !allOn, stock: !allOn } } })
  const isSiteHidden = (siteId: string) => { const v = visibleSites[siteId]; return v?.price === false && v?.stock === false }

  // ── Render ──
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-2xl w-[90vw] max-w-[1400px] max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* ヘッダー */}
        <CardDetailHeader
          card={card}
          cardImageUrl={cardImageUrl}
          latestPurchase={latestPurchase}
          latestPurchaseByLabel={latestPurchaseByLabel}
          latestPrices={latestPrices}
          priceDiffs={priceDiffs}
          onClose={onClose}
          onEdit={() => setShowEditForm(true)}
          onUpdated={onUpdated}
          onImageChanged={setCardImageUrl}
        />

        {/* コンテンツ */}
        <div className="p-6 overflow-y-auto flex-1">
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
                  showPurchase={showPurchase}
                  onShowPurchaseChange={setShowPurchase}
                  siteList={siteList}
                  visibleSites={visibleSites}
                  onToggleSitePrice={toggleSitePrice}
                  onToggleSiteStock={toggleSiteStock}
                  onToggleSiteAll={toggleSiteAll}
                  isSiteHidden={isSiteHidden}
                  purchaseConditions={purchaseConditions}
                  saleGrades={saleGrades}
                  hasStockData={hasStockData}
                  overseasLatest={overseasLatest}
                  latestPurchaseByLabel={latestPurchaseByLabel}
                  snkrdunkLatestByGrade={snkrdunkLatestByGrade}
                />
              )}

              {/* スニダン売買タブ */}
              {chartTab === 'snkrdunk' && (
                <SnkrdunkTab
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
