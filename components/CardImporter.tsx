'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { X, RefreshCw, Download, Check, Square, CheckSquare, Save, ChevronLeft, ChevronRight, AlertTriangle, Link } from 'lucide-react'

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
  exists: boolean
  existsByNameOnly?: boolean
  selected: boolean
}

interface Props {
  onClose: () => void
  onCompleted?: () => void
}

export default function CardImporter({ onClose, onCompleted }: Props) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cards, setCards] = useState<Card[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [mode, setMode] = useState<'single' | 'all'>('single')
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [skipExisting, setSkipExisting] = useState(true)
  const [customUrl, setCustomUrl] = useState('')
  const [useCustomUrl, setUseCustomUrl] = useState(false)

  // APIエンドポイントを生成
  const getApiUrl = (pageNum: number) => {
    let apiUrl = `/api/pokemon-cards?page=${pageNum}&checkDuplicates=true`
    if (useCustomUrl && customUrl) {
      apiUrl += `&url=${encodeURIComponent(customUrl)}`
    }
    return apiUrl
  }

  // 1ページ分のカードを取得
  const fetchCards = async (pageNum = 1) => {
    setLoading(true)
    setError(null)
    setMode('single')

    try {
      const res = await fetch(getApiUrl(pageNum))
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '取得に失敗しました')
      }

      setCards(data.cards.map((card: any, index: number) => ({
        ...card,
        id: `${pageNum}-${index}`,
        selected: !card.exists, // 新規は選択、既存は非選択
      })))
      setTotal(data.total)
      setTotalPages(data.totalPages)
      setPage(pageNum)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // 全ページ一括取得
  const fetchAllCards = async () => {
    setLoading(true)
    setError(null)
    setMode('all')
    
    const allCards: any[] = []
    
    try {
      // まず1ページ目を取得して総ページ数を確認
      const firstRes = await fetch(getApiUrl(1))
      const firstData = await firstRes.json()
      
      if (!firstRes.ok) {
        throw new Error(firstData.error || '取得に失敗しました')
      }
      
      setTotal(firstData.total)
      setTotalPages(firstData.totalPages)
      setProgress({ current: 1, total: firstData.totalPages })
      
      allCards.push(...firstData.cards)
      
      // 残りのページを取得
      for (let p = 2; p <= firstData.totalPages; p++) {
        setProgress({ current: p, total: firstData.totalPages })
        
        const res = await fetch(getApiUrl(p))
        const data = await res.json()
        
        if (res.ok) {
          allCards.push(...data.cards)
        }
        
        // サーバー負荷軽減のため少し待つ
        await new Promise(r => setTimeout(r, 1500))
      }
      
      setCards(allCards.map((card: any, index: number) => ({
        ...card,
        id: index,
        selected: !card.exists,
      })))
      setPage(0) // 全ページモード
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
      setProgress({ current: 0, total: 0 })
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

  // 選択したカードをDBに保存
  const saveSelectedCards = async () => {
    const selectedCards = cards.filter(c => c.selected)
    if (selectedCards.length === 0) {
      alert('カードを選択してください')
      return
    }

    setSaving(true)

    try {
      const res = await fetch('/api/pokemon-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cards: selectedCards.map(c => ({ 
            name: c.name, 
            imageUrl: c.imageUrl,
            cardNumber: c.cardNumber || null,
            rarity: c.rarity || null,  // レアリティも送信
          })),
          skipExisting,
          useRarityCheck: true,  // レアリティ別で重複チェック
        }),
      })
      
      const data = await res.json()
      
      if (!res.ok) {
        throw new Error(data.error)
      }

      alert(`新規: ${data.newCount}件、更新: ${data.updateCount}件、スキップ: ${data.skipCount}件`)
      if (onCompleted) onCompleted()
    } catch (err: any) {
      alert('エラー: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  const selectedCount = cards.filter(c => c.selected).length
  const newCount = cards.filter(c => !c.exists).length
  const existingCount = cards.filter(c => c.exists).length
  const nameOnlyCount = cards.filter(c => c.existsByNameOnly).length

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-[1000px] max-h-[90vh] flex flex-col">
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
          {/* 取得ボタン */}
          {cards.length === 0 && !loading && (
            <div className="text-center py-8">
              <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Download size={40} className="text-yellow-600" />
              </div>
              <p className="text-gray-600 mb-2">ポケモンカード公式サイトからカード情報を取得します</p>
              
              {/* URL入力オプション */}
              <div className="max-w-xl mx-auto mb-6 text-left">
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
                    type="text"
                    value={customUrl}
                    onChange={(e) => setCustomUrl(e.target.value)}
                    placeholder="https://www.pokemon-card.com/card-search/index.php?..."
                    className="w-full px-3 py-2 border rounded-lg text-sm"
                  />
                )}
                {!useCustomUrl && (
                  <p className="text-sm text-gray-400">デフォルト: SAR, SR, AR, UR等のレアカード（約730件）</p>
                )}
              </div>
              
              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => fetchCards(1)}
                  disabled={useCustomUrl && !customUrl}
                  className="px-6 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 flex items-center gap-2"
                >
                  <Download size={18} />
                  1ページずつ取得
                </button>
                <button
                  onClick={fetchAllCards}
                  disabled={useCustomUrl && !customUrl}
                  className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2"
                >
                  <Download size={18} />
                  全ページ一括取得
                </button>
              </div>
            </div>
          )}

          {/* ローディング */}
          {loading && (
            <div className="text-center py-12">
              <RefreshCw size={40} className="text-yellow-500 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">カード情報を取得中...</p>
              {progress.total > 0 && (
                <div className="mt-4">
                  <p className="text-sm text-gray-500 mb-2">{progress.current} / {progress.total} ページ</p>
                  <div className="w-64 h-2 bg-gray-200 rounded-full mx-auto">
                    <div 
                      className="h-full bg-yellow-500 rounded-full transition-all"
                      style={{ width: `${(progress.current / progress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* エラー */}
          {error && (
            <div className="text-center py-8">
              <p className="text-red-500 mb-4">{error}</p>
              <button
                onClick={() => fetchCards(page)}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                再試行
              </button>
            </div>
          )}

          {/* カード一覧 */}
          {cards.length > 0 && !loading && (
            <div>
              {/* 統計 */}
              <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-6">
                  <span className="text-sm">
                    全 <strong>{cards.length}</strong> 件
                  </span>
                  <span className="text-sm text-green-600">
                    新規: <strong>{newCount}</strong> 件
                  </span>
                  <span className="text-sm text-orange-600">
                    既存: <strong>{existingCount}</strong> 件
                  </span>
                  {nameOnlyCount > 0 && (
                    <span className="text-sm text-blue-600">
                      名前一致（レアリティ違い）: <strong>{nameOnlyCount}</strong> 件
                    </span>
                  )}
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

              {/* ページネーション（単一ページモード） */}
              {mode === 'single' && (
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-gray-500">
                    {page}ページ目 / 全{totalPages}ページ
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => fetchCards(page - 1)}
                      disabled={page <= 1}
                      className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <span className="text-sm text-gray-600 w-16 text-center">
                      {page} / {totalPages}
                    </span>
                    <button
                      onClick={() => fetchCards(page + 1)}
                      disabled={page >= totalPages}
                      className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>
              )}

              {/* カードグリッド */}
              <div className="grid grid-cols-6 gap-3 max-h-[400px] overflow-auto">
                {cards.map((card) => (
                  <div
                    key={card.id}
                    onClick={() => toggleSelect(card.id)}
                    className={`relative cursor-pointer rounded-xl overflow-hidden border-2 transition-all ${
                      card.selected
                        ? card.exists 
                          ? 'border-orange-400 shadow-lg' 
                          : card.existsByNameOnly
                            ? 'border-blue-400 shadow-lg'
                            : 'border-green-400 shadow-lg'
                        : 'border-gray-200 opacity-50'
                    }`}
                  >
                    <img
                      src={card.imageUrl}
                      alt={card.name}
                      className="w-full aspect-[3/4] object-cover"
                    />
                    {/* 既存バッジ */}
                    {card.exists && (
                      <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-orange-500 text-white text-xs rounded">
                        既存
                      </div>
                    )}
                    {/* 名前一致バッジ */}
                    {card.existsByNameOnly && !card.exists && (
                      <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-blue-500 text-white text-xs rounded">
                        レア違い
                      </div>
                    )}
                    {/* レアリティバッジ */}
                    {card.rarity && (
                      <div className="absolute bottom-8 left-1 px-1.5 py-0.5 bg-purple-500 text-white text-xs rounded">
                        {card.rarity}
                      </div>
                    )}
                    {/* 選択チェック */}
                    <div className="absolute top-1 right-1">
                      {card.selected ? (
                        <CheckSquare size={20} className={`${
                          card.exists ? 'text-orange-500' : 
                          card.existsByNameOnly ? 'text-blue-500' : 
                          'text-green-500'
                        } bg-white rounded`} />
                      ) : (
                        <Square size={20} className="text-gray-400 bg-white rounded" />
                      )}
                    </div>
                    <div className="p-1.5 bg-white">
                      <p className="text-xs text-gray-800 truncate">{card.name}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        {cards.length > 0 && (
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
                既存カードはスキップ（画像更新しない）
              </label>
            </div>
            
            <div className="flex items-center justify-between">
              <p className="text-gray-600">
                <span className="text-green-600 font-medium">{selectedCount}件</span> 選択中
                {selectedCount > 0 && existingCount > 0 && !skipExisting && (
                  <span className="text-orange-500 ml-2 text-sm">
                    （{cards.filter(c => c.selected && c.exists).length}件は更新）
                  </span>
                )}
              </p>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={saveSelectedCards}
                  disabled={saving || selectedCount === 0}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
                >
                  {saving ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      保存中...
                    </>
                  ) : (
                    <>
                      <Save size={16} />
                      選択したカードを登録
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
