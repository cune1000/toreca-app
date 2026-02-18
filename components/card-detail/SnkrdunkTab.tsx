'use client'

import { RefreshCw } from 'lucide-react'
import {
  SNKRDUNK_GRADE_COLORS, PURCHASE_CONDITION_COLORS,
  GRADE_SORT_ORDER, isBoxGrade, SINGLE_CATEGORIES,
  formatRelativeTime,
} from './constants'

interface SnkrdunkTabProps {
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

export default function SnkrdunkTab({
  snkrdunkSales, snkrdunkLoading, snkrdunkScraping,
  selectedSnkrdunkCategory, onCategoryChange, onScrape,
  purchasePrices, salePrices,
  latestPurchaseByLabel, snkrdunkLatestByGrade,
  formatDate,
}: SnkrdunkTabProps) {
  return (
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
  )
}
