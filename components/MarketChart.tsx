'use client'

import { useState, useEffect, useMemo } from 'react'
import {
    ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
    CartesianGrid, Tooltip,
} from 'recharts'
import { BarChart3, RefreshCw } from 'lucide-react'
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

// グレードタブ定義
const GRADE_TABS = [
    { key: 'a', label: '状態A', tradeGrade: 'A', saleGrade: 'A', purchaseLabel: '素体' },
    { key: 'psa10', label: 'PSA10', tradeGrade: 'PSA10', saleGrade: 'PSA10', purchaseLabel: 'PSA10' },
    { key: 'box', label: 'BOX', tradeGrade: 'BOX', saleGrade: 'BOX', purchaseLabel: '未開封' },
]

// 線の色（データ種別ごと）
const LINE_COLORS = {
    trade: '#8b5cf6',    // 紫: スニダン売買
    sale: '#ef4444',     // 赤: 販売最安
    purchase: '#10b981', // 緑: 買取
}

export default function MarketChart({ cardId }: MarketChartProps) {
    const [snkrdunkSales, setSnkrdunkSales] = useState<any[]>([])
    const [purchasePrices, setPurchasePrices] = useState<any[]>([])
    const [salePrices, setSalePrices] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedDays, setSelectedDays] = useState<number | null>(30)
    const [selectedGrade, setSelectedGrade] = useState('a')

    useEffect(() => {
        if (!cardId) return
        fetchData()
    }, [cardId])

    const fetchData = async () => {
        setLoading(true)
        const [salesRes, purchaseRes, saleRes] = await Promise.all([
            supabase
                .from('snkrdunk_sales_history')
                .select('price, grade, sold_at')
                .eq('card_id', cardId)
                .gt('price', 0)
                .order('sold_at', { ascending: true }),
            supabase
                .from('purchase_prices')
                .select('price, stock, created_at, link:link_id(label)')
                .eq('card_id', cardId)
                .gt('price', 0)
                .order('created_at', { ascending: true }),
            supabase
                .from('sale_prices')
                .select('price, grade, created_at')
                .eq('card_id', cardId)
                .gt('price', 0)
                .order('created_at', { ascending: true }),
        ])
        setSnkrdunkSales(salesRes.data || [])
        setPurchasePrices(purchaseRes.data || [])
        setSalePrices(saleRes.data || [])
        setLoading(false)
    }

    // 買取のlabelを正規化
    const normalizePurchaseLabel = (item: any): string => {
        const label = (item.link as any)?.label || ''
        if (label.includes('PSA10') || label.includes('psa10')) return 'PSA10'
        if (label.includes('未開封')) return '未開封'
        if (label.includes('開封')) return '開封'
        return '素体'
    }

    // 選択グレードに応じた日次集約データ
    const chartData = useMemo(() => {
        const tab = GRADE_TABS.find(t => t.key === selectedGrade) || GRADE_TABS[0]
        const cutoff = selectedDays ? new Date(Date.now() - selectedDays * 86400000) : null

        // フィルタ
        const trades = snkrdunkSales.filter((s: any) => {
            if (cutoff && new Date(s.sold_at) < cutoff) return false
            if (tab.key === 'box') {
                return s.grade?.includes('個') || s.grade?.includes('BOX')
            }
            return s.grade === tab.tradeGrade
        })
        const sales = salePrices.filter((s: any) => {
            if (cutoff && new Date(s.created_at) < cutoff) return false
            return s.grade === tab.saleGrade
        })
        const purchases = purchasePrices.filter((p: any) => {
            if (cutoff && new Date(p.created_at) < cutoff) return false
            return normalizePurchaseLabel(p) === tab.purchaseLabel
        })

        // 日次集約
        const byDate: Record<string, {
            date: string; rawDate: string
            trade: number[]; sale: number[]; purchase: number[]
        }> = {}

        const ensureDate = (rawDate: string) => {
            const dateStr = new Date(rawDate).toLocaleDateString('sv-SE')
            if (!byDate[dateStr]) {
                byDate[dateStr] = {
                    date: new Date(rawDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }),
                    rawDate: dateStr,
                    trade: [], sale: [], purchase: [],
                }
            }
            return byDate[dateStr]
        }

        for (const t of trades) {
            const entry = ensureDate(t.sold_at)
            if (tab.key === 'box') {
                const match = t.grade?.match(/(\d+)/)
                const qty = match ? parseInt(match[1]) : 1
                entry.trade.push(Math.round(t.price / qty))
            } else {
                entry.trade.push(t.price)
            }
        }
        for (const s of sales) {
            ensureDate(s.created_at).sale.push(s.price)
        }
        for (const p of purchases) {
            ensureDate(p.created_at).purchase.push(p.price)
        }

        const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null
        const min = (arr: number[]) => arr.length > 0 ? Math.min(...arr) : null

        return Object.values(byDate)
            .map(e => ({
                date: e.date,
                rawDate: e.rawDate,
                trade: avg(e.trade),
                sale: min(e.sale),     // 販売は最安値
                purchase: avg(e.purchase),
            }))
            .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
    }, [snkrdunkSales, purchasePrices, salePrices, selectedDays, selectedGrade])

    const hasTrade = chartData.some(d => d.trade !== null)
    const hasSale = chartData.some(d => d.sale !== null)
    const hasPurchase = chartData.some(d => d.purchase !== null)
    const hasAnyData = hasTrade || hasSale || hasPurchase

    if (loading) {
        return (
            <div className="flex items-center justify-center py-8">
                <RefreshCw size={20} className="animate-spin text-gray-400 mr-2" />
                <span className="text-sm text-gray-500">読み込み中...</span>
            </div>
        )
    }

    if (snkrdunkSales.length === 0 && purchasePrices.length === 0 && salePrices.length === 0) {
        return (
            <div className="bg-gray-50 rounded-xl p-6 text-center text-gray-500">
                <BarChart3 size={32} className="mx-auto mb-2 text-gray-300" />
                <p className="text-sm">日次推移データがまだありません</p>
                <p className="text-xs text-gray-400 mt-1">売買履歴や買取価格が登録されると表示されます</p>
            </div>
        )
    }

    return (
        <div className="space-y-3">
            {/* グレードタブ + 期間選択 */}
            <div className="flex items-center justify-between gap-2">
                <div className="flex gap-1">
                    {GRADE_TABS.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setSelectedGrade(tab.key)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                selectedGrade === tab.key
                                    ? 'bg-gray-800 text-white'
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
                <div className="flex gap-1">
                    {PERIOD_OPTIONS.map(option => (
                        <button
                            key={option.label}
                            onClick={() => setSelectedDays(option.days)}
                            className={`px-2 py-1 rounded-lg text-xs transition-colors ${
                                selectedDays === option.days
                                    ? 'bg-blue-100 text-blue-700'
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                            }`}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 凡例 */}
            <div className="flex gap-4 text-xs text-gray-500">
                {hasTrade && (
                    <span className="flex items-center gap-1">
                        <span className="w-3 h-0.5 inline-block rounded" style={{ backgroundColor: LINE_COLORS.trade }} />
                        売買平均
                    </span>
                )}
                {hasSale && (
                    <span className="flex items-center gap-1">
                        <span className="w-3 h-0.5 inline-block rounded" style={{ backgroundColor: LINE_COLORS.sale }} />
                        販売最安
                    </span>
                )}
                {hasPurchase && (
                    <span className="flex items-center gap-1">
                        <span className="w-3 h-0.5 inline-block rounded" style={{ backgroundColor: LINE_COLORS.purchase }} />
                        買取
                    </span>
                )}
            </div>

            {/* グラフ */}
            {hasAnyData ? (
                <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                        <defs>
                            <linearGradient id="tradeFill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor={LINE_COLORS.trade} stopOpacity={0.12} />
                                <stop offset="95%" stopColor={LINE_COLORS.trade} stopOpacity={0.01} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} />
                        <YAxis
                            tick={{ fontSize: 10, fill: '#9ca3af' }}
                            tickLine={false}
                            axisLine={false}
                            tickFormatter={v => `¥${(v / 1000).toFixed(0)}k`}
                            width={45}
                        />
                        <Tooltip
                            content={({ active, payload, label }) => {
                                if (!active || !payload?.length) return null
                                return (
                                    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-2 text-xs">
                                        <p className="font-medium text-gray-600 mb-1">{label}</p>
                                        {payload.map((entry: any, i: number) => (
                                            entry.value != null && (
                                                <p key={i} style={{ color: entry.color }}>
                                                    {entry.name} ¥{entry.value.toLocaleString()}
                                                </p>
                                            )
                                        ))}
                                    </div>
                                )
                            }}
                        />
                        {hasTrade && (
                            <Area
                                type="monotone"
                                dataKey="trade"
                                stroke={LINE_COLORS.trade}
                                strokeWidth={2}
                                fill="url(#tradeFill)"
                                name="売買平均"
                                dot={false}
                                connectNulls
                            />
                        )}
                        {hasSale && (
                            <Area
                                type="monotone"
                                dataKey="sale"
                                stroke={LINE_COLORS.sale}
                                strokeWidth={1.5}
                                strokeDasharray="4 3"
                                fill="transparent"
                                name="販売最安"
                                dot={false}
                                connectNulls
                            />
                        )}
                        {hasPurchase && (
                            <Area
                                type="monotone"
                                dataKey="purchase"
                                stroke={LINE_COLORS.purchase}
                                strokeWidth={1.5}
                                strokeDasharray="6 3"
                                fill="transparent"
                                name="買取"
                                dot={false}
                                connectNulls
                            />
                        )}
                    </AreaChart>
                </ResponsiveContainer>
            ) : (
                <div className="bg-gray-50 rounded-xl p-6 text-center text-gray-400 text-sm">
                    このグレードのデータがありません
                </div>
            )}
        </div>
    )
}
