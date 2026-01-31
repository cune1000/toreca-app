'use client'

import { useState, useEffect } from 'react'
import { RefreshCw, Play, Check, X, Twitter, AlertCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { ShopMonitorSetting } from '@/lib/types'

export default function MonitorSettingsPage() {
    const [settings, setSettings] = useState<ShopMonitorSetting[]>([])
    const [loading, setLoading] = useState(true)
    const [running, setRunning] = useState(false)
    const [result, setResult] = useState<any>(null)

    useEffect(() => {
        loadSettings()
    }, [])

    const loadSettings = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('shop_monitor_settings')
            .select(`
        *,
        shop:shop_id(id, name, icon, x_account)
      `)
            .order('created_at', { ascending: false })

        if (!error && data) {
            setSettings(data)
        }
        setLoading(false)
    }

    const toggleMonitor = async (shopId: string, currentState: boolean) => {
        const { error } = await supabase
            .from('shop_monitor_settings')
            .update({
                is_active: !currentState,
                updated_at: new Date().toISOString()
            })
            .eq('shop_id', shopId)

        if (!error) {
            await loadSettings()
        }
    }

    const runNow = async () => {
        setRunning(true)
        setResult(null)

        try {
            const res = await fetch('/api/twitter/monitor', { method: 'POST' })
            const data = await res.json()
            setResult(data)
            await loadSettings()
        } catch (err: any) {
            setResult({ success: false, error: err.message })
        }

        setRunning(false)
    }

    return (
        <div className="p-6 max-w-6xl mx-auto">
            {/* ヘッダー */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                        <Twitter className="text-blue-500" size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">X自動監視設定</h1>
                        <p className="text-sm text-gray-500">買取表ツイートを自動検出</p>
                    </div>
                </div>
                <button
                    onClick={runNow}
                    disabled={running}
                    className="px-5 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm hover:shadow-md"
                >
                    {running ? (
                        <RefreshCw size={18} className="animate-spin" />
                    ) : (
                        <Play size={18} />
                    )}
                    今すぐ実行
                </button>
            </div>

            {/* 実行結果 */}
            {result && (
                <div className={`mb-6 p-5 rounded-xl border-2 ${result.success
                        ? 'bg-green-50 border-green-200'
                        : 'bg-red-50 border-red-200'
                    }`}>
                    <div className="flex items-start gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${result.success ? 'bg-green-100' : 'bg-red-100'
                            }`}>
                            {result.success ? (
                                <Check className="text-green-600" size={20} />
                            ) : (
                                <AlertCircle className="text-red-600" size={20} />
                            )}
                        </div>
                        <div className="flex-1">
                            <h3 className="font-bold mb-2 text-gray-800">
                                {result.success ? '実行完了' : 'エラーが発生しました'}
                            </h3>
                            {result.success ? (
                                result.skipped ? (
                                    <div className="text-sm text-gray-600">
                                        <p>{result.message}</p>
                                        <p className="text-xs mt-1">現在時刻（JST）: {result.current_jst_hour}時</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                                            <p className="text-xs text-gray-500 mb-1">処理店舗</p>
                                            <p className="text-lg font-bold text-gray-800">
                                                {result.results?.processed || 0} / {result.results?.total_shops || 0}
                                            </p>
                                        </div>
                                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                                            <p className="text-xs text-gray-500 mb-1">新着ツイート</p>
                                            <p className="text-lg font-bold text-blue-600">{result.results?.new_tweets || 0}件</p>
                                        </div>
                                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                                            <p className="text-xs text-gray-500 mb-1">買取表検出</p>
                                            <p className="text-lg font-bold text-purple-600">{result.results?.purchase_lists_found || 0}件</p>
                                        </div>
                                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                                            <p className="text-xs text-gray-500 mb-1">保留追加</p>
                                            <p className="text-lg font-bold text-green-600">{result.results?.added_to_pending || 0}件</p>
                                        </div>
                                        <div className="bg-white rounded-lg p-3 border border-gray-200">
                                            <p className="text-xs text-gray-500 mb-1">処理時間</p>
                                            <p className="text-lg font-bold text-gray-600">{result.duration_ms || 0}ms</p>
                                        </div>
                                    </div>
                                )
                            ) : (
                                <p className="text-red-600 text-sm">{result.error}</p>
                            )}
                            {result.results?.errors?.length > 0 && (
                                <div className="mt-3 p-3 bg-red-50 rounded-lg border border-red-200">
                                    <p className="text-sm font-semibold text-red-700 mb-1">エラー詳細:</p>
                                    <ul className="list-disc list-inside text-sm text-red-600 space-y-1">
                                        {result.results.errors.map((err: string, i: number) => (
                                            <li key={i}>{err}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* 店舗一覧 */}
            {loading ? (
                <div className="text-center py-12">
                    <RefreshCw size={48} className="text-blue-500 animate-spin mx-auto mb-4" />
                    <p className="text-gray-500">読み込み中...</p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {settings.map((setting) => (
                        <div
                            key={setting.shop_id}
                            className="bg-white border border-gray-200 rounded-xl p-5 flex items-center justify-between hover:shadow-md transition-shadow"
                        >
                            <div className="flex items-center gap-4">
                                {setting.shop?.icon ? (
                                    <img
                                        src={setting.shop.icon}
                                        alt={setting.shop.name}
                                        className="w-14 h-14 rounded-full object-cover border-2 border-gray-100"
                                    />
                                ) : (
                                    <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-100 to-blue-200 flex items-center justify-center">
                                        <Twitter size={24} className="text-blue-500" />
                                    </div>
                                )}
                                <div>
                                    <h3 className="font-bold text-gray-800 text-lg">{setting.shop?.name || '不明'}</h3>
                                    <p className="text-sm text-blue-500 font-medium">@{setting.shop?.x_account || '未設定'}</p>
                                    {setting.last_checked_at && (
                                        <p className="text-xs text-gray-400 mt-1">
                                            最終チェック: {new Date(setting.last_checked_at).toLocaleString('ja-JP', {
                                                year: 'numeric',
                                                month: '2-digit',
                                                day: '2-digit',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })}
                                        </p>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={() => toggleMonitor(setting.shop_id, setting.is_active)}
                                className={`px-5 py-2.5 rounded-lg flex items-center gap-2 transition-all font-medium ${setting.is_active
                                        ? 'bg-green-100 text-green-700 hover:bg-green-200 border-2 border-green-300'
                                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200 border-2 border-gray-300'
                                    }`}
                            >
                                {setting.is_active ? <Check size={18} /> : <X size={18} />}
                                {setting.is_active ? '監視中' : '停止中'}
                            </button>
                        </div>
                    ))}

                    {settings.length === 0 && (
                        <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
                            <Twitter size={48} className="text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600 font-medium">監視対象の店舗がありません</p>
                            <p className="text-sm text-gray-500 mt-2">買取店舗にXアカウントを設定してください</p>
                        </div>
                    )}
                </div>
            )}

            {/* 説明 */}
            <div className="mt-8 p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                <h3 className="font-bold mb-3 text-gray-800 flex items-center gap-2">
                    <AlertCircle size={20} className="text-blue-500" />
                    自動監視について
                </h3>
                <ul className="space-y-2 text-sm text-gray-700">
                    <li className="flex items-start gap-2">
                        <span className="text-blue-500 mt-0.5">•</span>
                        <span><strong>毎時0分</strong>に自動実行されます（Vercel Cron）</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-blue-500 mt-0.5">•</span>
                        <span><strong>深夜2時〜朝9時（JST）</strong>は停止します</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-blue-500 mt-0.5">•</span>
                        <span><strong>Gemini AI</strong>が買取表かどうかを自動判別します（confidence 70%以上）</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-blue-500 mt-0.5">•</span>
                        <span>買取表と判定された画像は<strong>保留リスト</strong>に自動追加されます</span>
                    </li>
                    <li className="flex items-start gap-2">
                        <span className="text-blue-500 mt-0.5">•</span>
                        <span>保留リストに追加後、<strong>バックグラウンドでAI解析</strong>が開始されます</span>
                    </li>
                </ul>
            </div>
        </div>
    )
}
