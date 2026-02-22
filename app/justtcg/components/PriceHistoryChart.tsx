'use client'

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

interface PriceHistoryChartProps {
  data: Array<{ p: number; t: number }>
}

export default function PriceHistoryChart({ data }: PriceHistoryChartProps) {
  if (data.length < 2) return <p className="text-xs text-[var(--jtcg-text-muted)] text-center py-4">データ不足</p>

  const chartData = data.map(d => ({
    price: d.p,
    date: new Date(d.t * 1000).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
  }))

  const avg = data.reduce((s, d) => s + d.p, 0) / data.length

  return (
    <div className="bg-gray-50 rounded-[var(--jtcg-radius)] p-3">
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
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null
              return (
                <div className="bg-white border border-[var(--jtcg-border)] rounded-[var(--jtcg-radius)] shadow-sm px-3 py-2 text-xs">
                  <p className="text-[var(--jtcg-text-secondary)]">{payload[0]?.payload?.date}</p>
                  <p className="font-bold" style={{ fontFamily: 'var(--font-price)' }}>
                    ${(payload[0]?.value as number)?.toFixed(2)}
                  </p>
                </div>
              )
            }}
          />
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
}
