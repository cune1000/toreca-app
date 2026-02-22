'use client'

import { LineChart, Line, ResponsiveContainer } from 'recharts'

interface SparklineChartProps {
  data: Array<{ p: number; t: number }>
}

export default function SparklineChart({ data }: SparklineChartProps) {
  if (data.length < 2) return null

  const first = data[0]?.p ?? 0
  const last = data[data.length - 1]?.p ?? 0
  const color = last >= first ? '#059669' : '#DC2626'

  return (
    <ResponsiveContainer width="100%" height={24}>
      <LineChart data={data}>
        <Line
          type="monotone"
          dataKey="p"
          stroke={color}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
