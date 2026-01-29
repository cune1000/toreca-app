'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { X, RefreshCw, Download, Check, Square, CheckSquare, Save, AlertTriangle, Link, ExternalLink } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Card {
  id: string | number
  name: string
  imageUrl: string
  cardNumber?: string
  rarity?: string
  illustrator?: string
  expansion?: string
  regulation?: string
  sourceUrl?: string
  exists: boolean
  selected: boolean
}

interface Props {
  onClose: () => void
  onCompleted?: () => void
}

// デフォルトURL（SAR, SR, AR, UR）
const DEFAULT_URLS = [
  { label: 'SAR（スペシャルアートレア）', url: 'https://www.pokemon-card.com/card-search/index.php?sc_rare_sar=1' },
  { label: 'SR（スーパーレア）', url: 'https://www.pokemon-card.com/card-search/index.php?sc_rare_sr=1' },
  { label: 'AR（アートレア）', url: 'https://www.pokemon-card.com/card-search/index.php?sc_rare_ar=1' },
  { label: 'UR（ウルトラレア）', url: 'https://www.pokemon-card.com/card-search/index.php?sc_rare_ur=1' },
]

export default function CardImporter({ onClose, onCompleted }: Props) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cards, setCards] = useState<Card[]>([])
  const [totalFound, setTotalFound] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [customUrl, setCustomUrl] = useState('')
  const [useCustomUrl, setUseCustomUrl] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState(DEFAULT_URLS[0].url)
  const [limit, setLimit] = useState(40)
  const [skipExisting, setSkipExisting] = useState(true)
  const [saveResult, setSaveResult] = useState<any>(null)

  // 使用するURLを取得
  const getTargetUrl = () => {
    return useCustomUrl && customUrl ? customUrl : selectedPreset
  }

  // プレビュー取得（GET）
  const fetchPreview = async () => {
    setLoading(true)
    setError(null)
    setCards([])
    setSaveResult(null)

    try {
      const targetUrl = getTargetUrl()
      const apiUrl = `/api/pokemon-card-import?url=${encodeURIComponent(targetUrl)}&limit=${limit}`
      
      const res = await fetch(apiUrl)
      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error || '取得に失敗しました')
      }

      setTotalFound(data.totalFound)
      
      // 既存チェック
      const cardsWithCheck = await Promise.all(
        data.cards.map(async (card: any, index: number) => {
          const { data: existing } = await supabase
            .from('cards')
            .select('id')
            .eq('image_url', card.imageUrl)
            .limit(1)
          
          return {
            ...card,
            id: index,
            exists: existing && existing.length > 0,
            selected: !(existing && existing.length > 0),
          }
        })
      )

      setCards(cardsWithCheck)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // DBに保存（POST）
  const saveToDatabase = async () => {
    setSaving(true)
    setError(null)
    setSaveResult(null)

    try {
      const targetUrl = getTargetUrl()
      
      const res = await fetch('/api/pokemon-card-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: targetUrl,
          limit: limit,
          skipExisting: skipExisting,
        }),
      })
      
      const data = await res.json()
      
      if (!data.success) {
        throw new Error(data.error)
      }

      setSaveResult(data)
      
      // 完了通知
      if (data.newCount > 0 || data.updateCount > 0) {
        if (onCompleted) onCompleted()
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  // 選択を切り替え
  const toggleSelect = (id: string | number) => {
    setCards(prev => prev.map(c => 
      c.id === id ? { ...c, selected: !c.selected } : c
    ))
  }

  // 全選択/全解除
  const toggleAll = () => {
    const allSelected = cards.every(c => c.selected)
    setCards(prev => prev.map(c => ({ ...c, selected: !allSelected })))
  }

  // 新規のみ選択
  const selectNewOnly = () => {
    setCards(prev => prev.map(c => ({ ...c, selected: !c.exists })))
  }

  const selectedCount = cards.filter(c => c.selected).length
  const newCount = cards.filter(c => !c.exists).length
  const existingCount = cards.filter(c => c.exists).length

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-[1100px] max-h-[90vh] flex flex-col">
        {/* ヘッダー */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800">ポケモンカード公式からインポート</h2>
            <p className="text-sm text-gray-500">公式サイトからカード情報と画像を取得します</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-auto p-6">
          {/* 取得設定 */}
          {cards.length === 0 && !loading && !saveResult && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Download size={40} className="text-yellow-600" />
                </div>
                <p className="text-gray-600 mb-6">ポケモンカード公式サイトからカード情報を取得します</p>
              </div>

              {/* プリセットURL選択 */}
              <div className="max-w-2xl mx-auto">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  レアリティを選択
                </label>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {DEFAULT_URLS.map((preset) => (
                    <button
                      key={preset.url}
                      onClick={() => {
                        setSelectedPreset(preset.url)
                        setUseCustomUrl(false)
                      }}
                      disabled={useCustomUrl}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        !useCustomUrl && selectedPreset === preset.url
                          ? 'border-yellow-400 bg-yellow-50 text-yellow-800'
                          : 'border-gray-200 hover:bg-gray-50'
                      } ${useCustomUrl ? 'opacity-50' : ''}`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                {/* カスタムURL */}
                <div className="border-t border-gray-200 pt-4 mt-4">
                  <label className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                    <input
                      type="checkbox"
                      checked={useCustomUrl}
                      onChange={(e) => setUseCustomUrl(e.target.checked)}
                      className="rounded"
                    />
                    <Link size={16} />
                    カスタムURLを使用（検索結果のURLを貼り付け）
                  </label>
                  {useCustomUrl && (
                    <input
                      type="url"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      placeholder="https://www.pokemon-card.com/card-search/index.php?..."
                      className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    />
                  )}
                </div>

                {/* 取得件数 */}
                <div className="mt-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    取得件数（プレビュー）
                  </label>
                  <select
                    value={limit}
                    onChange={(e) => setLimit(Number(e.target.value))}
                    className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-500"
                  >
                    <option value={40}>40件</option>
                    <option value={80}>80件</option>
                    <option value={-1}>全件</option>
                  </select>
                </div>
              </div>

              {/* 取得ボタン */}
              <div className="flex justify-center gap-4 mt-8">
                <button
                  onClick={fetchPreview}
                  disabled={useCustomUrl && !customUrl}
                  className="px-8 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 flex items-center gap-2 text-lg"
                >
                  <Download size={20} />
                  プレビュー取得
                </button>
              </div>
            </div>
          )}

          {/* ローディング */}
          {loading && (
            <div className="text-center py-12">
              <RefreshCw size={40} className="text-yellow-500 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">カード情報を取得中...</p>
              <p className="text-sm text-gray-400 mt-2">詳細ページを1枚ずつ取得しています（時間がかかります）</p>
            </div>
          )}

          {/* エラー */}
          {error && (
            <div className="text-center py-8">
              <AlertTriangle size={40} className="text-red-500 mx-auto mb-4" />
              <p className="text-red-500 mb-4">{error}</p>
              <button
                onClick={fetchPreview}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                再試行
              </button>
            </div>
          )}

          {/* 保存結果 */}
          {saveResult && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={40} className="text-green-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-4">インポート完了</h3>
              <div className="flex justify-center gap-6 text-lg">
                <div className="text-green-600">
                  <span className="font-bold">{saveResult.newCount}</span> 件追加
                </div>
                <div className="text-blue-600">
                  <span className="font-bold">{saveResult.updateCount}</span> 件更新
                </div>
                <div className="text-gray-500">
                  <span className="font-bold">{saveResult.skipCount}</span> 件スキップ
                </div>
                {saveResult.errorCount > 0 && (
                  <div className="text-red-600">
                    <span className="font-bold">{saveResult.errorCount}</span> 件エラー
                  </div>
                )}
              </div>
              <button
                onClick={onClose}
                className="mt-6 px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                閉じる
              </button>
            </div>
          )}

          {/* カード一覧 */}
          {cards.length > 0 && !loading && !saveResult && (
            <div>
              {/* 統計 */}
              <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-6">
                  <span className="text-sm">
                    取得: <strong>{cards.length}</strong> / {totalFound} 件
                  </span>
                  <span className="text-sm text-green-600">
                    新規: <strong>{newCount}</strong> 件
                  </span>
                  <span className="text-sm text-orange-600">
                    既存: <strong>{existingCount}</strong> 件
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={toggleAll} className="text-sm text-blue-500 hover:underline">
                    {cards.every(c => c.selected) ? '全解除' : '全選択'}
                  </button>
                  <span className="text-gray-300">|</span>
                  <button onClick={selectNewOnly} className="text-sm text-green-500 hover:underline">
                    新規のみ選択
                  </button>
                </div>
              </div>

              {/* カードグリッド */}
              <div className="grid grid-cols-4 gap-4 max-h-[450px] overflow-auto">
                {cards.map((card) => (
                  <div
                    key={card.id}
                    onClick={() => toggleSelect(card.id)}
                    className={`relative cursor-pointer rounded-xl overflow-hidden border-2 transition-all ${
                      card.selected
                        ? card.exists 
                          ? 'border-orange-400 shadow-lg' 
                          : 'border-green-400 shadow-lg'
                        : 'border-gray-200 opacity-50'
                    }`}
                  >
                    <div className="flex">
                      {/* カード画像 */}
                      <div className="w-24 flex-shrink-0">
                        <img
                          src={card.imageUrl}
                          alt={card.name}
                          className="w-full aspect-[3/4] object-cover"
                        />
                      </div>
                      
                      {/* カード情報 */}
                      <div className="flex-1 p-2 bg-white text-xs space-y-1">
                        <p className="font-bold text-gray-800 truncate">{card.name}</p>
                        {card.cardNumber && (
                          <p className="text-gray-500">No: {card.cardNumber}</p>
                        )}
                        {card.rarity && (
                          <span className="inline-block px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px]">
                            {card.rarity}
                          </span>
                        )}
                        {card.expansion && (
                          <p className="text-gray-500 truncate" title={card.expansion}>
                            {card.expansion}
                          </p>
                        )}
                        {card.illustrator && (
                          <p className="text-gray-400 truncate">絵: {card.illustrator}</p>
                        )}
                        {card.regulation && (
                          <span className="inline-block px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-[10px]">
                            {card.regulation}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 既存バッジ */}
                    {card.exists && (
                      <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-orange-500 text-white text-xs rounded">
                        既存
                      </div>
                    )}
                    
                    {/* 選択チェック */}
                    <div className="absolute top-1 right-1">
                      {card.selected ? (
                        <CheckSquare size={20} className={`${
                          card.exists ? 'text-orange-500' : 'text-green-500'
                        } bg-white rounded`} />
                      ) : (
                        <Square size={20} className="text-gray-400 bg-white rounded" />
                      )}
                    </div>

                    {/* ソースリンク */}
                    {card.sourceUrl && (
                      <a
                        href={card.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="absolute bottom-1 right-1 p-1 bg-white/80 rounded hover:bg-white"
                      >
                        <ExternalLink size={12} className="text-gray-500" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        {cards.length > 0 && !saveResult && (
          <div className="p-6 border-t border-gray-100">
            {/* オプション */}
            <div className="flex items-center gap-4 mb-4">
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={skipExisting}
                  onChange={(e) => setSkipExisting(e.target.checked)}
                  className="rounded"
                />
                既存カードはスキップ（上書きしない）
              </label>
            </div>
            
            <div className="flex items-center justify-between">
              <p className="text-gray-600">
                一覧に <strong className="text-yellow-600">{totalFound}件</strong> 見つかりました
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => { setCards([]); setSaveResult(null); }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  やり直す
                </button>
                <button
                  onClick={saveToDatabase}
                  disabled={saving}
                  className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      保存中...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      {totalFound}件をDBに保存
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
