'use client'

import { useState, useEffect } from 'react'
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer
} from 'recharts'

// グレード・レアリティ別の色
const CHART_COLORS = {
    'SAR_PSA10_sale': '#ef4444',
    'SAR_A_sale': '#f97316',
    'AR_PSA10_sale': '#3b82f6',
    'AR_A_sale': '#06b6d4',
    'SR_PSA10_sale': '#8b5cf6',
    'SR_A_sale': '#a855f7',
    'SAR_ALL_purchase': '#22c55e',
    'AR_ALL_purchase': '#10b981',
    'SR_ALL_purchase': '#14b8a6',
}

const PERIODS = [
    { label: '7日', value: 7 },
    { label: '30日', value: 30 },
    { label: '90日', value: 90 },
    { label: '180日', value: 180 },
    { label: '1年', value: 365 },
]

export default function PriceIndexPage() {
    const [data, setData] = useState<any[]>([])
    const [chartData, setChartData] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // フィルター
    const [category, setCategory] = useState('ポケモン')
    const [selectedRarities, setSelectedRarities] = useState<string[]>(['SAR'])
    const [selectedGrades, setSelectedGrades] = useState<string[]>(['PSA10'])
    const [priceType, setPriceType] = useState<'all' | 'sale' | 'purchase'>('all')
    const [days, setDays] = useState(30)

    // 利用可能なレアリティ・グレード
    const [availableRarities, setAvailableRarities] = useState<string[]>([])
    const [availableGrades, setAvailableGrades] = useState<string[]>([])

    // データ取得
    useEffect(() => {
        fetchData()
    }, [category, days])

    const fetchData = async () => {
        setLoading(true)
        setError(null)

        try {
            const params = new URLSearchParams({
                category,
                days: days.toString()
            })

            if (priceType !== 'all') {
                params.set('priceType', priceType)
            }

            const res = await fetch(`/api/price-index?${params}`)
            const json = await res.json()

            if (!json.success) {
                throw new Error(json.error)
            }

            setData(json.data || [])
            setChartData(json.chart || [])

            // 利用可能なレアリティ・グレードを抽出
            const rarities = [...new Set(json.data?.map((d: any) => d.rarity) || [])]
            const grades = [...new Set(json.data?.map((d: any) => d.grade) || [])]
            setAvailableRarities(rarities.filter(r => r && r !== 'UNKNOWN') as string[])
            setAvailableGrades(grades.filter(g => g && g !== 'ALL') as string[])

        } catch (err: any) {
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }

    // 選択されたラインのキーを取得
    const getSelectedLineKeys = () => {
        const keys: string[] = []

        for (const rarity of selectedRarities) {
            if (priceType === 'all' || priceType === 'sale') {
                for (const grade of selectedGrades) {
                    keys.push(`${rarity}_${grade}_sale`)
                }
            }
            if (priceType === 'all' || priceType === 'purchase') {
                keys.push(`${rarity}_ALL_purchase`)
            }
        }

        return keys
    }

    const toggleRarity = (rarity: string) => {
        setSelectedRarities(prev =>
            prev.includes(rarity)
                ? prev.filter(r => r !== rarity)
                : [...prev, rarity]
        )
    }

    const toggleGrade = (grade: string) => {
        setSelectedGrades(prev =>
            prev.includes(grade)
                ? prev.filter(g => g !== grade)
                : [...prev, grade]
        )
    }

    const formatPrice = (value: number) => {
        return `¥${value.toLocaleString()}`
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* ヘッダー */}
            <div className="bg-white dark:bg-gray-800 shadow">
                <div className="max-w-7xl mx-auto px-4 py-6">
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                        📊 価格インデックス
                    </h1>
                    <p className="mt-1 text-gray-500 dark:text-gray-400">
                        カテゴリ・レアリティ別の価格トレンド
                    </p>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-6">
                {/* フィルター */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {/* カテゴリ */}
                        <div>
                            <label className="block text-sm font-medium mb-1">カテゴリ</label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full border rounded-md px-3 py-2 dark:bg-gray-700"
                            >
                                <option value="ポケモン">ポケモンカード</option>
                                <option value="ワンピース">ワンピースカード</option>
                                <option value="遊戯王">遊戯王</option>
                            </select>
                        </div>

                        {/* 期間 */}
                        <div>
                            <label className="block text-sm font-medium mb-1">期間</label>
                            <div className="flex gap-1 flex-wrap">
                                {PERIODS.map(p => (
                                    <button
                                        key={p.value}
                                        onClick={() => setDays(p.value)}
                                        className={`px-3 py-1 rounded text-sm ${days === p.value
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-gray-200 dark:bg-gray-700'
                                            }`}
                                    >
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 価格タイプ */}
                        <div>
                            <label className="block text-sm font-medium mb-1">価格タイプ</label>
                            <div className="flex gap-2">
                                {[
                                    { label: '全て', value: 'all' },
                                    { label: '売買', value: 'sale' },
                                    { label: '買取', value: 'purchase' }
                                ].map(t => (
                                    <button
                                        key={t.value}
                                        onClick={() => setPriceType(t.value as any)}
                                        className={`px-3 py-1 rounded text-sm ${priceType === t.value
                                                ? 'bg-blue-500 text-white'
                                                : 'bg-gray-200 dark:bg-gray-700'
                                            }`}
                                    >
                                        {t.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 更新ボタン */}
                        <div className="flex items-end">
                            <button
                                onClick={fetchData}
                                disabled={loading}
                                className="w-full bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 disabled:opacity-50"
                            >
                                {loading ? '読込中...' : '更新'}
                            </button>
                        </div>
                    </div>

                    {/* レアリティ選択 */}
                    <div className="mt-4 pt-4 border-t">
                        <label className="block text-sm font-medium mb-2">レアリティ</label>
                        <div className="flex gap-2 flex-wrap">
                            {availableRarities.map(rarity => (
                                <button
                                    key={rarity}
                                    onClick={() => toggleRarity(rarity)}
                                    className={`px-3 py-1 rounded text-sm ${selectedRarities.includes(rarity)
                                            ? 'bg-purple-500 text-white'
                                            : 'bg-gray-200 dark:bg-gray-700'
                                        }`}
                                >
                                    {rarity}
                                </button>
                            ))}
                            {availableRarities.length === 0 && (
                                <span className="text-gray-400 text-sm">データなし</span>
                            )}
                        </div>
                    </div>

                    {/* グレード選択 */}
                    <div className="mt-4 pt-4 border-t">
                        <label className="block text-sm font-medium mb-2">グレード</label>
                        <div className="flex gap-2 flex-wrap">
                            {availableGrades.map(grade => (
                                <button
                                    key={grade}
                                    onClick={() => toggleGrade(grade)}
                                    className={`px-3 py-1 rounded text-sm ${selectedGrades.includes(grade)
                                            ? 'bg-green-500 text-white'
                                            : 'bg-gray-200 dark:bg-gray-700'
                                        }`}
                                >
                                    {grade}
                                </button>
                            ))}
                            {availableGrades.length === 0 && (
                                <span className="text-gray-400 text-sm">データなし</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* エラー表示 */}
                {error && (
                    <div className="bg-red-100 text-red-700 p-4 rounded-lg mb-6">
                        {error}
                    </div>
                )}

                {/* グラフ */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                    <h2 className="text-lg font-semibold mb-4">価格推移</h2>

                    {chartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={400}>
                            <LineChart data={chartData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fontSize: 12 }}
                                    tickFormatter={(value) => value.slice(5)} // MM-DD形式
                                />
                                <YAxis
                                    tickFormatter={(value) => `¥${(value / 1000).toFixed(0)}k`}
                                />
                                <Tooltip
                                    formatter={(value: number) => formatPrice(value)}
                                    labelFormatter={(label) => `日付: ${label}`}
                                />
                                <Legend />

                                {getSelectedLineKeys().map(key => (
                                    <Line
                                        key={key}
                                        type="monotone"
                                        dataKey={key}
                                        name={key.replace(/_/g, ' ')}
                                        stroke={CHART_COLORS[key as keyof typeof CHART_COLORS] || '#888'}
                                        strokeWidth={2}
                                        dot={false}
                                        connectNulls
                                    />
                                ))}
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-64 flex items-center justify-center text-gray-500">
                            {loading ? '読込中...' : 'データがありません'}
                        </div>
                    )}
                </div>

                {/* データ統計 */}
                {data.length > 0 && (
                    <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                        {data.slice(-8).map((row, i) => (
                            <div key={i} className="bg-white dark:bg-gray-800 rounded-lg shadow p-4">
                                <div className="text-sm text-gray-500">
                                    {row.rarity} / {row.grade} / {row.price_type === 'sale' ? '売買' : '買取'}
                                </div>
                                <div className="text-xl font-bold mt-1">
                                    ¥{row.avg_price?.toLocaleString() || '-'}
                                </div>
                                <div className="text-xs text-gray-400 mt-1">
                                    {row.trade_count}件 ({row.card_count}種)
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
