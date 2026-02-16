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

// カラー定義
const COLORS = {
    // スニダン売買履歴（実線・エリア）
    psa10_trade: '#8b5cf6',    // 紫
    a_trade: '#10b981',        // 緑
    box_trade: '#f59e0b',      // オレンジ
    // 販売最安値（点線）
    psa10_sale: '#c084fc',     // 薄紫
    a_sale: '#6ee7b7',         // 薄緑
    box_sale: '#fcd34d',       // 薄オレンジ
    // 買取価格（破線）
    purchase_normal: '#3b82f6', // 青（素体）
    purchase_psa10: '#6366f1',  // インディゴ（PSA10）
    purchase_sealed: '#ec4899', // ピンク（未開封）
    purchase_opened: '#14b8a6', // ティール（開封）
}

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

        // 買取価格を取得（link経由でlabelを取得）
        const { data: purchaseData } = await supabase
            .from('purchase_prices')
            .select('price, stock, created_at, link:link_id(label)')
            .eq('card_id', cardId)
            .gt('price', 0)
            .order('created_at', { ascending: true })

        // 販売価格を取得（grade付き）
        const { data: saleData } = await supabase
            .from('sale_prices')
            .select('price, grade, created_at')
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

    // 買取のlabelを正規化
    const normalizePurchaseLabel = (item: any): string => {
        const label = (item.link as any)?.label || ''
        if (label.includes('PSA10') || label.includes('psa10')) return 'PSA10'
        if (label.includes('未開封')) return '未開封'
        if (label.includes('開封')) return '開封'
        return '素体'
    }

    // 日次集約チャートデータ
    const chartData = useMemo(() => {
        const filteredSales = filterByPeriod(snkrdunkSales, 'sold_at')
        const filteredPurchases = filterByPeriod(purchasePrices, 'created_at')
        const filteredSalePrices = filterByPeriod(salePrices, 'created_at')

        const byDate: Record<string, {
            date: string
            rawDate: string
            // スニダン売買履歴
            psa10_trade: number[]
            a_trade: number[]
            box_trade: number[]
            // 販売最安値
            psa10_sale: number[]
            a_sale: number[]
            box_sale: number[]
            // 買取価格（状態別）
            purchase_normal: number[]
            purchase_psa10: number[]
            purchase_sealed: number[]
            purchase_opened: number[]
        }> = {}

        const ensureDate = (rawDate: string) => {
            const dateStr = new Date(rawDate).toLocaleDateString('sv-SE')
            if (!byDate[dateStr]) {
                byDate[dateStr] = {
                    date: new Date(rawDate).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }),
                    rawDate: dateStr,
                    psa10_trade: [], a_trade: [], box_trade: [],
                    psa10_sale: [], a_sale: [], box_sale: [],
                    purchase_normal: [], purchase_psa10: [],
                    purchase_sealed: [], purchase_opened: [],
                }
            }
            return byDate[dateStr]
        }

        // スニダン売買履歴を日次集約
        for (const sale of filteredSales) {
            const entry = ensureDate(sale.sold_at)
            if (sale.grade === 'PSA10') {
                entry.psa10_trade.push(sale.price)
            } else if (sale.grade === 'A') {
                entry.a_trade.push(sale.price)
            } else if (sale.grade?.includes('個') || sale.grade?.includes('BOX')) {
                const match = sale.grade.match(/(\d+)/)
                const quantity = match ? parseInt(match[1]) : 1
                entry.box_trade.push(Math.round(sale.price / quantity))
            }
        }

        // 販売最安値を日次集約（grade別）
        for (const s of filteredSalePrices) {
            const entry = ensureDate(s.created_at)
            if (s.grade === 'PSA10') {
                entry.psa10_sale.push(s.price)
            } else if (s.grade === 'A') {
                entry.a_sale.push(s.price)
            } else if (s.grade === 'BOX') {
                entry.box_sale.push(s.price)
            }
        }

        // 買取価格を日次集約（状態別）
        for (const p of filteredPurchases) {
            const entry = ensureDate(p.created_at)
            const label = normalizePurchaseLabel(p)
            if (label === 'PSA10') {
                entry.purchase_psa10.push(p.price)
            } else if (label === '未開封') {
                entry.purchase_sealed.push(p.price)
            } else if (label === '開封') {
                entry.purchase_opened.push(p.price)
            } else {
                entry.purchase_normal.push(p.price)
            }
        }

        const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null

        return Object.values(byDate)
            .map(entry => ({
                date: entry.date,
                rawDate: entry.rawDate,
                // 売買履歴
                psa10_trade: avg(entry.psa10_trade),
                a_trade: avg(entry.a_trade),
                box_trade: avg(entry.box_trade),
                // 販売最安値
                psa10_sale: avg(entry.psa10_sale),
                a_sale: avg(entry.a_sale),
                box_sale: avg(entry.box_sale),
                // 買取価格
                purchase_normal: avg(entry.purchase_normal),
                purchase_psa10: avg(entry.purchase_psa10),
                purchase_sealed: avg(entry.purchase_sealed),
                purchase_opened: avg(entry.purchase_opened),
            }))
            .sort((a, b) => a.rawDate.localeCompare(b.rawDate))
    }, [snkrdunkSales, purchasePrices, salePrices, selectedDays])

    // データの存在チェック
    const hasPSA10Trade = chartData.some(d => d.psa10_trade !== null)
    const hasATrade = chartData.some(d => d.a_trade !== null)
    const hasBoxTrade = chartData.some(d => d.box_trade !== null)
    const hasPSA10Sale = chartData.some(d => d.psa10_sale !== null)
    const hasASale = chartData.some(d => d.a_sale !== null)
    const hasBoxSale = chartData.some(d => d.box_sale !== null)
    const hasPurchaseNormal = chartData.some(d => d.purchase_normal !== null)
    const hasPurchasePSA10 = chartData.some(d => d.purchase_psa10 !== null)
    const hasPurchaseSealed = chartData.some(d => d.purchase_sealed !== null)
    const hasPurchaseOpened = chartData.some(d => d.purchase_opened !== null)
    const hasAnyData = hasPSA10Trade || hasATrade || hasBoxTrade ||
        hasPSA10Sale || hasASale || hasBoxSale ||
        hasPurchaseNormal || hasPurchasePSA10 || hasPurchaseSealed || hasPurchaseOpened

    // カスタムツールチップ
    const ChartTooltip = ({ active, payload, label }: any) => {
        if (!active || !payload || !payload.length) return null
        return (
            <div className="bg-white border rounded-lg shadow-lg p-3 text-sm max-w-xs">
                <p className="font-medium text-gray-700 mb-2">{label}</p>
                {payload.map((entry: any, index: number) => (
                    entry.value !== null && entry.value !== undefined && (
                        <div key={index} className="flex items-center gap-2">
                            <span style={{ color: entry.color }}>●</span>
                            <span className="truncate">{entry.name}: ¥{entry.value?.toLocaleString()}</span>
                        </div>
                    )
                ))}
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

            {/* 凡例 */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
                {hasPSA10Trade && <span><span style={{ color: COLORS.psa10_trade }}>━</span> PSA10 売買</span>}
                {hasATrade && <span><span style={{ color: COLORS.a_trade }}>━</span> 状態A 売買</span>}
                {hasBoxTrade && <span><span style={{ color: COLORS.box_trade }}>━</span> BOX 売買</span>}
                {hasPSA10Sale && <span><span style={{ color: COLORS.psa10_sale }}>┅</span> PSA10 販売最安</span>}
                {hasASale && <span><span style={{ color: COLORS.a_sale }}>┅</span> 状態A 販売最安</span>}
                {hasBoxSale && <span><span style={{ color: COLORS.box_sale }}>┅</span> BOX 販売最安</span>}
                {hasPurchaseNormal && <span><span style={{ color: COLORS.purchase_normal }}>- -</span> 素体 買取</span>}
                {hasPurchasePSA10 && <span><span style={{ color: COLORS.purchase_psa10 }}>- -</span> PSA10 買取</span>}
                {hasPurchaseSealed && <span><span style={{ color: COLORS.purchase_sealed }}>- -</span> 未開封 買取</span>}
                {hasPurchaseOpened && <span><span style={{ color: COLORS.purchase_opened }}>- -</span> 開封 買取</span>}
            </div>

            {/* グラフ */}
            <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={chartData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                    <defs>
                        <linearGradient id="psa10Fill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={COLORS.psa10_trade} stopOpacity={0.15} />
                            <stop offset="95%" stopColor={COLORS.psa10_trade} stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="aFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={COLORS.a_trade} stopOpacity={0.1} />
                            <stop offset="95%" stopColor={COLORS.a_trade} stopOpacity={0.02} />
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

                    {/* === スニダン売買履歴（実線・エリア） === */}
                    {hasPSA10Trade && (
                        <Area type="monotone" dataKey="psa10_trade" stroke={COLORS.psa10_trade} strokeWidth={2.5}
                            fill="url(#psa10Fill)" name="PSA10 売買"
                            dot={{ r: 5, fill: COLORS.psa10_trade, stroke: '#fff', strokeWidth: 2 }}
                            activeDot={{ r: 7, fill: COLORS.psa10_trade, stroke: '#fff', strokeWidth: 2 }}
                            connectNulls />
                    )}
                    {hasATrade && (
                        <Area type="monotone" dataKey="a_trade" stroke={COLORS.a_trade} strokeWidth={2}
                            fill="url(#aFill)" name="状態A 売買"
                            dot={{ r: 4, fill: COLORS.a_trade, stroke: '#fff', strokeWidth: 2 }}
                            activeDot={{ r: 7, fill: COLORS.a_trade, stroke: '#fff', strokeWidth: 2 }}
                            connectNulls />
                    )}
                    {hasBoxTrade && (
                        <Area type="monotone" dataKey="box_trade" stroke={COLORS.box_trade} strokeWidth={2}
                            fill="transparent" name="BOX 売買"
                            dot={{ r: 4, fill: COLORS.box_trade, stroke: '#fff', strokeWidth: 2 }}
                            activeDot={{ r: 7, fill: COLORS.box_trade, stroke: '#fff', strokeWidth: 2 }}
                            connectNulls />
                    )}

                    {/* === 販売最安値（点線） === */}
                    {hasPSA10Sale && (
                        <Area type="monotone" dataKey="psa10_sale" stroke={COLORS.psa10_sale} strokeWidth={2}
                            strokeDasharray="3 3" fill="transparent" name="PSA10 販売最安"
                            dot={{ r: 4, fill: COLORS.psa10_sale, stroke: '#fff', strokeWidth: 2 }}
                            activeDot={{ r: 7, fill: COLORS.psa10_sale, stroke: '#fff', strokeWidth: 2 }}
                            connectNulls />
                    )}
                    {hasASale && (
                        <Area type="monotone" dataKey="a_sale" stroke={COLORS.a_sale} strokeWidth={2}
                            strokeDasharray="3 3" fill="transparent" name="状態A 販売最安"
                            dot={{ r: 4, fill: COLORS.a_sale, stroke: '#fff', strokeWidth: 2 }}
                            activeDot={{ r: 7, fill: COLORS.a_sale, stroke: '#fff', strokeWidth: 2 }}
                            connectNulls />
                    )}
                    {hasBoxSale && (
                        <Area type="monotone" dataKey="box_sale" stroke={COLORS.box_sale} strokeWidth={2}
                            strokeDasharray="3 3" fill="transparent" name="BOX 販売最安"
                            dot={{ r: 4, fill: COLORS.box_sale, stroke: '#fff', strokeWidth: 2 }}
                            activeDot={{ r: 7, fill: COLORS.box_sale, stroke: '#fff', strokeWidth: 2 }}
                            connectNulls />
                    )}

                    {/* === 買取価格（破線） === */}
                    {hasPurchaseNormal && (
                        <Area type="monotone" dataKey="purchase_normal" stroke={COLORS.purchase_normal} strokeWidth={2}
                            strokeDasharray="8 4" fill="transparent" name="素体 買取"
                            dot={{ r: 4, fill: COLORS.purchase_normal, stroke: '#fff', strokeWidth: 2 }}
                            activeDot={{ r: 7, fill: COLORS.purchase_normal, stroke: '#fff', strokeWidth: 2 }}
                            connectNulls />
                    )}
                    {hasPurchasePSA10 && (
                        <Area type="monotone" dataKey="purchase_psa10" stroke={COLORS.purchase_psa10} strokeWidth={2}
                            strokeDasharray="8 4" fill="transparent" name="PSA10 買取"
                            dot={{ r: 4, fill: COLORS.purchase_psa10, stroke: '#fff', strokeWidth: 2 }}
                            activeDot={{ r: 7, fill: COLORS.purchase_psa10, stroke: '#fff', strokeWidth: 2 }}
                            connectNulls />
                    )}
                    {hasPurchaseSealed && (
                        <Area type="monotone" dataKey="purchase_sealed" stroke={COLORS.purchase_sealed} strokeWidth={2}
                            strokeDasharray="8 4" fill="transparent" name="未開封 買取"
                            dot={{ r: 4, fill: COLORS.purchase_sealed, stroke: '#fff', strokeWidth: 2 }}
                            activeDot={{ r: 7, fill: COLORS.purchase_sealed, stroke: '#fff', strokeWidth: 2 }}
                            connectNulls />
                    )}
                    {hasPurchaseOpened && (
                        <Area type="monotone" dataKey="purchase_opened" stroke={COLORS.purchase_opened} strokeWidth={2}
                            strokeDasharray="8 4" fill="transparent" name="開封 買取"
                            dot={{ r: 4, fill: COLORS.purchase_opened, stroke: '#fff', strokeWidth: 2 }}
                            activeDot={{ r: 7, fill: COLORS.purchase_opened, stroke: '#fff', strokeWidth: 2 }}
                            connectNulls />
                    )}
                </AreaChart>
            </ResponsiveContainer>
        </div>
    )
}
