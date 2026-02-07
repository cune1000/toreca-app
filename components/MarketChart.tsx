'use client'

import { useState, useEffect, useMemo } from 'react'
import {
    ResponsiveContainer, LineChart, Line, XAxis, YAxis,
    CartesianGrid, Tooltip, Legend, AreaChart, Area
} from 'recharts'
import { TrendingUp, BarChart3, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'

interface MarketChartProps {
    cardId: string
}

const PERIOD_OPTIONS = [
    { label: '7日', days: 7 },
    { label: '30日', days: 30 },
    { label: '90日', days: 90 },
    { label: '全期間', days: null },
]

export default function MarketChart({ cardId }: MarketChartProps) {
    const [snkrdunkSales, setSnkrdunkSales] = useState<any[]>([])
    const [purchasePrices, setPurchasePrices] = useState<any[]>([])
    const [salePrices, setSalePrices] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedDays, setSelectedDays] = useState<number | null>(30)

    useEffect(() => {
        if (!cardId) return
        fetchData()
    }, [cardId])

    const fetchData = async () => {
        setLoading(true)

        // スニダン売買履歴を取得（そのカードの全データ）
        const { data: salesData } = await supabase
            .from('snkrdunk_sales_history')
            .select('price, grade, sold_at')
            .eq('card_id', cardId)
            .gt('price', 0)
            .order('sold_at', { ascending: true })

        // 買取価格を取得（そのカードの全データ）
        const { data: purchaseData } = await supabase
            .from('purchase_prices')
            .select('price, created_at')
            .eq('card_id', cardId)
            .gt('price', 0)
            .order('created_at', { ascending: true })

        // 販売価格を取得（そのカードの全データ）
        const { data: saleData } = await supabase
            .from('sale_prices')
            .select('price, created_at')
            .eq('card_id', cardId)
            .gt('price', 0)
            .order('created_at', { ascending: true })

        setSnkrdunkSales(salesData || [])
        setPurchasePrices(purchaseData || [])
        setSalePrices(saleData || [])
        setLoading(false)
    }

    // 期間フィルタ
    const filterByPeriod = (items: any[], dateKey: string) => {
        if (!selectedDays) return items
        const cutoff = new Date()
        cutoff.setDate(cutoff.getDate() - selectedDays)
        return items.filter(item => new Date(item[dateKey]) >= cutoff)
    }

    // 日次集約チャートデータ
    const chartData = useMemo(() => {
        const filteredSales = filterByPeriod(snkrdunkSales, 'sold_at')
        const filteredPurchases = filterByPeriod(purchasePrices, 'created_at')
        const filteredSalePrices = filterByPeriod(salePrices, 'created_at')

        const byDate: Record<string, {
            date: string
            rawDate: string
            psa10_prices: number[]
            box_prices: number[]
            a_prices: number[]
            purchase_prices: number[]
            sale_prices: number[]
        }> = {}

        const ensureDate = (rawDate: string) => {
            const dateStr = new Date(rawDate).toLocaleDateString('sv-SE') // YYYY-MM-DD
            if (!byDate[dateStr]) {
                byDate[dateStr] = {
                    date: new Date(rawDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }),
                    rawDate: dateStr,
                    psa10_prices: [],
                    box_prices: [],
                    a_prices: [],
                    purchase_prices: [],
                    sale_prices: [],
                }
            }
            return byDate[dateStr]
        }

        // スニダン売買履歴を日次集約
        for (const sale of filteredSales) {
            const entry = ensureDate(sale.sold_at)
            if (sale.grade === 'PSA10') {
                entry.psa10_prices.push(sale.price)
            } else if (sale.grade === 'A') {
                entry.a_prices.push(sale.price)
            } else if (sale.grade?.includes('個') || sale.grade?.includes('BOX')) {
                // 「5個」→ 5, 「1BOX」→ 1, 「3BOX」→ 3 のように数量を抽出
                const match = sale.grade.match(/(\d+)/)
                const quantity = match ? parseInt(match[1]) : 1
                // 1BOXあたりの価格に換算
                const pricePerBox = Math.round(sale.price / quantity)
                entry.box_prices.push(pricePerBox)
            }
        }

        // 買取価格を日次集約
        for (const p of filteredPurchases) {
            const entry = ensureDate(p.created_at)
            entry.purchase_prices.push(p.price)
        }

        // 販売価格を日次集約
        for (const s of filteredSalePrices) {
            const entry = ensureDate(s.created_at)
            entry.sale_prices.push(s.price)
        }

        // 平均値を計算
        const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null

        return Object.values(byDate)
            .map(entry => ({
                date: entry.date,
                rawDate: entry.rawDate,
                psa10_avg: avg(entry.psa10_prices),
                box_avg: avg(entry.box_prices),
                a_avg: avg(entry.a_prices),
                purchase_avg: avg(entry.purchase_prices),
                sale_avg: avg(entry.sale_prices),
                psa10_count: entry.psa10_prices.length || null,
                box_count: entry.box_prices.length || null,
                a_count: entry.a_prices.length || null,
                purchase_count: entry.purchase_prices.length || null,
                sale_count: entry.sale_prices.length || null,
            }))
            .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
    }, [snkrdunkSales, purchasePrices, salePrices, selectedDays])

    // データの存在チェック
    const hasPSA10 = chartData.some(d => d.psa10_avg !== null)
    const hasBox = chartData.some(d => d.box_avg !== null)
    const hasA = chartData.some(d => d.a_avg !== null)
    const hasPurchase = chartData.some(d => d.purchase_avg !== null)
    const hasSale = chartData.some(d => d.sale_avg !== null)
    const hasAnyData = hasPSA10 || hasBox || hasA || hasPurchase || hasSale

    // カスタムツールチップ
    const ChartTooltip = ({ active, payload, label }: any) => {
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
                {data?.psa10_count > 0 && <div className="text-xs text-gray-400 mt-1">PSA10: {data.psa10_count}件</div>}
                {data?.a_count > 0 && <div className="text-xs text-gray-400">状態A: {data.a_count}件</div>}
                {data?.box_count > 0 && <div className="text-xs text-gray-400">BOX: {data.box_count}件</div>}
                {data?.purchase_count > 0 && <div className="text-xs text-gray-400">買取: {data.purchase_count}件</div>}
                {data?.sale_count > 0 && <div className="text-xs text-gray-400">販売: {data.sale_count}件</div>}
            </div>
        )
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <RefreshCw size={24} className="animate-spin text-gray-400 mr-2" />
                <span className="text-sm text-gray-500">集計データを読み込み中...</span>
            </div>
        )
    }

    if (!hasAnyData) {
        return (
            <div className="bg-gray-50 rounded-xl p-6 text-center text-gray-500">
                <BarChart3 size={32} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm">売買・買取データがまだありません</p>
                <p className="text-xs text-gray-400 mt-1">スニダン売買履歴や買取価格が登録されると表示されます</p>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* 期間選択 */}
            <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600">期間:</span>
                {PERIOD_OPTIONS.map(option => (
                    <button
                        key={option.label}
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

            {/* グラフ */}
            <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                    <defs>
                        <linearGradient id="psa10Fill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="purchaseFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="saleFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis
                        tick={{ fontSize: 11 }}
                        tickFormatter={(v) => `¥${(v / 1000).toFixed(0)}k`}
                        domain={['auto', 'auto']}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend />

                    {/* PSA10 平均売買価格 */}
                    {hasPSA10 && (
                        <Area
                            type="monotone"
                            dataKey="psa10_avg"
                            stroke="#8b5cf6"
                            strokeWidth={2.5}
                            fill="url(#psa10Fill)"
                            name="PSA10 平均売買"
                            dot={{ r: 3, fill: '#8b5cf6' }}
                            connectNulls
                        />
                    )}

                    {/* 状態A 平均売買価格 */}
                    {hasA && (
                        <Area
                            type="monotone"
                            dataKey="a_avg"
                            stroke="#10b981"
                            strokeWidth={2}
                            fill="transparent"
                            name="状態A 平均売買"
                            dot={{ r: 2, fill: '#10b981' }}
                            connectNulls
                        />
                    )}

                    {/* BOX 平均売買価格 */}
                    {hasBox && (
                        <Area
                            type="monotone"
                            dataKey="box_avg"
                            stroke="#f59e0b"
                            strokeWidth={2}
                            fill="transparent"
                            name="BOX 平均売買"
                            dot={{ r: 2, fill: '#f59e0b' }}
                            connectNulls
                        />
                    )}

                    {/* 平均販売価格 */}
                    {hasSale && (
                        <Area
                            type="monotone"
                            dataKey="sale_avg"
                            stroke="#ef4444"
                            strokeWidth={2}
                            fill="url(#saleFill)"
                            name="平均販売"
                            dot={{ r: 2, fill: '#ef4444' }}
                            connectNulls
                        />
                    )}


                    {/* 平均買取価格 */}
                    {hasPurchase && (
                        <Area
                            type="monotone"
                            dataKey="purchase_avg"
                            stroke="#3b82f6"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            fill="url(#purchaseFill)"
                            name="平均買取"
                            dot={{ r: 2, fill: '#3b82f6' }}
                            connectNulls
                        />
                    )}
                </AreaChart>
            </ResponsiveContainer>
        </div>
    )
}
