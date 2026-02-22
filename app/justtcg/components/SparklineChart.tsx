'use client'

import { memo } from 'react'
import { LineChart, Line, ResponsiveContainer } from 'recharts'

interface SparklineChartProps {
  data: Array<{ p: number; t: number }>
}

export default memo(function SparklineChart({ data }: SparklineChartProps) {
  const validData = data.filter(d => typeof d.p === 'number' && !isNaN(d.p))
  if (validData.length < 2) return null

  const first = validData[0].p
  const last = validData[validData.length - 1].p
  const color = last >= first ? '#059669' : '#DC2626'

  return (
    <ResponsiveContainer width="100%" height={24}>
      <LineChart data={validData}>
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
})
