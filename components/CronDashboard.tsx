'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { RefreshCw, CheckCircle, Clock, Settings, Save, Play, XCircle } from 'lucide-react'

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

export default function CronDashboard() {
  const [activeTab, setActiveTab] = useState<'logs' | 'settings' | 'status'>('logs')
  const [logs, setLogs] = useState<CronLog[]>([])
  const [restTimes, setRestTimes] = useState<RestTime[]>([])
  const [urlStatus, setUrlStatus] = useState<UrlStatus[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [stats, setStats] = useState<Stats>({ total: 0, success: 0, errors: 0, priceChanges: 0 })

  useEffect(() => {
    fetchLogs()
    fetchRestTimes()
    fetchUrlStatus()
  }, [])

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

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
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
        </div>
        <button 
          onClick={runCronManually} 
          disabled={running} 
          className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
        >
          {running ? <RefreshCw size={18} className="animate-spin" /> : <Play size={18} />} 手動実行
        </button>
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
    </div>
  )
}
