'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import OverseasPriceChart from '@/components/chart/OverseasPriceChart'
import MarketChart from '@/components/MarketChart'
import OverseasComparisonSection from './OverseasComparisonSection'
import {
  SITE_COLORS, PURCHASE_CONDITION_COLORS, SALE_GRADE_COLORS,
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
  hasStockData: boolean
  // 海外比較用
  overseasLatest: any | null
  latestPurchaseByLabel: Record<string, { price: number; label: string; shopName: string; date: string }>
  snkrdunkLatestByGrade: { price: number; stock: number | null; grade: string; date: string }[]
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
  purchaseConditions, saleGrades, hasStockData,
  overseasLatest, latestPurchaseByLabel, snkrdunkLatestByGrade,
}: PriceChartTabProps) {
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
      <div className="bg-slate-50 rounded-xl p-4">
        <p className="text-sm font-medium text-slate-700 mb-3">グラフ表示設定</p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => onShowPurchaseChange(!showPurchase)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border transition-colors ${showPurchase
              ? 'bg-blue-100 border-blue-300 text-blue-700'
              : 'bg-white border-slate-200 text-slate-400'
            }`}
          >
            <span className={`w-3 h-3 rounded-full ${showPurchase ? 'bg-blue-500' : 'bg-slate-300'}`}></span>
            買取価格
            <input
              type="checkbox"
              checked={showPurchase}
              onChange={() => onShowPurchaseChange(!showPurchase)}
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
                  ? 'bg-white border-slate-200 text-slate-400'
                  : 'bg-green-50 border-green-200 text-green-700'
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: hidden ? '#d1d5db' : color }}
                ></span>
                <span className="cursor-pointer" onClick={() => onToggleSiteAll(site.id)}>
                  {site.name}
                </span>
                <span className="flex items-center gap-1 ml-1 text-xs">
                  <label className="flex items-center gap-0.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={v.price !== false}
                      onChange={() => onToggleSitePrice(site.id)}
                      className="w-3 h-3 accent-green-500"
                    />
                    <span>●価格</span>
                  </label>
                  <label className="flex items-center gap-0.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={v.stock !== false}
                      onChange={() => onToggleSiteStock(site.id)}
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
          <div className="flex justify-center gap-6 mt-2 text-xs text-slate-400">
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-slate-500 inline-block rounded"></span> 価格（左軸）</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-slate-500 inline-block rounded" style={{ borderTop: '2px dashed #9ca3af' }}></span> 在庫（右軸）</span>
          </div>
        </>
      ) : (
        <div className="bg-slate-50 rounded-xl p-8 text-center text-slate-500">
          <p>価格データがまだありません</p>
        </div>
      )}

      {/* 海外 vs 国内 価格比較ダッシュボード */}
      {card.pricecharting_id && (
        <OverseasComparisonSection
          overseasLatest={overseasLatest}
          latestPurchaseByLabel={latestPurchaseByLabel}
          snkrdunkLatestByGrade={snkrdunkLatestByGrade}
        />
      )}

      {/* 海外価格チャート */}
      {card.pricecharting_id && (
        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="bg-gradient-to-r from-indigo-50 via-blue-50 to-cyan-50 px-5 py-3 border-b border-blue-100/60">
            <h4 className="text-sm font-semibold text-slate-800 tracking-tight">🌐 海外価格推移（PriceCharting）</h4>
          </div>
          <div className="p-5">
            <OverseasPriceChart cardId={card.id} pricechartingId={card.pricecharting_id} />
          </div>
        </div>
      )}

      {/* 日次平均推移（MarketChart統合） */}
      <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="bg-gradient-to-r from-slate-50 via-gray-50 to-zinc-50 px-5 py-3 border-b border-slate-100/60">
          <h4 className="text-sm font-semibold text-slate-800 tracking-tight">📊 日次平均推移</h4>
          <p className="text-[11px] text-slate-400 mt-0.5">売買・販売・買取の日次平均価格</p>
        </div>
        <div className="p-5">
          <MarketChart cardId={card.id} />
        </div>
      </div>
    </div>
  )
}
