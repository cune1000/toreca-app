'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { RefreshCw, CheckCircle, Clock, Settings, Save, Play, XCircle, Calendar, X, Plus } from 'lucide-react'

const DAY_NAMES = ['日曜', '月曜', '火曜', '水曜', '木曜', '金曜', '土曜']

interface CronLog {
  id: string
  executed_at: string
  card_name: string
  site_name: string
  status: 'success' | 'error' | 'skipped'
  error_message?: string
  new_price?: number
  old_price?: number
  price_changed: boolean
  stock_changed?: boolean
}

interface RestTime {
  day_of_week: number
  rest_start_1?: string | null
  rest_end_1?: string | null
  rest_start_2?: string | null
  rest_end_2?: string | null
}

interface UrlStatus {
  id: string
  card?: { name: string }
  site?: { name: string }
  last_price?: number
  last_stock?: number
  check_interval?: number
  next_check_at?: string
  error_count: number
  last_error?: string
}

interface Stats {
  total: number
  success: number
  errors: number
  priceChanges: number
}

interface CronSchedule {
  job_name: string
  display_name: string
  enabled: boolean
  schedule_type: 'interval' | 'daily' | 'multi_daily'
  interval_minutes: number | null
  run_at_hours: number[] | null
  run_at_minute: number | null
  last_run_at: string | null
  last_status: string | null
  last_error: string | null
}

const JOB_DESCRIPTIONS: Record<string, string> = {
  'daily-price-aggregate': '買取・販売価格を日別に集計 → チャート用統計データを生成',
  'exchange-rate-sync':    'USD→JPYの為替レートを取得・更新',
  'lounge-cache':          'トレカラウンジ全商品をスクレイピング → キャッシュDB更新',
  'toreca-lounge':         'キャッシュから紐付け済みカードの買取価格を履歴に記録（←lounge-cacheの後に実行）',
  'shinsoku-sync':         'シンソクAPIから全商品データを取得 → キャッシュDB更新',
  'shinsoku':              'キャッシュから紐付け済みカードの買取価格を履歴に記録（←shinsoku-syncの後に実行）',
  'overseas-price-sync':   'PriceCharting等の海外価格データを取得・同期',
  'snkrdunk-sync':         'スニダンの売買履歴＋販売中最安値を一括取得（バッチ5件/回）',
  'twitter-monitor':       'Twitter/Xからトレカ関連ツイートを監視・収集',
  'update-prices':         '販売サイト（CardRush等）の最新価格・在庫を巡回更新',
}

const JOB_API_MAP: Record<string, { path: string; method: string }> = {
  'update-prices':         { path: '/api/cron/update-prices', method: 'POST' },
  'snkrdunk-sync':         { path: '/api/cron/snkrdunk-sync', method: 'GET' },
  'twitter-monitor':       { path: '/api/twitter/monitor', method: 'POST' },
  'daily-price-aggregate': { path: '/api/cron/daily-price-aggregate', method: 'GET' },
  'shinsoku-sync':         { path: '/api/cron/shinsoku-sync', method: 'GET' },
  'shinsoku':              { path: '/api/cron/shinsoku', method: 'GET' },
  'lounge-cache':          { path: '/api/cron/lounge-cache', method: 'GET' },
  'toreca-lounge':         { path: '/api/cron/toreca-lounge', method: 'GET' },
  'exchange-rate-sync':    { path: '/api/cron/exchange-rate-sync', method: 'GET' },
  'overseas-price-sync':   { path: '/api/cron/overseas-price-sync', method: 'GET' },
}

export default function CronDashboard() {
  const [activeTab, setActiveTab] = useState<'logs' | 'settings' | 'status' | 'schedule'>('logs')
  const [logs, setLogs] = useState<CronLog[]>([])
  const [restTimes, setRestTimes] = useState<RestTime[]>([])
  const [urlStatus, setUrlStatus] = useState<UrlStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [stats, setStats] = useState<Stats>({ total: 0, success: 0, errors: 0, priceChanges: 0 })

  // Schedule state
  const [schedules, setSchedules] = useState<CronSchedule[]>([])
  const [scheduleLoading, setScheduleLoading] = useState(false)
  const [scheduleSaving, setScheduleSaving] = useState(false)
  const [runningJob, setRunningJob] = useState<string | null>(null)
  const [hasScheduleChanges, setHasScheduleChanges] = useState(false)

  useEffect(() => {
    fetchLogs()
    fetchRestTimes()
    fetchUrlStatus()
  }, [])

  useEffect(() => {
    if (activeTab === 'schedule' && schedules.length === 0) {
      fetchSchedules()
    }
  }, [activeTab])

  const fetchLogs = async () => {
    setLoading(true)

    const { data: logsData } = await supabase
      .from('cron_logs')
      .select('*')
      .order('executed_at', { ascending: false })
      .limit(100)

    setLogs(logsData || [])

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
    const { data: statsData } = await supabase
      .from('cron_logs')
      .select('status, price_changed')
      .gte('executed_at', oneDayAgo)

    if (statsData) {
      setStats({
        total: statsData.length,
        success: statsData.filter(l => l.status === 'success').length,
        errors: statsData.filter(l => l.status === 'error').length,
        priceChanges: statsData.filter(l => l.price_changed).length
      })
    }

    setLoading(false)
  }

  const fetchRestTimes = async () => {
    const { data } = await supabase.from('cron_rest_times').select('*').order('day_of_week')
    setRestTimes(data || [])
  }

  const fetchUrlStatus = async () => {
    const { data } = await supabase
      .from('card_sale_urls')
      .select('*, card:card_id(name), site:site_id(name)')
      .order('next_check_at', { ascending: true })
    setUrlStatus(data || [])
  }

  const fetchSchedules = async () => {
    setScheduleLoading(true)
    try {
      const res = await fetch('/api/cron-schedules')
      if (res.ok) {
        const data = await res.json()
        setSchedules(data)
      }
    } catch (err) {
      console.error('Failed to fetch schedules:', err)
    }
    setScheduleLoading(false)
  }

  const updateRestTime = (dayOfWeek: number, field: string, value: string) => {
    setRestTimes(prev => prev.map(rt =>
      rt.day_of_week === dayOfWeek ? { ...rt, [field]: value || null } : rt
    ))
  }

  const saveRestTimes = async () => {
    setSaving(true)
    for (const rt of restTimes) {
      await supabase.from('cron_rest_times').update({
        rest_start_1: rt.rest_start_1, rest_end_1: rt.rest_end_1,
        rest_start_2: rt.rest_start_2, rest_end_2: rt.rest_end_2
      }).eq('day_of_week', rt.day_of_week)
    }
    setSaving(false)
    alert('保存しました')
  }

  const runCronManually = async () => {
    if (!confirm('今すぐ価格チェックを実行しますか？')) return
    setRunning(true)
    try {
      const res = await fetch('/api/cron/update-prices', { method: 'POST' })
      if (!res.ok) {
        const text = await res.text()
        throw new Error(`HTTP ${res.status}: ${text || 'Unknown error'}`)
      }
      const data = await res.json()
      alert(`実行完了\n処理: ${data.processed || 0}件\n更新: ${data.updated || 0}件\nエラー: ${data.errors || 0}件\n${data.message || ''}`)
      fetchLogs()
      fetchUrlStatus()
    } catch (err: any) {
      alert('エラー: ' + err.message)
    }
    setRunning(false)
  }

  const formatInterval = (minutes: number) => {
    if (minutes < 60) return `${minutes}分`
    if (minutes < 1440) return `${minutes / 60}時間`
    return `${minutes / 1440}日`
  }

  // === Schedule handlers ===

  const updateSchedule = (jobName: string, field: string, value: any) => {
    setSchedules(prev => prev.map(s =>
      s.job_name === jobName ? { ...s, [field]: value } : s
    ))
    setHasScheduleChanges(true)
  }

  const addHour = (jobName: string, hour: number) => {
    setSchedules(prev => prev.map(s => {
      if (s.job_name !== jobName) return s
      const hours = [...(s.run_at_hours || [])]
      if (!hours.includes(hour)) {
        hours.push(hour)
        hours.sort((a, b) => a - b)
      }
      return { ...s, run_at_hours: hours }
    }))
    setHasScheduleChanges(true)
  }

  const removeHour = (jobName: string, hour: number) => {
    setSchedules(prev => prev.map(s => {
      if (s.job_name !== jobName) return s
      return { ...s, run_at_hours: (s.run_at_hours || []).filter(h => h !== hour) }
    }))
    setHasScheduleChanges(true)
  }

  const saveSchedules = async () => {
    setScheduleSaving(true)
    try {
      const payload = schedules.map(s => ({
        job_name: s.job_name,
        enabled: s.enabled,
        interval_minutes: s.interval_minutes,
        run_at_hours: s.run_at_hours,
        run_at_minute: s.run_at_minute,
      }))

      const res = await fetch('/api/cron-schedules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (res.ok) {
        setHasScheduleChanges(false)
        alert('スケジュールを保存しました')
        fetchSchedules()
      } else {
        throw new Error('Save failed')
      }
    } catch (err: any) {
      alert('保存エラー: ' + err.message)
    }
    setScheduleSaving(false)
  }

  const runJob = async (jobName: string) => {
    const api = JOB_API_MAP[jobName]
    if (!api) return

    setRunningJob(jobName)
    try {
      const res = await fetch(api.path, { method: api.method })
      const data = await res.json()
      if (data.skipped) {
        alert(`スキップ: ${data.reason}`)
      } else if (data.success || res.ok) {
        alert('実行完了')
      } else {
        alert(`エラー: ${data.error || 'Unknown'}`)
      }
      fetchSchedules()
    } catch (err: any) {
      alert('実行エラー: ' + err.message)
    }
    setRunningJob(null)
  }

  const formatScheduleType = (type: string) => {
    switch (type) {
      case 'interval': return '間隔'
      case 'daily': return '毎日'
      case 'multi_daily': return '複数回/日'
      default: return type
    }
  }

  const formatLastRun = (lastRunAt: string | null) => {
    if (!lastRunAt) return '-'
    return new Date(lastRunAt).toLocaleString('ja-JP', {
      month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
    })
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setActiveTab('logs')}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
              activeTab === 'logs' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            <Clock size={18} /> ログ
          </button>
          <button
            onClick={() => setActiveTab('status')}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
              activeTab === 'status' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            <RefreshCw size={18} /> 監視状況
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
              activeTab === 'settings' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            <Settings size={18} /> 休憩時間
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`px-4 py-2 rounded-lg font-medium flex items-center gap-2 ${
              activeTab === 'schedule' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
            }`}
          >
            <Calendar size={18} /> スケジュール
          </button>
        </div>
        {activeTab !== 'schedule' && (
          <button
            onClick={runCronManually}
            disabled={running}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
          >
            {running ? <RefreshCw size={18} className="animate-spin" /> : <Play size={18} />} 手動実行
          </button>
        )}
      </div>

      {activeTab === 'logs' && (
        <div className="space-y-6">
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 border">
              <p className="text-sm text-gray-500">24h チェック数</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
            <div className="bg-green-50 rounded-xl p-4 border border-green-200">
              <p className="text-sm text-green-600">成功</p>
              <p className="text-2xl font-bold text-green-700">{stats.success}</p>
            </div>
            <div className="bg-red-50 rounded-xl p-4 border border-red-200">
              <p className="text-sm text-red-600">エラー</p>
              <p className="text-2xl font-bold text-red-700">{stats.errors}</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
              <p className="text-sm text-blue-600">価格変動</p>
              <p className="text-2xl font-bold text-blue-700">{stats.priceChanges}</p>
            </div>
          </div>
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold">実行ログ</h3>
              <button onClick={fetchLogs} className="p-2 hover:bg-gray-100 rounded-lg">
                <RefreshCw size={18} className="text-gray-500" />
              </button>
            </div>
            {loading ? (
              <div className="p-8 text-center">
                <RefreshCw className="animate-spin mx-auto text-gray-400" size={32} />
              </div>
            ) : (
              <div className="max-h-[500px] overflow-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="text-left px-4 py-2 text-xs text-gray-500">時刻</th>
                      <th className="text-left px-4 py-2 text-xs text-gray-500">カード</th>
                      <th className="text-left px-4 py-2 text-xs text-gray-500">サイト</th>
                      <th className="text-left px-4 py-2 text-xs text-gray-500">状態</th>
                      <th className="text-right px-4 py-2 text-xs text-gray-500">価格</th>
                      <th className="text-left px-4 py-2 text-xs text-gray-500">変動</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {logs.map((log) => (
                      <tr key={log.id} className={`hover:bg-gray-50 ${log.status === 'error' ? 'bg-red-50' : ''}`}>
                        <td className="px-4 py-2 text-sm text-gray-600">
                          {new Date(log.executed_at).toLocaleString('ja-JP', {
                            month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
                          })}
                        </td>
                        <td className="px-4 py-2 text-sm font-medium">{log.card_name}</td>
                        <td className="px-4 py-2 text-sm text-gray-600">{log.site_name}</td>
                        <td className="px-4 py-2">
                          {log.status === 'success' ? (
                            <span className="flex items-center gap-1 text-green-600 text-sm">
                              <CheckCircle size={14} /> 成功
                            </span>
                          ) : log.status === 'error' ? (
                            <span className="flex items-center gap-1 text-red-600 text-sm" title={log.error_message}>
                              <XCircle size={14} /> エラー
                            </span>
                          ) : (
                            <span className="text-gray-500 text-sm">スキップ</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-sm text-right">
                          {log.new_price ? `¥${log.new_price.toLocaleString()}` : '-'}
                        </td>
                        <td className="px-4 py-2">
                          {log.price_changed && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded">価格↑↓</span>
                          )}
                          {log.stock_changed && (
                            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded ml-1">在庫↑↓</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'status' && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h3 className="font-bold">監視中のURL</h3>
            <button onClick={fetchUrlStatus} className="p-2 hover:bg-gray-100 rounded-lg">
              <RefreshCw size={18} className="text-gray-500" />
            </button>
          </div>
          <div className="max-h-[600px] overflow-auto">
            <table className="w-full">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left px-4 py-2 text-xs text-gray-500">カード</th>
                  <th className="text-left px-4 py-2 text-xs text-gray-500">サイト</th>
                  <th className="text-right px-4 py-2 text-xs text-gray-500">最終価格</th>
                  <th className="text-center px-4 py-2 text-xs text-gray-500">間隔</th>
                  <th className="text-left px-4 py-2 text-xs text-gray-500">次回チェック</th>
                  <th className="text-center px-4 py-2 text-xs text-gray-500">エラー</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {urlStatus.map((url) => (
                  <tr key={url.id} className={`hover:bg-gray-50 ${url.error_count > 0 ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-2 text-sm font-medium">{url.card?.name}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">{url.site?.name}</td>
                    <td className="px-4 py-2 text-sm text-right">
                      {url.last_price ? `¥${url.last_price.toLocaleString()}` : '-'}
                    </td>
                    <td className="px-4 py-2 text-sm text-center">
                      <span className={`px-2 py-0.5 rounded text-xs ${
                        (url.check_interval || 30) <= 30 ? 'bg-green-100 text-green-700' :
                        (url.check_interval || 30) <= 180 ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {formatInterval(url.check_interval || 30)}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {url.next_check_at
                        ? new Date(url.next_check_at).toLocaleString('ja-JP', {
                            month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit'
                          })
                        : '-'
                      }
                    </td>
                    <td className="px-4 py-2 text-center">
                      {url.error_count > 0 && (
                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded" title={url.last_error}>
                          {url.error_count}回
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="bg-white rounded-xl border p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold">休憩時間設定</h3>
              <p className="text-sm text-gray-500 mt-1">休憩時間中は価格チェックを行いません（日本時間）</p>
            </div>
            <button
              onClick={saveRestTimes}
              disabled={saving}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
            >
              {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />} 保存
            </button>
          </div>
          <div className="space-y-3">
            {restTimes.map((rt) => (
              <div key={rt.day_of_week} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                <div className="w-16 font-medium">{DAY_NAMES[rt.day_of_week]}</div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">休憩1:</span>
                  <input
                    type="time"
                    value={rt.rest_start_1 || ''}
                    onChange={(e) => updateRestTime(rt.day_of_week, 'rest_start_1', e.target.value)}
                    className="px-2 py-1 border rounded text-sm"
                  />
                  <span>〜</span>
                  <input
                    type="time"
                    value={rt.rest_end_1 || ''}
                    onChange={(e) => updateRestTime(rt.day_of_week, 'rest_end_1', e.target.value)}
                    className="px-2 py-1 border rounded text-sm"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">休憩2:</span>
                  <input
                    type="time"
                    value={rt.rest_start_2 || ''}
                    onChange={(e) => updateRestTime(rt.day_of_week, 'rest_start_2', e.target.value)}
                    className="px-2 py-1 border rounded text-sm"
                  />
                  <span>〜</span>
                  <input
                    type="time"
                    value={rt.rest_end_2 || ''}
                    onChange={(e) => updateRestTime(rt.day_of_week, 'rest_end_2', e.target.value)}
                    className="px-2 py-1 border rounded text-sm"
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-2">間隔ルール</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• 初回/価格変動時 → 30分間隔</li>
              <li>• 変動なし → 30分 → 1時間 → 3時間 → 6時間 → 12時間 → 24時間</li>
              <li>• エラー時 → 30分後にリトライ</li>
            </ul>
          </div>
        </div>
      )}

      {activeTab === 'schedule' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="font-bold">Cronスケジュール管理</h3>
              <button onClick={fetchSchedules} className="p-2 hover:bg-gray-100 rounded-lg">
                <RefreshCw size={18} className="text-gray-500" />
              </button>
            </div>
            <button
              onClick={saveSchedules}
              disabled={scheduleSaving || !hasScheduleChanges}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                hasScheduleChanges
                  ? 'bg-blue-500 text-white hover:bg-blue-600'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              {scheduleSaving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />} 一括保存
            </button>
          </div>

          {scheduleLoading ? (
            <div className="p-8 text-center">
              <RefreshCw className="animate-spin mx-auto text-gray-400" size={32} />
            </div>
          ) : (
            <div className="space-y-3">
              {schedules.map((schedule) => (
                <div key={schedule.job_name} className={`bg-white rounded-xl border p-4 ${!schedule.enabled ? 'opacity-60' : ''}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                      {/* Toggle */}
                      <button
                        onClick={() => updateSchedule(schedule.job_name, 'enabled', !schedule.enabled)}
                        className={`relative w-12 h-6 rounded-full transition-colors flex-shrink-0 ${
                          schedule.enabled ? 'bg-green-500' : 'bg-gray-300'
                        }`}
                      >
                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                          schedule.enabled ? 'translate-x-6' : ''
                        }`} />
                      </button>

                      {/* Job name & type */}
                      <div className="min-w-0">
                        <div className="font-medium text-sm truncate">{schedule.display_name}</div>
                        <div className="text-xs text-gray-400">{schedule.job_name}</div>
                        {JOB_DESCRIPTIONS[schedule.job_name] && (
                          <div className="text-xs text-gray-500 mt-0.5">{JOB_DESCRIPTIONS[schedule.job_name]}</div>
                        )}
                      </div>

                      {/* Type badge */}
                      <span className={`px-2 py-0.5 rounded text-xs flex-shrink-0 ${
                        schedule.schedule_type === 'interval' ? 'bg-blue-100 text-blue-700' :
                        schedule.schedule_type === 'daily' ? 'bg-purple-100 text-purple-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {formatScheduleType(schedule.schedule_type)}
                      </span>

                      {/* Settings control */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {schedule.schedule_type === 'interval' && (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="5"
                              max="1440"
                              value={schedule.interval_minutes || ''}
                              onChange={(e) => updateSchedule(schedule.job_name, 'interval_minutes', parseInt(e.target.value) || null)}
                              className="w-16 px-2 py-1 border rounded text-sm text-center"
                            />
                            <span className="text-xs text-gray-500">分</span>
                          </div>
                        )}

                        {(schedule.schedule_type === 'daily' || schedule.schedule_type === 'multi_daily') && (
                          <div className="flex items-center gap-2">
                            <div className="flex items-center gap-1 flex-wrap">
                              {(schedule.run_at_hours || []).map(h => (
                                <span key={h} className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-gray-100 rounded text-xs">
                                  {h}:00
                                  <button onClick={() => removeHour(schedule.job_name, h)} className="hover:text-red-500">
                                    <X size={12} />
                                  </button>
                                </span>
                              ))}
                              <HourAdder onAdd={(h) => addHour(schedule.job_name, h)} existingHours={schedule.run_at_hours || []} />
                            </div>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-gray-500">:</span>
                              <input
                                type="number"
                                min="0"
                                max="59"
                                value={schedule.run_at_minute ?? 0}
                                onChange={(e) => updateSchedule(schedule.job_name, 'run_at_minute', parseInt(e.target.value) || 0)}
                                className="w-12 px-2 py-1 border rounded text-sm text-center"
                              />
                              <span className="text-xs text-gray-500">分</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Last run info */}
                      <div className="text-xs text-gray-500 flex-shrink-0 text-right min-w-[100px]">
                        <div>{formatLastRun(schedule.last_run_at)}</div>
                        {schedule.last_status && (
                          <span className={`inline-block mt-0.5 ${
                            schedule.last_status === 'success' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {schedule.last_status === 'success' ? '成功' : 'エラー'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Run button */}
                    <button
                      onClick={() => runJob(schedule.job_name)}
                      disabled={runningJob === schedule.job_name}
                      className="ml-4 px-3 py-1.5 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center gap-1 text-sm flex-shrink-0"
                    >
                      {runningJob === schedule.job_name ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <Play size={14} />
                      )}
                      実行
                    </button>
                  </div>

                  {/* Error display */}
                  {schedule.last_status === 'error' && schedule.last_error && (
                    <div className="mt-2 p-2 bg-red-50 rounded text-xs text-red-600 truncate" title={schedule.last_error}>
                      {schedule.last_error}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="p-4 bg-blue-50 rounded-lg">
            <h4 className="font-medium text-blue-800 mb-2">仕組み</h4>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Vercel Cronは高頻度で各エンドポイントを呼び出します</li>
              <li>• 各ジョブはDBのスケジュール設定を参照して実行可否を判断します</li>
              <li>• 間隔型: 前回実行からの経過時間で判断</li>
              <li>• 時刻指定型: 現在UTC時が設定時刻に一致するかで判断</li>
              <li>• 無効にしたジョブはVercelから呼ばれても即スキップされます</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}

/** 時刻追加用の小さなドロップダウン */
function HourAdder({ onAdd, existingHours }: { onAdd: (h: number) => void; existingHours: number[] }) {
  const [open, setOpen] = useState(false)
  const availableHours = Array.from({ length: 24 }, (_, i) => i).filter(h => !existingHours.includes(h))

  if (availableHours.length === 0) return null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center px-1.5 py-0.5 border border-dashed border-gray-300 rounded text-xs text-gray-500 hover:border-blue-400 hover:text-blue-500"
      >
        <Plus size={12} />
      </button>
      {open && (
        <div className="absolute z-10 top-full left-0 mt-1 bg-white border rounded-lg shadow-lg p-2 grid grid-cols-6 gap-1 w-48">
          {availableHours.map(h => (
            <button
              key={h}
              onClick={() => { onAdd(h); setOpen(false) }}
              className="px-2 py-1 text-xs hover:bg-blue-50 rounded"
            >
              {h}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
