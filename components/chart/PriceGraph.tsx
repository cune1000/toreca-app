'use client'

import { useState, useMemo } from 'react'
import {
    AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { PricePoint } from '@/lib/chart/types'
import { formatPrice, formatDate, formatUsd } from '@/lib/chart/format'

const PERIODS = [
    { key: '30d', label: '30日' },
    { key: '90d', label: '90日' },
    { key: '1y', label: '1年' },
    { key: 'all', label: '全期間' },
] as const

interface Props {
    data: Record<string, PricePoint[]>  // period -> data
    onPeriodChange: (period: string) => void
    initialPeriod?: string
}

function CustomTooltip({ active, payload }: any) {
    if (!active || !payload?.length) return null
    const d = payload[0]?.payload
    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-xs">
            <p className="text-gray-500 mb-1">{d?.date}</p>
            {payload.map((p: any, i: number) => (
                <div key={i}>
                    <p className="font-bold" style={{ color: p.color }}>
                        {p.name}: {formatPrice(p.value || 0)}
                    </p>
                    {p.dataKey === 'loose_price_jpy' && d?.loose_price_usd > 0 && (
                        <p className="text-gray-400 text-[10px]">({formatUsd(d.loose_price_usd)})</p>
                    )}
                    {p.dataKey === 'graded_price_jpy' && d?.graded_price_usd > 0 && (
                        <p className="text-gray-400 text-[10px]">({formatUsd(d.graded_price_usd)})</p>
                    )}
                </div>
            ))}
        </div>
    )
}

export default function PriceGraph({ data, onPeriodChange, initialPeriod = '30d' }: Props) {
    const [period, setPeriod] = useState(initialPeriod)
    const [showGraded, setShowGraded] = useState(true)

    const chartData = data[period] || []

    const handlePeriodChange = (p: string) => {
        setPeriod(p)
        onPeriodChange(p)
    }

    const formattedData = useMemo(() =>
        chartData.map(d => ({
            ...d,
            displayDate: formatDate(d.date),
        })),
        [chartData]
    )

    const tickInterval = Math.max(1, Math.floor(formattedData.length / 6))

    return (
        <div>
            {/* 期間切り替え */}
            <div className="grid grid-cols-4 gap-1.5 mb-4">
                {PERIODS.map(p => (
                    <button
                        key={p.key}
                        onClick={() => handlePeriodChange(p.key)}
                        className={`py-2.5 rounded-xl text-xs font-bold transition-all min-h-[44px]
                            ${period === p.key
                                ? 'bg-gray-800 text-white shadow-md'
                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200 active:bg-gray-300'
                            }`}
                    >
                        {p.label}
                    </button>
                ))}
            </div>

            {/* 素体/PSA10の表示切り替え */}
            <div className="flex items-center gap-4 mb-2 text-xs">
                <label className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400" />
                    <span className="text-gray-600">素体価格</span>
                </label>
                <label
                    className="flex items-center gap-1.5 cursor-pointer"
                    onClick={() => setShowGraded(!showGraded)}
                >
                    <div
                        className={`w-3 h-3 rounded-full border-2 transition-colors ${showGraded
                                ? 'bg-emerald-400 border-emerald-400'
                                : 'bg-white border-gray-300'
                            }`}
                    />
                    <span className={showGraded ? 'text-gray-600' : 'text-gray-400'}>
                        PSA10
                    </span>
                </label>
            </div>

            {/* グラフ */}
            <div className="bg-white rounded-xl border border-gray-100 p-3 shadow-sm">
                {formattedData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                        <AreaChart data={formattedData}>
                            <defs>
                                <linearGradient id="gradLoose" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#ef4444" stopOpacity={0.15} />
                                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="gradGraded" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.1} />
                                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                            <XAxis
                                dataKey="displayDate"
                                tick={{ fontSize: 10, fill: '#9ca3af' }}
                                axisLine={{ stroke: '#e5e7eb' }}
                                tickLine={false}
                                interval={tickInterval}
                            />
                            <YAxis
                                tick={{ fontSize: 10, fill: '#9ca3af' }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`}
                                width={52}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Area
                                type="monotone"
                                dataKey="loose_price_jpy"
                                stroke="#ef4444"
                                strokeWidth={2}
                                fill="url(#gradLoose)"
                                name="素体価格"
                                dot={false}
                                activeDot={{ r: 4, fill: '#ef4444' }}
                            />
                            {showGraded && (
                                <Area
                                    type="monotone"
                                    dataKey="graded_price_jpy"
                                    stroke="#10b981"
                                    strokeWidth={1.5}
                                    fill="url(#gradGraded)"
                                    name="PSA10"
                                    dot={false}
                                    activeDot={{ r: 4, fill: '#10b981' }}
                                    strokeDasharray="4 2"
                                />
                            )}
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-[240px] flex items-center justify-center text-gray-400 text-sm">
                        価格データがありません
                    </div>
                )}
            </div>
        </div>
    )
}
