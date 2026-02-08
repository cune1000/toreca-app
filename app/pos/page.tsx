'use client'

import { useState, useEffect } from 'react'
import PosLayout from '@/components/pos/PosLayout'
import { getStats, getTransactions } from '@/lib/pos/api'
import { formatPrice } from '@/lib/pos/constants'
import type { PosStats, PosTransaction } from '@/lib/pos/types'

function StatCard({ icon, label, value, sub, color }: {
    icon: string; label: string; value: string; sub?: string; color?: string
}) {
    return (
        <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{icon}</span>
                <span className="text-xs text-gray-400">{label}</span>
            </div>
            <p className={`text-xl font-bold ${color || 'text-gray-900'}`}>{value}</p>
            {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
        </div>
    )
}

export default function PosDashboard() {
    const [stats, setStats] = useState<PosStats | null>(null)
    const [recentTx, setRecentTx] = useState<PosTransaction[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function load() {
            try {
                const [statsRes, txRes] = await Promise.all([
                    getStats(),
                    getTransactions({ limit: 5 }),
                ])
                setStats(statsRes.data)
                setRecentTx(txRes.data)
            } catch (err) {
                console.error('Dashboard load error:', err)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [])

    const profitRate = stats && stats.totalCost > 0
        ? Math.round((stats.estimatedProfit / stats.totalCost) * 100)
        : 0

    return (
        <PosLayout>
            <h2 className="text-lg font-bold text-gray-800 mb-4">📊 ダッシュボード</h2>

            {loading ? (
                <div className="py-12 text-center">
                    <div className="inline-block w-8 h-8 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
                </div>
            ) : stats ? (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                        <StatCard icon="📦" label="在庫総数" value={`${stats.totalItems}点`} sub={`${stats.totalKinds}種類`} />
                        <StatCard icon="💴" label="在庫総額" value={formatPrice(stats.totalCost)} sub="仕入れベース" />
                        <StatCard icon="📈" label="利益見込み" value={formatPrice(stats.estimatedProfit)} color="text-green-600" sub="販売価格ベース" />
                        <StatCard icon="💹" label="利益率" value={`${profitRate}%`} color="text-amber-600" />
                    </div>

                    <div className="grid grid-cols-3 gap-3 mb-6">
                        <StatCard icon="💰" label="本日の仕入れ" value={formatPrice(stats.todayPurchase)} />
                        <StatCard icon="🛒" label="本日の売上" value={formatPrice(stats.todaySale)} />
                        <StatCard icon="✨" label="本日の利益" value={formatPrice(stats.todayProfit)} color="text-green-600" />
                    </div>

                    {/* 最近の取引 */}
                    <h3 className="text-sm font-bold text-gray-700 mb-2">🕐 最近の取引</h3>
                    <div className="space-y-2">
                        {recentTx.length > 0 ? recentTx.map(t => (
                            <div key={t.id} className="bg-white rounded-lg border border-gray-100 px-3 py-2.5 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.type === 'purchase' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'
                                        }`}>
                                        {t.type === 'purchase' ? '仕入' : '販売'}
                                    </span>
                                    <div>
                                        <p className="text-sm font-medium text-gray-800">
                                            {t.inventory?.catalog?.name || '-'}
                                        </p>
                                        <p className="text-[10px] text-gray-400">
                                            ×{t.quantity} / {t.transaction_date}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-gray-900">{formatPrice(t.total_price)}</p>
                                    {t.profit != null && t.profit !== 0 && (
                                        <p className={`text-[10px] font-medium ${t.profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                            利益 {formatPrice(t.profit)}
                                        </p>
                                    )}
                                </div>
                            </div>
                        )) : (
                            <p className="text-sm text-gray-400 text-center py-8">取引データがありません</p>
                        )}
                    </div>
                </>
            ) : (
                <p className="text-sm text-gray-400 text-center py-8">データの読み込みに失敗しました</p>
            )}
        </PosLayout>
    )
}
