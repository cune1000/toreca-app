'use client'

import { memo } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

interface PriceHistoryChartProps {
  data: Array<{ p: number; t: number }>
}

// Tooltip をファイルスコープに定義（インラインだと毎レンダーで再マウントされる）
function ChartTooltip({ active, payload }: { active?: boolean; payload?: Array<{ value: unknown; payload: { date: string } }> }) {
  if (!active || !payload?.length) return null
  const val = payload[0]?.value
  return (
    <div className="bg-white border border-[var(--jtcg-border)] rounded-[var(--jtcg-radius)] shadow-sm px-3 py-2 text-xs">
      <p className="text-[var(--jtcg-text-secondary)]">{payload[0]?.payload?.date}</p>
      <p className="font-bold" style={{ fontFamily: 'var(--font-price)' }}>
        {typeof val === 'number' ? `$${val.toFixed(2)}` : '--'}
      </p>
    </div>
  )
}

export default memo(function PriceHistoryChart({ data }: PriceHistoryChartProps) {
  if (data.length < 2) return <p className="text-xs text-[var(--jtcg-text-muted)] text-center py-4">データ不足</p>

  // NaN/無効なデータポイントを除外
  const validData = data.filter(d => typeof d.p === 'number' && !isNaN(d.p) && typeof d.t === 'number')
  if (validData.length < 2) return <p className="text-xs text-[var(--jtcg-text-muted)] text-center py-4">データ不足</p>

  const chartData = validData.map(d => ({
    price: d.p,
    date: new Date(d.t * 1000).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
  }))

  const avg = validData.reduce((s, d) => s + d.p, 0) / validData.length

  return (
    <div className="bg-gray-50 rounded-[var(--jtcg-radius)] p-3" role="img" aria-label={`価格推移チャート: ${validData.length}点、平均$${avg.toFixed(2)}`}>
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={chartData}>
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: 'var(--jtcg-text-muted)' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: 'var(--jtcg-text-muted)' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={v => `$${v.toFixed(0)}`}
            width={40}
          />
          <Tooltip content={<ChartTooltip />} />
          <ReferenceLine
            y={avg}
            stroke="var(--jtcg-text-muted)"
            strokeDasharray="4 4"
            strokeWidth={1}
          />
          <Line
            type="monotone"
            dataKey="price"
            stroke="var(--jtcg-ink)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: 'var(--jtcg-ink)' }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
})
