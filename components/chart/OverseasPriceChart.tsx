'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { RefreshCw } from 'lucide-react'
import { OverseasPrice } from '@/lib/types'

interface Props {
  cardId: string
  pricechartingId?: string | null
  days?: number
}

const PERIOD_OPTIONS = [
  { label: '7日', days: 7 },
  { label: '30日', days: 30 },
  { label: '90日', days: 90 },
  { label: '全期間', days: 0 },
]

export default function OverseasPriceChart({ cardId, pricechartingId, days: initialDays = 30 }: Props) {
  const [prices, setPrices] = useState<OverseasPrice[]>([])
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedDays, setSelectedDays] = useState(initialDays)

  const fetchPrices = useCallback(async () => {
    if (!pricechartingId) return
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ card_id: cardId, days: String(selectedDays) })
      const res = await fetch(`/api/overseas-prices?${params}`)
      const json = await res.json()
      if (json.success) {
        setPrices(json.data || [])
      } else {
        setError(json.error || '取得に失敗しました')
      }
    } catch (err: any) {
      setError('海外価格の取得に失敗しました')
      console.error('Failed to fetch overseas prices:', err)
    } finally {
      setLoading(false)
    }
  }, [cardId, pricechartingId, selectedDays])

  useEffect(() => {
    fetchPrices()
  }, [fetchPrices])

  // 手動更新
  const handleManualUpdate = async () => {
    if (!pricechartingId) return
    setUpdating(true)
    try {
      const res = await fetch('/api/overseas-prices/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_id: cardId, pricecharting_id: pricechartingId }),
      })
      const json = await res.json()
      if (json.success) {
        const d = json.data
        const parts = []
        if (d.looseUsd != null) parts.push(`素体: $${(d.looseUsd / 100).toFixed(2)}`)
        if (d.psa10Usd != null) parts.push(`PSA10: $${(d.psa10Usd / 100).toFixed(2)}`)
        alert(`更新完了: ${parts.join(' / ')}${d.psa10Jpy != null ? ` (PSA10 ≈¥${d.psa10Jpy.toLocaleString()})` : ''}`)
        fetchPrices()
      } else {
        alert('更新失敗: ' + (json.error || '不明なエラー'))
      }
    } catch (err: any) {
      alert('エラー: ' + err.message)
    } finally {
      setUpdating(false)
    }
  }

  const chartData = useMemo(() => {
    return prices.map(p => ({
      date: new Date(p.recorded_at!).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
      looseUsd: p.loose_price_usd != null ? p.loose_price_usd / 100 : null,
      gradedUsd: p.graded_price_usd != null ? p.graded_price_usd / 100 : null,
      looseJpy: p.loose_price_jpy ?? null,
      gradedJpy: p.graded_price_jpy ?? null,
      rate: p.exchange_rate ?? null,
    }))
  }, [prices])

  // 最新価格を取得
  const latest = prices.length > 0 ? prices[prices.length - 1] : null

  if (!pricechartingId) {
    return (
      <div className="text-center py-6 text-gray-400 text-sm">
        PriceChartingと紐付けると海外価格グラフが表示されます
      </div>
    )
  }

  // 価格フォーマットヘルパー
  const fmtJpy = (v: number | null | undefined) => v != null ? `¥${v.toLocaleString()}` : '-'
  const fmtUsd = (cents: number | null | undefined) => cents != null ? `$${(cents / 100).toFixed(2)}` : null
  const fmtRate = (rate: number | null | undefined) => rate != null ? `@¥${Number(rate).toFixed(2)}` : null

  return (
    <div className="space-y-3">
      {/* 最新価格サマリー + 更新ボタン */}
      <div className="flex items-center justify-between">
        <div className="flex-1 space-y-1.5">
          {latest ? (
            <>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs font-medium text-blue-600 w-10 shrink-0">素体</span>
                <span className="text-base font-bold text-gray-800">{fmtJpy(latest.loose_price_jpy)}</span>
                {latest.loose_price_usd != null && (
                  <span className="text-xs text-gray-400">
                    （{fmtUsd(latest.loose_price_usd)} {fmtRate(latest.exchange_rate)}）
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs font-medium text-purple-600 w-10 shrink-0">PSA10</span>
                <span className="text-base font-bold text-gray-800">{fmtJpy(latest.graded_price_jpy)}</span>
                {latest.graded_price_usd != null && (
                  <span className="text-xs text-gray-400">
                    （{fmtUsd(latest.graded_price_usd)} {fmtRate(latest.exchange_rate)}）
                  </span>
                )}
              </div>
            </>
          ) : (
            <p className="text-center py-2 text-gray-400 text-sm">価格データなし</p>
          )}
        </div>
        <button
          onClick={handleManualUpdate}
          disabled={updating}
          className="ml-2 px-3 py-2 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1 shrink-0"
          title="PriceChartingから最新価格を取得"
        >
          <RefreshCw size={14} className={updating ? 'animate-spin' : ''} />
          更新
        </button>
      </div>

      {/* 期間フィルタ */}
      <div className="flex gap-1">
        {PERIOD_OPTIONS.map(opt => (
          <button
            key={opt.days}
            onClick={() => setSelectedDays(opt.days)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
              selectedDays === opt.days
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* グラフ（円建て2本線 + ツールチップでUSD・レート表示） */}
      {loading ? (
        <div className="py-8 text-center">
          <div className="inline-block w-5 h-5 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-xs text-gray-400 mt-2">読み込み中...</p>
        </div>
      ) : error ? (
        <p className="text-red-500 text-center py-6 text-sm">{error}</p>
      ) : chartData.length > 0 ? (
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis
                tick={{ fontSize: 10 }}
                tickFormatter={v => `¥${(v / 1000).toFixed(0)}k`}
                width={45}
              />
              <Tooltip
                contentStyle={{ fontSize: 11, borderRadius: 8, padding: '8px 12px' }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null
                  const d = payload[0]?.payload
                  return (
                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-2 text-xs">
                      <p className="font-medium text-gray-600 mb-1">{label}</p>
                      {d?.looseJpy != null && (
                        <p className="text-blue-600">
                          素体 ¥{d.looseJpy.toLocaleString()}
                          {d.looseUsd != null && <span className="text-gray-400 ml-1">(${d.looseUsd.toFixed(2)})</span>}
                        </p>
                      )}
                      {d?.gradedJpy != null && (
                        <p className="text-purple-600">
                          PSA10 ¥{d.gradedJpy.toLocaleString()}
                          {d.gradedUsd != null && <span className="text-gray-400 ml-1">(${d.gradedUsd.toFixed(2)})</span>}
                        </p>
                      )}
                      {d?.rate != null && (
                        <p className="text-gray-400 mt-0.5">$1 = ¥{d.rate.toFixed(2)}</p>
                      )}
                    </div>
                  )
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: 11 }}
                formatter={(value: string) => <span className="text-xs">{value}</span>}
              />
              <Line
                type="monotone"
                dataKey="looseJpy"
                name="素体"
                stroke="#3b82f6"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="gradedJpy"
                name="PSA10"
                stroke="#8b5cf6"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-gray-400 text-center py-6 text-sm">価格データがまだありません</p>
      )}
    </div>
  )
}
