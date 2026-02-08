'use client'

import { useState, useEffect } from 'react'
import PosLayout from '@/components/pos/PosLayout'
import { getTransactions } from '@/lib/pos/api'
import { formatPrice } from '@/lib/pos/constants'
import type { PosTransaction } from '@/lib/pos/types'

export default function HistoryPage() {
    const [transactions, setTransactions] = useState<PosTransaction[]>([])
    const [filter, setFilter] = useState('all')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        getTransactions({ type: filter === 'all' ? undefined : filter, limit: 100 })
            .then(res => setTransactions(res.data))
            .catch(console.error)
            .finally(() => setLoading(false))
    }, [filter])

    return (
        <PosLayout>
            <h2 className="text-lg font-bold text-gray-800 mb-4">📜 取引履歴</h2>

            <div className="flex gap-2 mb-4">
                {[
                    { key: 'all', label: 'すべて' },
                    { key: 'purchase', label: '仕入れ' },
                    { key: 'sale', label: '販売' },
                ].map(f => (
                    <button
                        key={f.key}
                        onClick={() => { setFilter(f.key); setLoading(true) }}
                        className={`px-3 py-1.5 rounded-full text-xs ${filter === f.key ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500'
                            }`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>

            {loading ? (
                <div className="py-12 text-center">
                    <div className="inline-block w-8 h-8 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
                </div>
            ) : (
                <div className="space-y-2">
                    {transactions.length > 0 ? transactions.map(t => (
                        <div key={t.id} className="bg-white rounded-lg border border-gray-100 px-3 py-3 flex items-center justify-between">
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
                                        {t.inventory?.condition || '-'} × {t.quantity} / {t.transaction_date}
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
                                {t.notes && (
                                    <p className="text-[10px] text-gray-400 truncate max-w-[120px]">{t.notes}</p>
                                )}
                            </div>
                        </div>
                    )) : (
                        <p className="text-sm text-gray-400 text-center py-8">取引データがありません</p>
                    )}
                </div>
            )}
        </PosLayout>
    )
}
