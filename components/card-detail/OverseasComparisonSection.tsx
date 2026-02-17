'use client'

import { TrendingUp, TrendingDown, Minus, Globe } from 'lucide-react'
import { formatRelativeTime } from './constants'

interface OverseasComparisonSectionProps {
  overseasLatest: {
    loose_price_jpy?: number | null
    graded_price_jpy?: number | null
    loose_price_usd?: number | null
    graded_price_usd?: number | null
    exchange_rate?: number | null
    recorded_at?: string
  } | null
  latestPurchaseByLabel: Record<string, { price: number; label: string; shopName: string; date: string }>
  snkrdunkLatestByGrade: { price: number; stock: number | null; grade: string; date: string }[]
}

interface ComparisonRow {
  label: string
  domesticPrice: number
  domesticSource: string
  overseasJpy: number
  overseasUsd: number // cents
  diffJpy: number
  diffPercent: number
}

function DiffBadge({ diff, percent }: { diff: number; percent: number }) {
  const isPositive = diff > 0
  const isZero = diff === 0
  const colorClass = isZero
    ? 'text-slate-500 bg-slate-50'
    : isPositive
      ? 'text-emerald-700 bg-emerald-50'
      : 'text-rose-700 bg-rose-50'
  const Icon = isZero ? Minus : isPositive ? TrendingUp : TrendingDown

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold tabular-nums ${colorClass}`}>
      <Icon size={12} />
      {isPositive ? '+' : ''}¥{diff.toLocaleString()}
      <span className="text-[10px] font-medium opacity-70">
        ({isPositive ? '+' : ''}{percent.toFixed(1)}%)
      </span>
    </span>
  )
}

function ComparisonCard({ title, rows, overseasUsdLabel, exchangeRate }: {
  title: string
  rows: ComparisonRow[]
  overseasUsdLabel: string
  exchangeRate: number | null
}) {
  if (rows.length === 0) return null

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden flex-1 min-w-[280px]">
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 px-4 py-2.5 border-b border-indigo-100/60">
        <h5 className="text-xs font-semibold text-slate-700">{title}</h5>
      </div>
      <div className="p-4 space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500">{row.label}</span>
              <DiffBadge diff={row.diffJpy} percent={row.diffPercent} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-50 rounded-lg px-3 py-2">
                <p className="text-[10px] text-slate-400 font-medium">国内 ({row.domesticSource})</p>
                <p className="text-sm font-bold text-slate-800 tabular-nums">¥{row.domesticPrice.toLocaleString()}</p>
              </div>
              <div className="bg-indigo-50 rounded-lg px-3 py-2">
                <p className="text-[10px] text-indigo-400 font-medium">海外 (PriceCharting)</p>
                <p className="text-sm font-bold text-indigo-800 tabular-nums">¥{row.overseasJpy.toLocaleString()}</p>
                <p className="text-[10px] text-indigo-300">${(row.overseasUsd / 100).toFixed(2)}</p>
              </div>
            </div>
          </div>
        ))}
        {exchangeRate && (
          <p className="text-[10px] text-slate-300 text-right">$1 = ¥{exchangeRate.toFixed(2)}</p>
        )}
      </div>
    </div>
  )
}

export default function OverseasComparisonSection({
  overseasLatest,
  latestPurchaseByLabel,
  snkrdunkLatestByGrade,
}: OverseasComparisonSectionProps) {
  if (!overseasLatest) return null

  const looseJpy = overseasLatest.loose_price_jpy
  const gradedJpy = overseasLatest.graded_price_jpy
  const looseUsd = overseasLatest.loose_price_usd
  const gradedUsd = overseasLatest.graded_price_usd

  if (!looseJpy && !gradedJpy) return null

  // 買取 vs 海外
  const purchaseRows: ComparisonRow[] = []
  const normalPurchase = latestPurchaseByLabel['normal']
  if (normalPurchase && looseJpy && looseUsd) {
    const diff = normalPurchase.price - looseJpy
    purchaseRows.push({
      label: '素体',
      domesticPrice: normalPurchase.price,
      domesticSource: normalPurchase.shopName,
      overseasJpy: looseJpy,
      overseasUsd: looseUsd,
      diffJpy: diff,
      diffPercent: (diff / looseJpy) * 100,
    })
  }
  const psa10Purchase = latestPurchaseByLabel['psa10']
  if (psa10Purchase && gradedJpy && gradedUsd) {
    const diff = psa10Purchase.price - gradedJpy
    purchaseRows.push({
      label: 'PSA10',
      domesticPrice: psa10Purchase.price,
      domesticSource: psa10Purchase.shopName,
      overseasJpy: gradedJpy,
      overseasUsd: gradedUsd,
      diffJpy: diff,
      diffPercent: (diff / gradedJpy) * 100,
    })
  }

  // 販売最安 vs 海外
  const saleRows: ComparisonRow[] = []
  const saleA = snkrdunkLatestByGrade.find(g => g.grade === 'A')
  if (saleA && looseJpy && looseUsd) {
    const diff = saleA.price - looseJpy
    saleRows.push({
      label: '素体 (A最安)',
      domesticPrice: saleA.price,
      domesticSource: 'スニダン',
      overseasJpy: looseJpy,
      overseasUsd: looseUsd,
      diffJpy: diff,
      diffPercent: (diff / looseJpy) * 100,
    })
  }
  const salePSA10 = snkrdunkLatestByGrade.find(g => g.grade === 'PSA10')
  if (salePSA10 && gradedJpy && gradedUsd) {
    const diff = salePSA10.price - gradedJpy
    saleRows.push({
      label: 'PSA10 最安',
      domesticPrice: salePSA10.price,
      domesticSource: 'スニダン',
      overseasJpy: gradedJpy,
      overseasUsd: gradedUsd,
      diffJpy: diff,
      diffPercent: (diff / gradedJpy) * 100,
    })
  }

  if (purchaseRows.length === 0 && saleRows.length === 0) return null

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="bg-gradient-to-r from-indigo-50 via-blue-50 to-cyan-50 px-5 py-3 border-b border-indigo-100/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe size={16} className="text-indigo-600" />
            <h4 className="text-sm font-semibold text-slate-800 tracking-tight">海外 vs 国内 価格比較</h4>
          </div>
          {overseasLatest.recorded_at && (
            <span className="text-[10px] text-slate-400">
              更新: {formatRelativeTime(overseasLatest.recorded_at)}
            </span>
          )}
        </div>
      </div>
      <div className="p-5">
        <div className="flex flex-wrap gap-4">
          <ComparisonCard
            title="🏪 国内買取 vs 海外"
            rows={purchaseRows}
            overseasUsdLabel="PriceCharting"
            exchangeRate={overseasLatest.exchange_rate ?? null}
          />
          <ComparisonCard
            title="🛒 国内販売最安 vs 海外"
            rows={saleRows}
            overseasUsdLabel="PriceCharting"
            exchangeRate={purchaseRows.length === 0 ? (overseasLatest.exchange_rate ?? null) : null}
          />
        </div>
      </div>
    </div>
  )
}
