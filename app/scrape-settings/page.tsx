'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { Save, Plus, Trash2, Clock, Calendar, Settings, AlertCircle } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const DAYS_OF_WEEK = ['日曜', '月曜', '火曜', '水曜', '木曜', '金曜', '土曜']
const SOURCES = [
  { id: 'snkrdunk', name: 'スニダン' },
  { id: 'torecacamp', name: 'トレカキャンプ' },
  { id: 'cardrush', name: 'カードラッシュ' },
]

interface Blackout {
  id?: string
  day_of_week: number
  start_time: string
  end_time: string
  source: string | null
  reason: string
  is_active: boolean
}

interface Settings {
  jitter_min_percent: string
  jitter_max_percent: string
  interval_levels: string
  no_change_threshold: string
  scrape_enabled: string
  concurrent_limit: string
}

export default function ScrapeSettingsPage() {
  const [blackouts, setBlackouts] = useState<Blackout[]>([])
  const [settings, setSettings] = useState<Settings>({
    jitter_min_percent: '0',
    jitter_max_percent: '100',
    interval_levels: '30,60,180,360,720,1440',
    no_change_threshold: '1',
    scrape_enabled: 'true',
    concurrent_limit: '3'
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)

  // 新規禁止時間帯
  const [newBlackout, setNewBlackout] = useState<Blackout>({
    day_of_week: 1,
    start_time: '09:00',
    end_time: '12:00',
    source: null,
    reason: '',
    is_active: true
  })

  // データ読み込み
  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    try {
      // 禁止時間帯を取得
      const { data: blackoutData } = await supabase
        .from('scrape_blackout')
        .select('*')
        .order('day_of_week', { ascending: true })
        .order('start_time', { ascending: true })

      if (blackoutData) setBlackouts(blackoutData)

      // 設定を取得
      const { data: settingsData } = await supabase
        .from('scrape_settings')
        .select('key, value')

      if (settingsData) {
        const settingsObj: any = { ...settings }
        settingsData.forEach(s => {
          if (s.key in settingsObj) {
            settingsObj[s.key] = s.value
          }
        })
        setSettings(settingsObj)
      }
    } catch (err) {
      console.error('Fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  // 禁止時間帯を追加
  const addBlackout = async () => {
    try {
      const { data, error } = await supabase
        .from('scrape_blackout')
        .insert([newBlackout])
        .select()
        .single()

      if (error) throw error

      setBlackouts([...blackouts, data])
      setNewBlackout({
        day_of_week: 1,
        start_time: '09:00',
        end_time: '12:00',
        source: null,
        reason: '',
        is_active: true
      })
      setMessage({ type: 'success', text: '禁止時間帯を追加しました' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    }
  }

  // 禁止時間帯を削除
  const deleteBlackout = async (id: string) => {
    if (!confirm('削除しますか？')) return

    try {
      const { error } = await supabase
        .from('scrape_blackout')
        .delete()
        .eq('id', id)

      if (error) throw error

      setBlackouts(blackouts.filter(b => b.id !== id))
      setMessage({ type: 'success', text: '削除しました' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    }
  }

  // 禁止時間帯の有効/無効を切り替え
  const toggleBlackout = async (id: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('scrape_blackout')
        .update({ is_active: isActive })
        .eq('id', id)

      if (error) throw error

      setBlackouts(blackouts.map(b => 
        b.id === id ? { ...b, is_active: isActive } : b
      ))
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    }
  }

  // 設定を保存
  const saveSettings = async () => {
    setSaving(true)
    try {
      for (const [key, value] of Object.entries(settings)) {
        const { error } = await supabase
          .from('scrape_settings')
          .update({ value, updated_at: new Date().toISOString() })
          .eq('key', key)

        if (error) throw error
      }
      setMessage({ type: 'success', text: '設定を保存しました' })
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <h1 className="text-3xl font-bold text-gray-800">
          ⚙️ スクレイピング設定
        </h1>

        {/* メッセージ */}
        {message && (
          <div className={`p-4 rounded-lg flex items-center gap-2 ${
            message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
          }`}>
            {message.type === 'error' && <AlertCircle size={20} />}
            {message.text}
            <button 
              onClick={() => setMessage(null)}
              className="ml-auto text-sm underline"
            >
              閉じる
            </button>
          </div>
        )}

        {/* グローバル設定 */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Settings className="text-blue-500" size={24} />
            <h2 className="text-xl font-bold">基本設定</h2>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {/* スクレイピング有効/無効 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                スクレイピング
              </label>
              <select
                value={settings.scrape_enabled}
                onChange={(e) => setSettings({ ...settings, scrape_enabled: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              >
                <option value="true">有効</option>
                <option value="false">無効（一時停止）</option>
              </select>
            </div>

            {/* 同時実行数 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                同時スクレイピング数
              </label>
              <input
                type="number"
                value={settings.concurrent_limit}
                onChange={(e) => setSettings({ ...settings, concurrent_limit: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                min="1"
                max="10"
              />
            </div>

            {/* 揺らぎ設定 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                揺らぎ（最小%）
              </label>
              <input
                type="number"
                value={settings.jitter_min_percent}
                onChange={(e) => setSettings({ ...settings, jitter_min_percent: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                min="0"
                max="200"
              />
              <p className="text-xs text-gray-500 mt-1">
                基本間隔に対する最小揺らぎ%
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                揺らぎ（最大%）
              </label>
              <input
                type="number"
                value={settings.jitter_max_percent}
                onChange={(e) => setSettings({ ...settings, jitter_max_percent: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                min="0"
                max="200"
              />
              <p className="text-xs text-gray-500 mt-1">
                例: 30分間隔で100%なら30〜60分
              </p>
            </div>

            {/* 間隔レベル */}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                間隔レベル（分、カンマ区切り）
              </label>
              <input
                type="text"
                value={settings.interval_levels}
                onChange={(e) => setSettings({ ...settings, interval_levels: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
              />
              <p className="text-xs text-gray-500 mt-1">
                価格変動なしで段階的に延びる間隔: 30分 → 1時間 → 3時間 → 6時間 → 12時間 → 24時間
              </p>
            </div>

            {/* 変動なし閾値 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                レベルアップ閾値
              </label>
              <input
                type="number"
                value={settings.no_change_threshold}
                onChange={(e) => setSettings({ ...settings, no_change_threshold: e.target.value })}
                className="w-full px-3 py-2 border rounded-lg"
                min="1"
                max="10"
              />
              <p className="text-xs text-gray-500 mt-1">
                価格変動なしがN回続いたら間隔を延ばす
              </p>
            </div>
          </div>

          <div className="mt-6 flex justify-end">
            <button
              onClick={saveSettings}
              disabled={saving}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
            >
              <Save size={18} />
              {saving ? '保存中...' : '設定を保存'}
            </button>
          </div>
        </div>

        {/* 禁止時間帯 */}
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <Calendar className="text-orange-500" size={24} />
            <h2 className="text-xl font-bold">スクレイピング禁止時間帯</h2>
          </div>

          {/* 新規追加フォーム */}
          <div className="p-4 bg-gray-50 rounded-lg mb-6">
            <h3 className="font-medium mb-4">新規追加</h3>
            <div className="grid grid-cols-6 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">曜日</label>
                <select
                  value={newBlackout.day_of_week}
                  onChange={(e) => setNewBlackout({ ...newBlackout, day_of_week: parseInt(e.target.value) })}
                  className="w-full px-2 py-1.5 border rounded text-sm"
                >
                  {DAYS_OF_WEEK.map((day, i) => (
                    <option key={i} value={i}>{day}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">開始</label>
                <input
                  type="time"
                  value={newBlackout.start_time}
                  onChange={(e) => setNewBlackout({ ...newBlackout, start_time: e.target.value })}
                  className="w-full px-2 py-1.5 border rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">終了</label>
                <input
                  type="time"
                  value={newBlackout.end_time}
                  onChange={(e) => setNewBlackout({ ...newBlackout, end_time: e.target.value })}
                  className="w-full px-2 py-1.5 border rounded text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">対象サイト</label>
                <select
                  value={newBlackout.source || ''}
                  onChange={(e) => setNewBlackout({ ...newBlackout, source: e.target.value || null })}
                  className="w-full px-2 py-1.5 border rounded text-sm"
                >
                  <option value="">全サイト</option>
                  {SOURCES.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">理由</label>
                <input
                  type="text"
                  value={newBlackout.reason}
                  onChange={(e) => setNewBlackout({ ...newBlackout, reason: e.target.value })}
                  placeholder="メモ"
                  className="w-full px-2 py-1.5 border rounded text-sm"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={addBlackout}
                  className="w-full px-3 py-1.5 bg-orange-500 text-white rounded hover:bg-orange-600 flex items-center justify-center gap-1 text-sm"
                >
                  <Plus size={16} />
                  追加
                </button>
              </div>
            </div>
          </div>

          {/* 禁止時間帯一覧 */}
          {blackouts.length > 0 ? (
            <div className="space-y-2">
              {blackouts.map((blackout) => (
                <div
                  key={blackout.id}
                  className={`flex items-center gap-4 p-3 rounded-lg border ${
                    blackout.is_active ? 'bg-white' : 'bg-gray-100 opacity-60'
                  }`}
                >
                  <div className="w-16 font-medium">
                    {DAYS_OF_WEEK[blackout.day_of_week]}
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={16} className="text-gray-400" />
                    <span>{blackout.start_time}</span>
                    <span>〜</span>
                    <span>{blackout.end_time}</span>
                  </div>
                  <div className="text-sm text-gray-500">
                    {blackout.source 
                      ? SOURCES.find(s => s.id === blackout.source)?.name 
                      : '全サイト'}
                  </div>
                  {blackout.reason && (
                    <div className="text-sm text-gray-400">
                      ({blackout.reason})
                    </div>
                  )}
                  <div className="ml-auto flex items-center gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={blackout.is_active}
                        onChange={(e) => toggleBlackout(blackout.id!, e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm">有効</span>
                    </label>
                    <button
                      onClick={() => deleteBlackout(blackout.id!)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 py-8">
              禁止時間帯が設定されていません
            </div>
          )}
        </div>

        {/* 説明 */}
        <div className="bg-blue-50 rounded-xl p-6">
          <h3 className="font-bold text-blue-800 mb-3">📖 動的スケジューリングの仕組み</h3>
          <div className="text-blue-700 text-sm space-y-2">
            <p>• 新規登録時は<strong>30分間隔</strong>でスクレイピング</p>
            <p>• 価格が<strong>変動なし</strong>の場合、間隔が段階的に延びる（30分→1時間→3時間→6時間→12時間→24時間）</p>
            <p>• 価格が<strong>変動あり</strong>の場合、間隔が<strong>30分に戻る</strong></p>
            <p>• 揺らぎ設定により、実際のスクレイピング時刻はランダムに分散</p>
            <p>• 禁止時間帯中はスクレイピングがスキップされ、次の許可時間に実行</p>
          </div>
        </div>
      </div>
    </div>
  )
}
