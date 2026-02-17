'use client'

import { useState, useEffect, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { RefreshCw } from 'lucide-react'
import {
  SITE_COLORS, PURCHASE_CONDITION_COLORS, SALE_GRADE_COLORS,
  OVERSEAS_LINE_COLORS, DAILY_AVG_COLORS,
  PERIOD_OPTIONS,
} from './constants'

interface PriceChartTabProps {
  card: any
  chartData: any[]
  selectedPeriod: number | null
  onPeriodChange: (days: number | null) => void
  showPurchase: boolean
  onShowPurchaseChange: (show: boolean) => void
  siteList: any[]
  visibleSites: Record<string, { price: boolean; stock: boolean }>
  onToggleSitePrice: (siteId: string) => void
  onToggleSiteStock: (siteId: string) => void
  onToggleSiteAll: (siteId: string) => void
  isSiteHidden: (siteId: string) => boolean
  purchaseConditions: string[]
  saleGrades: string[]
  hasGradeStockData?: boolean
  onRefreshOverseas?: () => void
}

// カスタムドット（ダイヤモンド型）
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
    <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl px-4 py-3 text-sm" style={{ minWidth: 180 }}>
      <p className="font-medium text-slate-300 mb-2 text-xs border-b border-slate-700 pb-1.5">{label}</p>
      <div className="space-y-1">
        {validEntries.map((entry: any, index: number) => {
          const isStock = entry.dataKey.startsWith('stock')
          return (
            <div key={index} className="flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ backgroundColor: entry.color }} />
                <span className="text-slate-400 text-xs">{entry.name}</span>
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

export default function PriceChartTab({
  card, chartData, selectedPeriod, onPeriodChange,
  showPurchase, onShowPurchaseChange,
  siteList, visibleSites, onToggleSitePrice, onToggleSiteStock, onToggleSiteAll, isSiteHidden,
  purchaseConditions, saleGrades, hasGradeStockData,
  onRefreshOverseas,
}: PriceChartTabProps) {
  // localStorage からトグル復元
  const loadSetting = (key: string, fallback: any) => {
    if (typeof window === 'undefined') return fallback
    try { const s = JSON.parse(localStorage.getItem('toreca-chart-settings') || '{}'); return s[key] ?? fallback } catch { return fallback }
  }
  const saveSetting = useCallback((key: string, value: any) => {
    try { const s = JSON.parse(localStorage.getItem('toreca-chart-settings') || '{}'); s[key] = value; localStorage.setItem('toreca-chart-settings', JSON.stringify(s)) } catch {}
  }, [])

  const [showOverseasLoose, setShowOverseasLoose] = useState(() => loadSetting('showOverseasLoose', true))
  const [showOverseasGraded, setShowOverseasGraded] = useState(() => loadSetting('showOverseasGraded', true))
  const [showDailyTrade, setShowDailyTrade] = useState(() => loadSetting('showDailyTrade', true))
  const [overseasUpdating, setOverseasUpdating] = useState(false)
  const [visibleGrades, setVisibleGrades] = useState<Record<string, { price: boolean; stock: boolean }>>(() => loadSetting('visibleGrades', {}))

  // トグル変更時に保存
  useEffect(() => { saveSetting('showOverseasLoose', showOverseasLoose) }, [showOverseasLoose, saveSetting])
  useEffect(() => { saveSetting('showOverseasGraded', showOverseasGraded) }, [showOverseasGraded, saveSetting])
  useEffect(() => { saveSetting('showDailyTrade', showDailyTrade) }, [showDailyTrade, saveSetting])
  useEffect(() => { saveSetting('visibleGrades', visibleGrades) }, [visibleGrades, saveSetting])

  const hasOverseasData = chartData.some(d => d.overseas_loose || d.overseas_graded)
  const hasDailyTradeData = chartData.some(d => d.daily_trade_avg)

  // スニダン判定（グレード別で表示するのでサイト別からは除外）
  const isSnkrdunkSite = (site: any) => {
    const n = site.name?.toLowerCase() || ''
    return n.includes('スニーカーダンク') || n.includes('スニダン') || n.includes('snkrdunk')
  }
  const nonSnkrdunkSites = siteList.filter(s => !isSnkrdunkSite(s))
  const showStockAxis = nonSnkrdunkSites.some(s => visibleSites[s.id]?.stock !== false) || hasGradeStockData

  const isGradePriceVisible = (grade: string) => visibleGrades[grade]?.price !== false
  const isGradeStockVisible = (grade: string) => visibleGrades[grade]?.stock !== false
  const toggleGradePrice = (grade: string) => setVisibleGrades(prev => ({ ...prev, [grade]: { price: !(prev[grade]?.price !== false), stock: prev[grade]?.stock ?? true } }))
  const toggleGradeStock = (grade: string) => setVisibleGrades(prev => ({ ...prev, [grade]: { price: prev[grade]?.price ?? true, stock: !(prev[grade]?.stock !== false) } }))
  const toggleGradeAll = (grade: string) => setVisibleGrades(prev => { const c = prev[grade] || { price: true, stock: true }; const allOn = c.price !== false || c.stock !== false; return { ...prev, [grade]: { price: !allOn, stock: !allOn } } })

  // 海外価格手動更新
  const handleOverseasUpdate = async () => {
    if (!card.pricecharting_id) return
    setOverseasUpdating(true)
    try {
      const res = await fetch('/api/overseas-prices/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_id: card.id, pricecharting_id: card.pricecharting_id }),
      })
      const json = await res.json()
      if (json.success) {
        const d = json.data
        const parts = []
        if (d.looseUsd != null) parts.push(`素体: $${(d.looseUsd / 100).toFixed(2)}`)
        if (d.psa10Usd != null) parts.push(`PSA10: $${(d.psa10Usd / 100).toFixed(2)}`)
        alert(`更新完了: ${parts.join(' / ')}`)
        onRefreshOverseas?.()
      } else {
        alert('更新失敗: ' + (json.error || '不明なエラー'))
      }
    } catch (err: any) {
      alert('エラー: ' + err.message)
    } finally {
      setOverseasUpdating(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* 期間フィルタ */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-slate-600">期間:</span>
        {PERIOD_OPTIONS.map(option => (
          <button
            key={option.label}
            onClick={() => onPeriodChange(option.days)}
            className={`px-3 py-1 rounded-lg text-sm transition-colors ${selectedPeriod === option.days
              ? 'bg-blue-500 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* グラフ表示設定 */}
      <div className="bg-slate-50 rounded-xl p-4 space-y-3">
        <p className="text-sm font-medium text-slate-700">グラフ表示設定</p>

        {/* 買取 */}
        <div>
          <p className="text-[11px] text-slate-400 font-medium mb-1.5">買取</p>
          <div className="flex flex-wrap gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition-colors ${showPurchase ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-slate-200 text-slate-400'}`}>
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <span className="cursor-pointer select-none" onClick={() => onShowPurchaseChange(!showPurchase)}>買取価格</span>
              <input type="checkbox" checked={showPurchase} onChange={() => onShowPurchaseChange(!showPurchase)} className="w-3.5 h-3.5 accent-blue-500 cursor-pointer" />
            </div>
          </div>
        </div>

        {/* サイト別（スニダン以外） */}
        {nonSnkrdunkSites.length > 0 && (
          <div>
            <p className="text-[11px] text-slate-400 font-medium mb-1.5">販売サイト</p>
            <div className="flex flex-wrap gap-2">
              {nonSnkrdunkSites.map((site) => {
                const colorIndex = siteList.findIndex(s => s.id === site.id)
                const color = SITE_COLORS[colorIndex % SITE_COLORS.length]
                const v = visibleSites[site.id] || { price: true, stock: true }
                return (
                  <div key={site.id} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border bg-white border-slate-200">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }}></span>
                    <span className="text-slate-600 cursor-pointer select-none" onClick={() => onToggleSiteAll(site.id)}>{site.name}</span>
                    <label className="flex items-center gap-0.5 cursor-pointer">
                      <span className="text-xs text-slate-500">価格</span>
                      <input type="checkbox" checked={v.price !== false} onChange={() => onToggleSitePrice(site.id)} className="w-3.5 h-3.5 accent-green-500" />
                    </label>
                    <label className="flex items-center gap-0.5 cursor-pointer">
                      <span className="text-xs text-slate-500">在庫</span>
                      <input type="checkbox" checked={v.stock !== false} onChange={() => onToggleSiteStock(site.id)} className="w-3.5 h-3.5 accent-green-500" />
                    </label>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* スニーカーダンク（グレード別） */}
        {saleGrades.length > 0 && (
          <div>
            <p className="text-[11px] text-slate-400 font-medium mb-1.5">スニーカーダンク</p>
            <div className="flex flex-wrap gap-2">
              {saleGrades.map((grade) => {
                const config = SALE_GRADE_COLORS[grade] || { color: '#6b7280', label: grade }
                return (
                  <div key={grade} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border bg-white border-slate-200">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: config.color }}></span>
                    <span className="text-slate-600 cursor-pointer select-none" onClick={() => toggleGradeAll(grade)}>{grade}</span>
                    <label className="flex items-center gap-0.5 cursor-pointer">
                      <span className="text-xs text-slate-500">価格</span>
                      <input type="checkbox" checked={isGradePriceVisible(grade)} onChange={() => toggleGradePrice(grade)} className="w-3.5 h-3.5 accent-purple-500" />
                    </label>
                    {hasGradeStockData && (
                      <label className="flex items-center gap-0.5 cursor-pointer">
                        <span className="text-xs text-slate-500">在庫</span>
                        <input type="checkbox" checked={isGradeStockVisible(grade)} onChange={() => toggleGradeStock(grade)} className="w-3.5 h-3.5 accent-purple-500" />
                      </label>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 海外・その他 */}
        {(card.pricecharting_id || hasDailyTradeData) && (
          <div>
            <p className="text-[11px] text-slate-400 font-medium mb-1.5">海外・その他</p>
            <div className="flex flex-wrap gap-2 items-center">
              {card.pricecharting_id && (
                <>
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition-colors ${showOverseasLoose ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200 text-slate-400'}`}>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: OVERSEAS_LINE_COLORS.loose.color }}></span>
                    <span className="cursor-pointer select-none" onClick={() => setShowOverseasLoose(!showOverseasLoose)}>{OVERSEAS_LINE_COLORS.loose.label}</span>
                    <input type="checkbox" checked={showOverseasLoose} onChange={() => setShowOverseasLoose(!showOverseasLoose)} className="w-3.5 h-3.5 accent-indigo-500 cursor-pointer" />
                  </div>
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition-colors ${showOverseasGraded ? 'bg-violet-50 border-violet-200 text-violet-700' : 'bg-white border-slate-200 text-slate-400'}`}>
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: OVERSEAS_LINE_COLORS.graded.color }}></span>
                    <span className="cursor-pointer select-none" onClick={() => setShowOverseasGraded(!showOverseasGraded)}>{OVERSEAS_LINE_COLORS.graded.label}</span>
                    <input type="checkbox" checked={showOverseasGraded} onChange={() => setShowOverseasGraded(!showOverseasGraded)} className="w-3.5 h-3.5 accent-violet-500 cursor-pointer" />
                  </div>
                  <button
                    onClick={handleOverseasUpdate}
                    disabled={overseasUpdating}
                    className="px-2.5 py-1.5 bg-indigo-500 text-white rounded-lg text-xs hover:bg-indigo-600 disabled:opacity-50 flex items-center gap-1"
                    title="PriceChartingから最新価格を取得"
                  >
                    <RefreshCw size={12} className={overseasUpdating ? 'animate-spin' : ''} />
                    海外更新
                  </button>
                </>
              )}
              {hasDailyTradeData && (
                <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition-colors ${showDailyTrade ? 'bg-orange-50 border-orange-200 text-orange-700' : 'bg-white border-slate-200 text-slate-400'}`}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: DAILY_AVG_COLORS.trade.color }}></span>
                  <span className="cursor-pointer select-none" onClick={() => setShowDailyTrade(!showDailyTrade)}>{DAILY_AVG_COLORS.trade.label}</span>
                  <input type="checkbox" checked={showDailyTrade} onChange={() => setShowDailyTrade(!showDailyTrade)} className="w-3.5 h-3.5 accent-orange-500 cursor-pointer" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 統合チャート */}
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
              {showStockAxis && (
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

              {/* 買取価格線 */}
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

              {/* サイト別価格線（スニダン以外） */}
              {nonSnkrdunkSites
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

              {/* グレード別最安値線 */}
              {saleGrades.filter(grade => isGradePriceVisible(grade)).map((grade) => {
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

              {/* サイト別在庫線（スニダン以外） */}
              {nonSnkrdunkSites
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

              {/* グレード別在庫線 */}
              {hasGradeStockData && saleGrades.filter(grade => isGradeStockVisible(grade)).map((grade) => {
                const config = SALE_GRADE_COLORS[grade] || { color: '#6b7280', label: grade }
                return (
                  <Line
                    key={`stock_grade_${grade}`}
                    yAxisId="stock"
                    type="stepAfter"
                    dataKey={`stock_grade_${grade}`}
                    stroke={config.color}
                    strokeWidth={1.5}
                    strokeDasharray="4 4"
                    name={`${config.label.replace('最安', '')}在庫`}
                    dot={<DiamondDot stroke={config.color} />}
                    connectNulls
                  />
                )
              })}

              {/* 海外素体線 */}
              {showOverseasLoose && hasOverseasData && (
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="overseas_loose"
                  stroke={OVERSEAS_LINE_COLORS.loose.color}
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  name={OVERSEAS_LINE_COLORS.loose.label}
                  dot={false}
                  connectNulls
                />
              )}

              {/* 海外PSA10線 */}
              {showOverseasGraded && hasOverseasData && (
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="overseas_graded"
                  stroke={OVERSEAS_LINE_COLORS.graded.color}
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  name={OVERSEAS_LINE_COLORS.graded.label}
                  dot={false}
                  connectNulls
                />
              )}

              {/* 売買日次平均線 */}
              {showDailyTrade && hasDailyTradeData && (
                <Line
                  yAxisId="price"
                  type="monotone"
                  dataKey="daily_trade_avg"
                  stroke={DAILY_AVG_COLORS.trade.color}
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  name={DAILY_AVG_COLORS.trade.label}
                  dot={false}
                  connectNulls
                />
              )}
            </LineChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-2 text-xs text-slate-400">
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-slate-500 inline-block rounded"></span> 価格（左軸）</span>
            {showStockAxis && (
              <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-slate-500 inline-block rounded" style={{ borderTop: '2px dashed #9ca3af' }}></span> 在庫（右軸）</span>
            )}
          </div>
        </>
      ) : (
        <div className="bg-slate-50 rounded-xl p-8 text-center text-slate-500">
          <p>価格データがまだありません</p>
        </div>
      )}

    </div>
  )
}
