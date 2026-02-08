'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { RefreshCw, AlertCircle, CheckCircle, Clock } from 'lucide-react'

export default function SnkrdunkMonitorPage() {
    const [monitorData, setMonitorData] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [filter, setFilter] = useState<'all' | 'monitoring' | 'error'>('all')

    useEffect(() => {
        fetchMonitorData()
    }, [])

    const fetchMonitorData = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('card_sale_urls')
                .select('*, site:site_id(id, name, icon), card:card_id(id, name, image_url)')
                .order('last_scraped_at', { ascending: false, nullsFirst: false })

            if (error) throw error

            // スニダンのURLのみフィルタ
            const snkrdunkData = (data || []).filter((item: any) =>
                item.site?.name?.includes('スニダン') ||
                item.site?.name?.includes('スニーカーダンク') ||
                item.site?.name?.toLowerCase().includes('snkrdunk') ||
                item.product_url?.includes('snkrdunk.com')
            )

            setMonitorData(snkrdunkData)
        } catch (error: any) {
            console.error('Failed to fetch monitor data:', error)
            alert('エラー: ' + error.message)
        } finally {
            setLoading(false)
        }
    }

    const filteredData = monitorData.filter(item => {
        if (filter === 'monitoring') return item.auto_scrape_mode !== 'off'
        if (filter === 'error') return item.last_scrape_status === 'error'
        return true
    })

    const formatRelativeTime = (dateStr: string | null) => {
        if (!dateStr) return '-'
        const date = new Date(dateStr)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)

        if (diffMins < 60) return `${diffMins}分前`
        const diffHours = Math.floor(diffMins / 60)
        if (diffHours < 24) return `${diffHours}時間前`
        const diffDays = Math.floor(diffHours / 24)
        return `${diffDays}日前`
    }

    const getModeLabel = (mode: string | null) => {
        if (mode === 'off') return '停止'
        if (mode === 'manual') return '手動設定'
        if (mode === 'auto') return 'オートメーション'
        return '未設定'
    }

    const getStatusIcon = (status: string | null) => {
        if (status === 'success') return <CheckCircle size={16} className="text-green-500" />
        if (status === 'error') return <AlertCircle size={16} className="text-red-500" />
        return <Clock size={16} className="text-gray-400" />
    }

    return (
        <div>
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">スニダン監視状況</h2>
                    <p className="text-sm text-gray-500 mt-1">自動スクレイピングの状況を確認できます</p>
                </div>
                <button
                    onClick={fetchMonitorData}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
                >
                    <RefreshCw size={16} />
                    更新
                </button>
            </div>

            {/* フィルタ */}
            <div className="flex gap-2 mb-4">
                <button
                    onClick={() => setFilter('all')}
                    className={`px-4 py-2 rounded-lg text-sm transition-colors ${filter === 'all'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                >
                    全て ({monitorData.length})
                </button>
                <button
                    onClick={() => setFilter('monitoring')}
                    className={`px-4 py-2 rounded-lg text-sm transition-colors ${filter === 'monitoring'
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                >
                    監視中 ({monitorData.filter(item => item.auto_scrape_mode !== 'off').length})
                </button>
                <button
                    onClick={() => setFilter('error')}
                    className={`px-4 py-2 rounded-lg text-sm transition-colors ${filter === 'error'
                        ? 'bg-red-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                >
                    エラー ({monitorData.filter(item => item.last_scrape_status === 'error').length})
                </button>
            </div>

            {/* テーブル */}
            {loading ? (
                <div className="flex items-center justify-center py-12">
                    <RefreshCw className="animate-spin text-blue-500" size={32} />
                </div>
            ) : filteredData.length > 0 ? (
                <div className="bg-white border rounded-xl overflow-hidden">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="text-left px-4 py-3 text-sm font-medium text-gray-700">カード</th>
                                <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">モード</th>
                                <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">間隔</th>
                                <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">ステータス</th>
                                <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">最終更新</th>
                                <th className="text-center px-4 py-3 text-sm font-medium text-gray-700">次回更新</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y">
                            {filteredData.map((item) => (
                                <tr key={item.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            {item.card?.image_url ? (
                                                <img
                                                    src={item.card.image_url}
                                                    alt={item.card.name}
                                                    className="w-12 h-16 object-cover rounded"
                                                />
                                            ) : (
                                                <div className="w-12 h-16 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">
                                                    No Image
                                                </div>
                                            )}
                                            <div>
                                                <p className="font-medium text-gray-800">{item.card?.name || 'Unknown'}</p>
                                                <p className="text-xs text-gray-500">{item.site?.name || 'Unknown'}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <span
                                            className={`px-2 py-1 rounded text-xs font-medium ${item.auto_scrape_mode === 'off'
                                                ? 'bg-gray-100 text-gray-600'
                                                : item.auto_scrape_mode === 'manual'
                                                    ? 'bg-blue-100 text-blue-700'
                                                    : item.auto_scrape_mode === 'auto'
                                                        ? 'bg-purple-100 text-purple-700'
                                                        : 'bg-gray-100 text-gray-400'
                                                }`}
                                        >
                                            {getModeLabel(item.auto_scrape_mode)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm text-gray-600">
                                        {item.auto_scrape_mode === 'manual' && item.auto_scrape_interval_minutes
                                            ? `${item.auto_scrape_interval_minutes}分`
                                            : '-'}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-center gap-2">
                                            {getStatusIcon(item.last_scrape_status)}
                                            {item.last_scrape_status === 'error' && item.last_scrape_error && (
                                                <span className="text-xs text-red-600 max-w-[200px] truncate" title={item.last_scrape_error}>
                                                    {item.last_scrape_error}
                                                </span>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm text-gray-600">
                                        {item.last_scraped_at ? (
                                            <div>
                                                <p>{new Date(item.last_scraped_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                                                <p className="text-xs text-gray-400">{formatRelativeTime(item.last_scraped_at)}</p>
                                            </div>
                                        ) : (
                                            '-'
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-center text-sm text-gray-600">
                                        {item.next_scrape_at && item.auto_scrape_mode !== 'off' ? (
                                            <div>
                                                <p>{new Date(item.next_scrape_at).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                                                <p className="text-xs text-gray-400">{formatRelativeTime(item.next_scrape_at)}</p>
                                            </div>
                                        ) : (
                                            '-'
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-500">
                    <p>データがありません</p>
                </div>
            )}
        </div>
    )
}
