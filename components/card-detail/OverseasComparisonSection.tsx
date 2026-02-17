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
  snkrdunkLatestByGrade: { price: number; stock: number | null; grade: string; date: string }[]
}

interface ComparisonRow {
  label: string
  domesticPrice: number
  domesticSource: string
  overseasJpy: number
  overseasUsd: number // cents
  profitJpy: number    // overseas - domestic（正=利益）
  profitPercent: number
}

function ProfitBadge({ profit, percent }: { profit: number; percent: number }) {
  const isPositive = profit > 0
  const isZero = profit === 0
  const colorClass = isZero
    ? 'text-slate-500 bg-slate-50'
    : isPositive
      ? 'text-emerald-700 bg-emerald-50'
      : 'text-rose-700 bg-rose-50'
  const Icon = isZero ? Minus : isPositive ? TrendingUp : TrendingDown

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold tabular-nums ${colorClass}`}>
      <Icon size={12} />
      {isPositive ? '+' : ''}¥{profit.toLocaleString()}
      <span className="text-[10px] font-medium opacity-70">
        ({isPositive ? '+' : ''}{percent.toFixed(1)}%)
      </span>
    </span>
  )
}

function ComparisonCard({ title, rows, exchangeRate }: {
  title: string
  rows: ComparisonRow[]
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
              <ProfitBadge profit={row.profitJpy} percent={row.profitPercent} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-slate-50 rounded-lg px-3 py-2">
                <p className="text-[10px] text-slate-400 font-medium">国内仕入 ({row.domesticSource})</p>
                <p className="text-sm font-bold text-slate-800 tabular-nums">¥{row.domesticPrice.toLocaleString()}</p>
              </div>
              <div className="bg-indigo-50 rounded-lg px-3 py-2">
                <p className="text-[10px] text-indigo-400 font-medium">海外売値 (PC)</p>
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
  snkrdunkLatestByGrade,
}: OverseasComparisonSectionProps) {
  if (!overseasLatest) return null

  const looseJpy = overseasLatest.loose_price_jpy
  const gradedJpy = overseasLatest.graded_price_jpy
  const looseUsd = overseasLatest.loose_price_usd
  const gradedUsd = overseasLatest.graded_price_usd

  if (!looseJpy && !gradedJpy) return null

  // 素体: スニダンB/A vs 海外loose（海外で売る利益）
  const looseRows: ComparisonRow[] = []
  if (looseJpy && looseUsd) {
    const saleB = snkrdunkLatestByGrade.find(g => g.grade === 'B')
    if (saleB) {
      const profit = looseJpy - saleB.price
      looseRows.push({
        label: 'B仕入 → 海外売',
        domesticPrice: saleB.price,
        domesticSource: 'スニダンB',
        overseasJpy: looseJpy,
        overseasUsd: looseUsd,
        profitJpy: profit,
        profitPercent: (profit / saleB.price) * 100,
      })
    }
    const saleA = snkrdunkLatestByGrade.find(g => g.grade === 'A')
    if (saleA) {
      const profit = looseJpy - saleA.price
      looseRows.push({
        label: 'A仕入 → 海外売',
        domesticPrice: saleA.price,
        domesticSource: 'スニダンA',
        overseasJpy: looseJpy,
        overseasUsd: looseUsd,
        profitJpy: profit,
        profitPercent: (profit / saleA.price) * 100,
      })
    }
  }

  // PSA10: スニダンPSA10 vs 海外graded
  const gradedRows: ComparisonRow[] = []
  if (gradedJpy && gradedUsd) {
    const salePSA10 = snkrdunkLatestByGrade.find(g => g.grade === 'PSA10')
    if (salePSA10) {
      const profit = gradedJpy - salePSA10.price
      gradedRows.push({
        label: 'PSA10仕入 → 海外売',
        domesticPrice: salePSA10.price,
        domesticSource: 'スニダンPSA10',
        overseasJpy: gradedJpy,
        overseasUsd: gradedUsd,
        profitJpy: profit,
        profitPercent: (profit / salePSA10.price) * 100,
      })
    }
  }

  if (looseRows.length === 0 && gradedRows.length === 0) return null

  return (
    <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      <div className="bg-gradient-to-r from-indigo-50 via-blue-50 to-cyan-50 px-5 py-3 border-b border-indigo-100/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe size={16} className="text-indigo-600" />
            <h4 className="text-sm font-semibold text-slate-800 tracking-tight">海外転売シミュレーション</h4>
          </div>
          {overseasLatest.recorded_at && (
            <span className="text-[10px] text-slate-400">
              更新: {formatRelativeTime(overseasLatest.recorded_at)}
            </span>
          )}
        </div>
        <p className="text-[10px] text-slate-400 mt-0.5">国内スニダンで仕入 → 海外PriceChartingで売った場合の差額</p>
      </div>
      <div className="p-5">
        <div className="flex flex-wrap gap-4">
          <ComparisonCard
            title="素体 (B / A)"
            rows={looseRows}
            exchangeRate={overseasLatest.exchange_rate ?? null}
          />
          <ComparisonCard
            title="PSA10"
            rows={gradedRows}
            exchangeRate={looseRows.length === 0 ? (overseasLatest.exchange_rate ?? null) : null}
          />
        </div>
      </div>
    </div>
  )
}
