'use client'

import { useState, useEffect, useMemo } from 'react'
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis,
    CartesianGrid, Tooltip, Legend, AreaChart, Area
} from 'recharts'
import { TrendingUp, BarChart3, RefreshCw } from 'lucide-react'

interface MarketChartProps {
    category: string          // カテゴリ名（例: 'ポケモン'）
    rarity?: string           // レアリティ名（例: 'SAR'）
    subCategory?: string      // 世代名（例: 'スカーレット&バイオレット'）
}

const PERIOD_OPTIONS = [
    { label: '7日', days: 7 },
    { label: '30日', days: 30 },
    { label: '90日', days: 90 },
]

const GRADE_COLORS: Record<string, string> = {
    PSA10: '#8b5cf6',
    A: '#3b82f6',
    ALL: '#6b7280',
}

export default function MarketChart({ category, rarity, subCategory }: MarketChartProps) {
    const [data, setData] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedDays, setSelectedDays] = useState(30)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        fetchMarketData()
    }, [category, rarity, subCategory, selectedDays])

    const fetchMarketData = async () => {
        setLoading(true)
        setError(null)
        try {
            const params = new URLSearchParams()
            if (category) params.set('category', category)
            if (rarity) params.set('rarity', rarity)
            if (subCategory && subCategory !== 'ALL') params.set('subCategory', subCategory)
            params.set('days', String(selectedDays))

            const res = await fetch(`/api/price-index?${params}`)
            const json = await res.json()

            if (json.success) {
                setData(json.data || [])
            } else {
                setError(json.error)
            }
        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    // ① 販売相場の平均価格グラフデータ（grade別にライン表示）
    const saleChartData = useMemo(() => {
        const saleData = data.filter(d => d.price_type === 'sale')
        const byDate: Record<string, any> = {}

        for (const row of saleData) {
            if (!byDate[row.date]) {
                byDate[row.date] = {
                    date: new Date(row.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }),
                    rawDate: row.date,
                }
            }
            const key = `${row.grade}`
            byDate[row.date][key] = row.avg_price
            byDate[row.date][`${key}_count`] = row.trade_count
        }

        return Object.values(byDate).sort((a: any, b: any) => a.rawDate.localeCompare(b.rawDate))
    }, [data])

    // ② PSA10 日次平均取引額グラフデータ
    const psa10ChartData = useMemo(() => {
        const psa10Data = data.filter(d => d.grade === 'PSA10' && d.price_type === 'sale')
        const byDate: Record<string, any> = {}

        for (const row of psa10Data) {
            if (!byDate[row.date]) {
                byDate[row.date] = {
                    date: new Date(row.date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }),
                    rawDate: row.date,
                }
            }
            byDate[row.date].avg_price = row.avg_price
            byDate[row.date].median_price = row.median_price
            byDate[row.date].trade_count = row.trade_count
            byDate[row.date].card_count = row.card_count
        }

        return Object.values(byDate).sort((a: any, b: any) => a.rawDate.localeCompare(b.rawDate))
    }, [data])

    // グレードのユニークリスト
    const availableGrades = useMemo(() => {
        const grades = new Set<string>()
        data.filter(d => d.price_type === 'sale').forEach(d => grades.add(d.grade))
        return Array.from(grades).sort((a, b) => {
            const order: Record<string, number> = { PSA10: 1, A: 2, ALL: 3 }
            return (order[a] || 99) - (order[b] || 99)
        })
    }, [data])

    // カスタムツールチップ
    const PriceTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || !payload.length) return null
        return (
            <div className="bg-white border rounded-lg shadow-lg p-3 text-sm">
                <p className="font-medium text-gray-700 mb-2">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center gap-2">
                        <span style={{ color: entry.color }}>●</span>
                        <span>{entry.name}: ¥{entry.value?.toLocaleString()}</span>
                    </div>
                ))}
            </div>
        )
    }

    const PSA10Tooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || !payload.length) return null
        const data = payload[0]?.payload
        return (
            <div className="bg-white border rounded-lg shadow-lg p-3 text-sm">
                <p className="font-medium text-gray-700 mb-2">{label}</p>
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex items-center gap-2">
                        <span style={{ color: entry.color }}>●</span>
                        <span>{entry.name}: ¥{entry.value?.toLocaleString()}</span>
                    </div>
                ))}
                {data?.trade_count && (
                    <div className="text-xs text-gray-400 mt-1">取引数: {data.trade_count}件 / カード数: {data.card_count}種</div>
                )}
            </div>
        )
    }

    if (loading) {
        return (
            <div className="bg-white border rounded-xl p-8 text-center">
                <RefreshCw size={24} className="animate-spin mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-500">市場データを読み込み中...</p>
            </div>
        )
    }

    if (error || data.length === 0) {
        return (
            <div className="bg-gray-50 border rounded-xl p-6 text-center text-gray-500">
                <BarChart3 size={32} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm">{error || '市場相場データがまだありません'}</p>
                <p className="text-xs text-gray-400 mt-1">日次集計Cronが実行されるとデータが蓄積されます</p>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* 期間選択 */}
            <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">期間:</span>
                {PERIOD_OPTIONS.map(option => (
                    <button
                        key={option.days}
                        onClick={() => setSelectedDays(option.days)}
                        className={`px-3 py-1 rounded-lg text-sm transition-colors ${selectedDays === option.days
                            ? 'bg-purple-500 text-white'
                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                    >
                        {option.label}
                    </button>
                ))}
            </div>

            {/* ① 販売相場の平均価格グラフ */}
            {saleChartData.length > 0 && (
                <div className="bg-white border rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-4">
                        <TrendingUp size={18} className="text-green-600" />
                        <h3 className="font-bold text-gray-800">販売相場 — 平均価格推移</h3>
                        <span className="text-xs text-gray-400 ml-auto">
                            {category}{rarity ? ` / ${rarity}` : ''}{subCategory && subCategory !== 'ALL' ? ` / ${subCategory}` : ''}
                        </span>
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                        <LineChart data={saleChartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                            <YAxis
                                tick={{ fontSize: 11 }}
                                tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`}
                                domain={['auto', 'auto']}
                            />
                            <Tooltip content={<PriceTooltip />} />
                            <Legend />
                            {availableGrades.map(grade => (
                                <Line
                                    key={grade}
                                    type="monotone"
                                    dataKey={grade}
                                    stroke={GRADE_COLORS[grade] || '#6b7280'}
                                    strokeWidth={grade === 'PSA10' ? 3 : 2}
                                    name={grade === 'ALL' ? '全体平均' : grade}
                                    dot={{ r: 3 }}
                                    connectNulls
                                />
                            ))}
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            )}

            {/* ② PSA10 日次平均取引額グラフ */}
            {psa10ChartData.length > 0 && (
                <div className="bg-white border rounded-xl p-4">
                    <div className="flex items-center gap-2 mb-4">
                        <BarChart3 size={18} className="text-purple-600" />
                        <h3 className="font-bold text-gray-800">PSA10 — 日次平均取引額</h3>
                        <span className="text-xs text-gray-400 ml-auto">
                            {category}{rarity ? ` / ${rarity}` : ''}
                        </span>
                    </div>
                    <ResponsiveContainer width="100%" height={280}>
                        <AreaChart data={psa10ChartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                            <defs>
                                <linearGradient id="psa10Gradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05} />
                                </linearGradient>
                                <linearGradient id="medianGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.05} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                            <YAxis
                                tick={{ fontSize: 11 }}
                                tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`}
                                domain={['auto', 'auto']}
                            />
                            <Tooltip content={<PSA10Tooltip />} />
                            <Legend />
                            <Area
                                type="monotone"
                                dataKey="avg_price"
                                stroke="#8b5cf6"
                                strokeWidth={2.5}
                                fill="url(#psa10Gradient)"
                                name="平均取引額"
                                dot={{ r: 3, fill: '#8b5cf6' }}
                                connectNulls
                            />
                            <Area
                                type="monotone"
                                dataKey="median_price"
                                stroke="#06b6d4"
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                fill="url(#medianGradient)"
                                name="中央値"
                                dot={{ r: 2, fill: '#06b6d4' }}
                                connectNulls
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            )}
        </div>
    )
}
