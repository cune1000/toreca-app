'use client'

import { memo } from 'react'

interface SparklineChartProps {
  data: Array<{ p: number; t: number }>
}

const W = 64
const H = 24
const PAD = 1

export default memo(function SparklineChart({ data }: SparklineChartProps) {
  const validData = data.filter(d => typeof d.p === 'number' && !isNaN(d.p))
  if (validData.length < 2) return null

  const prices = validData.map(d => d.p)
  const min = prices.reduce((a, b) => a < b ? a : b, prices[0])
  const max = prices.reduce((a, b) => a > b ? a : b, prices[0])
  const range = max - min || 1

  const first = prices[0]
  const last = prices[prices.length - 1]
  const color = last >= first ? 'var(--jtcg-up, #059669)' : 'var(--jtcg-down, #DC2626)'

  const points = validData.map((d, i) => {
    const x = PAD + (i / (validData.length - 1)) * (W - PAD * 2)
    const y = PAD + (1 - (d.p - min) / range) * (H - PAD * 2)
    return `${x.toFixed(1)},${y.toFixed(1)}`
  }).join(' ')

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={W}
      height={H}
      className="block"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
})
