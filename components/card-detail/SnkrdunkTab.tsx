'use client'

import { useState, useEffect, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { RefreshCw, TrendingUp, AlertTriangle } from 'lucide-react'
import {
  SNKRDUNK_GRADE_COLORS, PURCHASE_CONDITION_COLORS,
  GRADE_SORT_ORDER, isBoxGrade, SINGLE_CATEGORIES,
  formatRelativeTime,
} from './constants'

// チャート条件のカラー定義
const CHART_CONDITION_COLORS: Record<string, string> = {
  'すべての状態': '#6366f1', // indigo
  'A': '#10b981',
  'B': '#f59e0b',
  'C': '#ef4444',
  'D': '#dc2626',
  'PSA10': '#8b5cf6',
  'PSA9': '#06b6d4',
  'PSA8以下': '#64748b',
  'すべて': '#6366f1',
  '1個': '#3b82f6',
  '2個': '#06b6d4',
}

interface SnkrdunkTabProps {
  cardId: string
  snkrdunkSales: any[]
  snkrdunkLoading: boolean
  snkrdunkScraping: boolean
  selectedSnkrdunkCategory: string
  onCategoryChange: (cat: string) => void
  onScrape: () => void
  purchasePrices: any[]
  salePrices: any[]
  latestPurchaseByLabel: Record<string, { price: number; label: string; shopName: string; date: string }>
  snkrdunkLatestByGrade: { price: number; stock: number | null; grade: string; date: string }[]
  formatDate: (dateStr: string | null) => Date | null
}

// チャートカスタムツールチップ
const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null
  const d = new Date(label)
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl px-4 py-3 text-sm" style={{ minWidth: 160 }}>
      <p className="text-slate-400 text-xs mb-2">
        {d.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}
      </p>
      {payload.filter((e: any) => e.value != null).map((entry: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-slate-300 text-xs">{entry.name}</span>
          </span>
          <span className="font-semibold text-white text-xs tabular-nums">
            ¥{Number(entry.value).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function SnkrdunkTab({
  cardId,
  snkrdunkSales, snkrdunkLoading, snkrdunkScraping,
  selectedSnkrdunkCategory, onCategoryChange, onScrape,
  purchasePrices, salePrices,
  latestPurchaseByLabel, snkrdunkLatestByGrade,
  formatDate,
}: SnkrdunkTabProps) {
  // ── チャートデータ state ──
  const [chartData, setChartData] = useState<Record<string, any[]>>({})
  const [chartLoading, setChartLoading] = useState(false)
  const [chartFetching, setChartFetching] = useState(false)
  const [chartConditions, setChartConditions] = useState<string[]>([])
  const [visibleConditions, setVisibleConditions] = useState<Set<string>>(new Set(['すべての状態']))
  const [chartError, setChartError] = useState<string | null>(null)
  const [anomalyCount, setAnomalyCount] = useState(0)

  // チャートデータ読み込み
  const fetchChartData = useCallback(async () => {
    if (!cardId) return
    setChartLoading(true)
    try {
      const res = await fetch(`/api/snkrdunk-chart?cardId=${cardId}`)
      const json = await res.json()
      if (json.success && json.totalPoints > 0) {
        setChartData(json.data)
        setChartConditions(Object.keys(json.data))
        // 異常値カウント
        let anomalies = 0
        for (const points of Object.values(json.data) as any[][]) {
          anomalies += points.filter((p: any) => p.isAnomaly).length
        }
        setAnomalyCount(anomalies)
        // 初回: すべての状態 or 最初の条件を表示
        if (json.data['すべての状態']) {
          setVisibleConditions(new Set(['すべての状態']))
        } else if (json.data['すべて']) {
          setVisibleConditions(new Set(['すべて']))
        } else {
          const first = Object.keys(json.data)[0]
          if (first) setVisibleConditions(new Set([first]))
        }
      }
    } catch (e: any) {
      console.error('Failed to fetch chart data:', e)
    } finally {
      setChartLoading(false)
    }
  }, [cardId])

  // 初回取得（スニダンからAPIでフェッチ → DB保存）
  const fetchFromSnkrdunk = useCallback(async () => {
    if (!cardId) return
    setChartFetching(true)
    setChartError(null)
    try {
      const res = await fetch('/api/snkrdunk-chart', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId }),
      })
      const json = await res.json()
      if (!json.success) {
        setChartError(json.error)
        return
      }
      // 取得後にDBから再読み込み
      await fetchChartData()
    } catch (e: any) {
      setChartError(e.message)
    } finally {
      setChartFetching(false)
    }
  }, [cardId, fetchChartData])

  // マウント時にDBからチャートデータを読み込み
  useEffect(() => {
    fetchChartData()
  }, [fetchChartData])

  // 条件の表示切替
  const toggleCondition = (cond: string) => {
    setVisibleConditions(prev => {
      const next = new Set(prev)
      if (next.has(cond)) {
        next.delete(cond)
      } else {
        next.add(cond)
      }
      return next
    })
  }

  // Recharts用データを構築
  const rechartsData = (() => {
    const dataMap = new Map<number, any>()
    for (const cond of visibleConditions) {
      const points = chartData[cond] || []
      for (const p of points) {
        const ts = new Date(p.date).getTime()
        const existing = dataMap.get(ts) || { timestamp: ts }
        existing[cond] = p.priceCleaned
        dataMap.set(ts, existing)
      }
    }
    return Array.from(dataMap.values()).sort((a, b) => a.timestamp - b.timestamp)
  })()

  return (
    <div className="space-y-5">
      {/* ── チャートセクション ── */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-indigo-50 px-4 py-3 border-b border-indigo-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h4 className="font-bold text-sm text-indigo-800">
                <TrendingUp size={14} className="inline mr-1" />
                スニダン価格推移
              </h4>
              {anomalyCount > 0 && (
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-xs">
                  <AlertTriangle size={10} />
                  {anomalyCount}件補正
                </span>
              )}
            </div>
            <button
              onClick={fetchFromSnkrdunk}
              disabled={chartFetching}
              className="px-2.5 py-1 bg-indigo-500 text-white rounded-lg text-xs hover:bg-indigo-600 disabled:opacity-50 flex items-center gap-1 shadow-sm transition-colors"
            >
              {chartFetching ? <RefreshCw size={11} className="animate-spin" /> : <RefreshCw size={11} />}
              {chartConditions.length === 0 ? 'データ取得' : '更新'}
            </button>
          </div>
        </div>

        <div className="p-3">
          {chartLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="animate-spin text-indigo-500" size={24} />
            </div>
          ) : chartFetching ? (
            <div className="flex flex-col items-center justify-center py-12 text-indigo-500">
              <RefreshCw className="animate-spin mb-2" size={24} />
              <p className="text-sm">スニダンからデータを取得中...</p>
              <p className="text-xs text-slate-400 mt-1">条件別に取得するため少し時間がかかります</p>
            </div>
          ) : chartConditions.length === 0 ? (
            <div className="bg-slate-50 rounded-xl p-8 text-center">
              <p className="text-slate-500 text-sm mb-3">チャートデータがありません</p>
              <button
                onClick={fetchFromSnkrdunk}
                className="px-4 py-2 bg-indigo-500 text-white rounded-lg text-sm hover:bg-indigo-600 transition-colors"
              >
                スニダンから価格データを取得
              </button>
              {chartError && (
                <p className="text-red-500 text-xs mt-2">{chartError}</p>
              )}
            </div>
          ) : (
            <>
              {/* 条件選択ボタン */}
              <div className="flex flex-wrap gap-1 mb-3">
                {chartConditions.map(cond => {
                  const color = CHART_CONDITION_COLORS[cond] || '#6b7280'
                  const isActive = visibleConditions.has(cond)
                  const count = chartData[cond]?.length || 0
                  return (
                    <button
                      key={cond}
                      onClick={() => toggleCondition(cond)}
                      className={`px-2 py-0.5 rounded-lg text-xs font-medium transition-colors ${
                        isActive
                          ? 'text-white shadow-sm'
                          : 'bg-slate-100 text-slate-400 hover:bg-slate-200'
                      }`}
                      style={isActive ? { backgroundColor: color } : undefined}
                    >
                      {cond} ({count})
                    </button>
                  )
                })}
              </div>

              {/* チャート */}
              {rechartsData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={rechartsData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="timestamp"
                      type="number"
                      domain={['dataMin', 'dataMax']}
                      tickFormatter={(ts) => {
                        const d = new Date(ts)
                        return `${d.getMonth() + 1}/${d.getDate()}`
                      }}
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      scale="time"
                    />
                    <YAxis
                      tickFormatter={(v) => v >= 10000 ? `${(v / 10000).toFixed(1)}万` : `¥${v.toLocaleString()}`}
                      tick={{ fontSize: 11, fill: '#94a3b8' }}
                      width={55}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    {[...visibleConditions].map(cond => (
                      <Line
                        key={cond}
                        type="monotone"
                        dataKey={cond}
                        name={cond}
                        stroke={CHART_CONDITION_COLORS[cond] || '#6b7280'}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <p className="text-center text-slate-400 text-sm py-8">
                  条件を選択してください
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── 3カラム: 売買履歴 + 買取 + 販売中最安値 ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {/* ── カラム1: スニダン売買例歴 ── */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-purple-50 px-4 py-3 border-b border-purple-100">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-purple-800">🔮 スニダン売買例歴</h4>
            <button
              onClick={onScrape}
              disabled={snkrdunkScraping}
              className="px-2.5 py-1 bg-purple-500 text-white rounded-lg text-xs hover:bg-purple-600 disabled:opacity-50 flex items-center gap-1 shadow-sm transition-colors"
            >
              {snkrdunkScraping ? <RefreshCw size={11} className="animate-spin" /> : <RefreshCw size={11} />}
              更新
            </button>
          </div>
          {snkrdunkSales.length > 0 && (
            <p className="text-xs text-purple-500 mt-1">
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
                      onClick={() => onCategoryChange(cat.key)}
                      className={`px-2 py-0.5 rounded-lg text-xs font-medium transition-colors ${
                        selectedSnkrdunkCategory === cat.key
                          ? 'bg-purple-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
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
                <div className="bg-slate-50 rounded-xl p-6 text-center text-slate-400 text-sm">
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
                    <p className="text-xs text-purple-500 font-medium">最新</p>
                    <p className="text-xs font-bold text-purple-700">¥{latestPrice.toLocaleString()}</p>
                  </div>
                  <div className="bg-gradient-to-b from-slate-50 to-slate-100/50 rounded-lg p-2 text-center">
                    <p className="text-xs text-slate-500 font-medium">平均</p>
                    <p className="text-xs font-bold text-slate-700">¥{avg.toLocaleString()}</p>
                  </div>
                  <div className="bg-gradient-to-b from-blue-50 to-blue-100/50 rounded-lg p-2 text-center">
                    <p className="text-xs text-blue-500 font-medium">最安</p>
                    <p className="text-xs font-bold text-blue-700">¥{min.toLocaleString()}</p>
                  </div>
                </div>

                <div className="max-h-[380px] overflow-auto rounded-lg border border-slate-100">
                  <table className="w-full text-sm">
                    <thead className="bg-purple-50/80 sticky top-0 z-10">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-medium text-purple-600">日時</th>
                        <th className="text-center px-2 py-2 text-xs font-medium text-purple-600">グレード</th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-purple-600">価格</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filtered.map((sale: any, i: number) => {
                        const date = new Date(sale.sold_at)
                        const gradeColor = SNKRDUNK_GRADE_COLORS[sale.grade] || '#6b7280'
                        return (
                          <tr key={i} className="hover:bg-purple-50/30 transition-colors">
                            <td className="px-3 py-2 text-xs text-slate-500">
                              {date.toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-2 py-2 text-center">
                              <span
                                className="px-1.5 py-0.5 rounded text-xs font-medium"
                                style={{ backgroundColor: `${gradeColor}12`, color: gradeColor }}
                              >
                                {sale.grade}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right font-semibold text-slate-800 text-xs tabular-nums">
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

      {/* ── カラム2: 買取（最高額店舗） ── */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-blue-50 px-4 py-3 border-b border-blue-100">
          <h4 className="font-bold text-sm text-blue-800">🏪 買取（最高額店舗）</h4>
          {purchasePrices.length > 0 && (
            <p className="text-xs text-blue-500 mt-1">
              更新: {formatRelativeTime((purchasePrices as any[])[0]?.created_at)}
            </p>
          )}
        </div>

        <div className="p-3 space-y-3">
          {Object.keys(latestPurchaseByLabel).length > 0 ? (
            <div className="space-y-2">
              {Object.entries(latestPurchaseByLabel)
                .sort((a, b) => b[1].price - a[1].price)
                .map(([key, data]) => {
                  const config = PURCHASE_CONDITION_COLORS[key] || { color: '#3b82f6', label: data.label }
                  return (
                    <div key={key} className="bg-gradient-to-r from-slate-50 to-white border border-slate-100 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className="px-2 py-0.5 rounded-md text-xs font-semibold"
                          style={{ backgroundColor: `${config.color}12`, color: config.color }}
                        >
                          {data.label}
                        </span>
                        <span className="font-bold text-slate-900 text-base tabular-nums">¥{data.price.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>{data.shopName}</span>
                        <span>{formatRelativeTime(data.date)}</span>
                      </div>
                    </div>
                  )
                })}
            </div>
          ) : (
            <div className="bg-slate-50 rounded-xl p-6 text-center text-slate-400 text-sm">
              買取データなし
            </div>
          )}

          {purchasePrices.length > 0 && (
            <div className="max-h-[320px] overflow-auto rounded-lg border border-slate-100">
              <table className="w-full text-sm">
                <thead className="bg-blue-50/80 sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-medium text-blue-600">店舗</th>
                    <th className="text-center px-2 py-2 text-xs font-medium text-blue-600">状態</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-blue-600">価格</th>
                    <th className="text-right px-2 py-2 text-xs font-medium text-blue-600">日時</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(purchasePrices as any[]).slice(0, 30).map((p: any, i) => {
                    const rawLabel = (p.link as any)?.label || ''
                    let condKey = 'normal'
                    if (rawLabel.includes('PSA10') || rawLabel.includes('psa10')) condKey = 'psa10'
                    else if (rawLabel.includes('未開封')) condKey = 'sealed'
                    else if (rawLabel.includes('開封')) condKey = 'opened'
                    const condConfig = PURCHASE_CONDITION_COLORS[condKey] || { color: '#3b82f6', label: condKey }
                    const date = formatDate(p.tweet_time || p.recorded_at || p.created_at)
                    return (
                      <tr key={i} className="hover:bg-blue-50/30 transition-colors">
                        <td className="px-3 py-2 text-xs text-slate-600">{p.shop?.name || '-'}</td>
                        <td className="px-2 py-2 text-center">
                          <span
                            className="px-1.5 py-0.5 rounded text-xs font-medium"
                            style={{ backgroundColor: `${condConfig.color}15`, color: condConfig.color }}
                          >
                            {condConfig.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-800 text-xs tabular-nums">
                          ¥{p.price.toLocaleString()}
                        </td>
                        <td className="px-2 py-2 text-right text-xs text-slate-400">
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
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="bg-green-50 px-4 py-3 border-b border-green-100">
          <h4 className="font-bold text-sm text-green-800">🛒 スニダン販売中最安値</h4>
          {snkrdunkLatestByGrade.length > 0 && (
            <p className="text-xs text-green-500 mt-1">
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
                  <div key={item.grade} className="bg-gradient-to-r from-slate-50 to-white border border-slate-100 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className="px-2 py-0.5 rounded-md text-xs font-semibold"
                        style={{ backgroundColor: `${gradeColor}12`, color: gradeColor }}
                      >
                        {item.grade}
                      </span>
                      <div className="text-right">
                        <span className="font-bold text-slate-900 text-base tabular-nums">¥{item.price.toLocaleString()}</span>
                        {item.stock !== null && (
                          <span className="text-xs text-slate-400 ml-1.5">({item.stock}件)</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right text-xs text-slate-400">
                      {formatRelativeTime(item.date)}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="bg-slate-50 rounded-xl p-6 text-center text-slate-400 text-sm">
              販売中データなし
            </div>
          )}

          {salePrices.length > 0 && (
            <div className="max-h-[320px] overflow-auto rounded-lg border border-slate-100">
              <table className="w-full text-sm">
                <thead className="bg-green-50/80 sticky top-0 z-10">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-medium text-green-600">サイト</th>
                    <th className="text-center px-2 py-2 text-xs font-medium text-green-600">グレード</th>
                    <th className="text-right px-3 py-2 text-xs font-medium text-green-600">価格</th>
                    <th className="text-right px-2 py-2 text-xs font-medium text-green-600">日時</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {(salePrices as any[]).slice(0, 30).map((p: any, i) => {
                    const date = formatDate(p.recorded_at || p.created_at)
                    return (
                      <tr key={i} className="hover:bg-green-50/30 transition-colors">
                        <td className="px-3 py-2 text-xs text-slate-600">{p.site?.name || '-'}</td>
                        <td className="px-2 py-2 text-center">
                          {p.grade ? (
                            <span className="px-1.5 py-0.5 rounded text-xs bg-slate-100 text-slate-600 font-medium">{p.grade}</span>
                          ) : '-'}
                        </td>
                        <td className="px-3 py-2 text-right font-semibold text-slate-800 text-xs tabular-nums">
                          ¥{p.price.toLocaleString()}
                        </td>
                        <td className="px-2 py-2 text-right text-xs text-slate-400">
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
    </div>
  )
}
