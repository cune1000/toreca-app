'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, Play, Clock, AlertCircle, CheckCircle } from 'lucide-react'

interface CronJob {
    id: string
    job_name: string
    display_name: string
    enabled: boolean
    schedule_type: string
    last_run_at: string | null
    last_status: string | null
    last_error: string | null
}

// Vercelに登録されているCronジョブのパス一覧（vercel.jsonから抽出）
const VERCEL_CRONS = [
    { path: '/api/cron/snkrdunk-sync', schedule: '*/5 * * * *', name: 'スニダン相場同期' },
    { path: '/api/twitter/monitor', schedule: '*/5 * * * *', name: 'X(Twitter) 監視' },
    { path: '/api/cron/daily-price-aggregate', schedule: '0 22 * * *', name: '日次相場集計' },
    { path: '/api/cron/shinsoku-sync', schedule: '0 2,4,13 * * *', name: '神息 在庫同期' },
    { path: '/api/cron/shinsoku', schedule: '30 2,4,13 * * *', name: '神息 オリパ同期' },
    { path: '/api/cron/lounge-cache', schedule: '0 2,4,13 * * *', name: 'トレカラウンジ キャッシュ' },
    { path: '/api/cron/toreca-lounge', schedule: '30 2,4,13 * * *', name: 'トレカラウンジ オリパ同期' },
    { path: '/api/cron/exchange-rate-sync', schedule: '55 17 * * *', name: '為替レート同期(USD/JPY)' },
    { path: '/api/cron/overseas-price-sync', schedule: '0 18 * * *', name: 'PriceCharting海外価格同期' },
    { path: '/api/cron/snkrdunk-items-sync', schedule: '0 */6 * * *', name: 'スニダン新規カード取得' }
]

export default function CronDashboard() {
    const [jobs, setJobs] = useState<CronJob[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState('')
    const [triggering, setTriggering] = useState<Record<string, boolean>>({})
    const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date())

    const fetchJobs = async () => {
        setLoading(true)
        setError('')
        try {
            const res = await fetch('/api/admin/cron')
            const json = await res.json()
            if (json.success) {
                setJobs(json.data)
            } else {
                setError(json.error || 'Failed to fetch jobs')
            }
        } catch (e: any) {
            setError(e.message)
        } finally {
            setLoading(false)
            setLastRefreshed(new Date())
        }
    }

    useEffect(() => {
        fetchJobs()
        // Auto refresh every 30 seconds
        const interval = setInterval(fetchJobs, 30000)
        return () => clearInterval(interval)
    }, [])

    const handleTrigger = async (path: string) => {
        if (triggering[path]) return
        if (!confirm(`Are you sure you want to manually trigger this cron job?\nPath: ${path}\n\nWarning: This will execute the background process immediately and may take some time depending on the job.`)) return

        setTriggering(prev => ({ ...prev, [path]: true }))
        try {
            const res = await fetch('/api/admin/cron', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ path })
            })
            const json = await res.json()
            if (json.success) {
                alert(`Success!\n\n${JSON.stringify(json.result, null, 2)}`)
                fetchJobs() // Refresh status
            } else {
                alert(`Error triggering job:\n${json.error}`)
            }
        } catch (e: any) {
            alert(`Network error:\n${e.message}`)
        } finally {
            setTriggering(prev => ({ ...prev, [path]: false }))
        }
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600">
                        Cron Monitoring Dashboard
                    </h1>
                    <p className="text-sm text-gray-500 mt-1">Manage and monitor background scheduled tasks</p>
                </div>
                <div className="flex items-center gap-4">
                    <span className="text-xs text-gray-400 font-mono">
                        Last Updated: {lastRefreshed.toLocaleTimeString('ja-JP')}
                    </span>
                    <button
                        onClick={fetchJobs}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 shadow-sm rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors text-sm font-medium"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg flex items-start gap-3">
                    <AlertCircle size={20} className="shrink-0 mt-0.5" />
                    <div className="text-sm font-medium">{error}</div>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-600">
                            <tr>
                                <th className="px-6 py-4 font-semibold">Job Name / Endpoint</th>
                                <th className="px-6 py-4 font-semibold">Schedule</th>
                                <th className="px-6 py-4 font-semibold">Last Execution</th>
                                <th className="px-6 py-4 font-semibold">Status</th>
                                <th className="px-6 py-4 font-semibold text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {VERCEL_CRONS.map((vCron, idx) => {
                                // job_name varies, we try to match it based on path
                                const dbJob = jobs.find(j =>
                                    vCron.path.includes(j.job_name) ||
                                    j.job_name.includes(vCron.path.replace('/api/cron/', '').replace('/api/', ''))
                                )

                                const isManualTriggering = triggering[vCron.path]

                                return (
                                    <tr key={idx} className="hover:bg-blue-50/30 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-gray-900">{vCron.name || dbJob?.display_name || vCron.path}</div>
                                            <div className="text-xs text-blue-600/80 font-mono mt-0.5" title="Endpoint URL">
                                                {vCron.path}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">
                                            <div className="flex items-center gap-1.5 font-mono text-xs bg-gray-100 px-2 py-1 rounded w-fit">
                                                <Clock size={12} className="text-gray-400" />
                                                {vCron.schedule}
                                            </div>
                                            {dbJob && !dbJob.enabled && (
                                                <span className="text-[10px] font-bold text-red-500 mt-1 block px-1">GATED: DISABLED</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {dbJob?.last_run_at ? (
                                                <div className="flex flex-col">
                                                    <span className="text-gray-900">
                                                        {new Date(dbJob.last_run_at).toLocaleString('ja-JP', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                    </span>
                                                    <span className="text-xs text-gray-400 mt-0.5">
                                                        {formatRelativeTime(new Date(dbJob.last_run_at))}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-400 italic font-mono text-xs">No execution record</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            {dbJob?.last_status === 'success' ? (
                                                <div className="flex items-center gap-1.5 text-green-600 bg-green-50 px-2.5 py-1 rounded-full w-fit">
                                                    <CheckCircle size={14} />
                                                    <span className="text-xs font-bold leading-none">SUCCESS</span>
                                                </div>
                                            ) : dbJob?.last_status === 'error' ? (
                                                <div className="flex flex-col gap-1 max-w-[200px]">
                                                    <div className="flex items-center gap-1.5 text-red-600 bg-red-50 px-2.5 py-1 rounded-full w-fit">
                                                        <AlertCircle size={14} />
                                                        <span className="text-xs font-bold leading-none">FAILED</span>
                                                    </div>
                                                    <p className="text-[10px] text-red-500 truncate" title={dbJob.last_error || ''}>
                                                        {dbJob.last_error}
                                                    </p>
                                                </div>
                                            ) : (
                                                <span className="text-gray-400">--</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <button
                                                onClick={() => handleTrigger(vCron.path)}
                                                disabled={isManualTriggering}
                                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm
                          ${isManualTriggering
                                                        ? 'bg-indigo-100 text-indigo-400 cursor-not-allowed'
                                                        : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow active:scale-95'}`}
                                            >
                                                {isManualTriggering ? (
                                                    <>
                                                        <RefreshCw size={12} className="animate-spin" />
                                                        RUNNING
                                                    </>
                                                ) : (
                                                    <>
                                                        <Play size={12} className="fill-current" />
                                                        TRIGGER
                                                    </>
                                                )}
                                            </button>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}

function formatRelativeTime(date: Date) {
    const diff = Math.floor((new Date().getTime() - date.getTime()) / 1000)
    if (diff < 60) return `${diff} seconds ago`
    if (diff < 3600) return `${Math.floor(diff / 60)} mins ago`
    if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`
    return `${Math.floor(diff / 86400)} days ago`
}
