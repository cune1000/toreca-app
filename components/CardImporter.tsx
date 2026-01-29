'use client'

import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'
import { X, RefreshCw, Download, Check, Square, CheckSquare, Save, AlertTriangle, ExternalLink, ChevronLeft } from 'lucide-react'

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

const CARDS_PER_PAGE = 20

export default function CardImporter({ onClose, onCompleted }: Props) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cards, setCards] = useState<Card[]>([])
  const [totalFound, setTotalFound] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [customUrl, setCustomUrl] = useState('')
  const [useCustomUrl, setUseCustomUrl] = useState(false)
  const [selectedPreset, setSelectedPreset] = useState(DEFAULT_URLS[0].url)
  const [skipExisting, setSkipExisting] = useState(true)
  const [saveResult, setSaveResult] = useState<any>(null)
  
  // ステップ管理
  const [step, setStep] = useState<'config' | 'pageSelect' | 'preview' | 'saving' | 'done'>('config')
  const [totalPages, setTotalPages] = useState(0)
  const [selectedPage, setSelectedPage] = useState<number | 'all'>(1)
  const [progress, setProgress] = useState({ current: 0, total: 0, currentPage: 0 })

  const getTargetUrl = () => {
    return useCustomUrl && customUrl ? customUrl : selectedPreset
  }

  // Step 1: ページ数を確認
  const fetchPageCount = async () => {
    setLoading(true)
    setError(null)

    try {
      const targetUrl = getTargetUrl()
      const apiUrl = `/api/pokemon-card-import?url=${encodeURIComponent(targetUrl)}&limit=1`
      
      const res = await fetch(apiUrl)
      const data = await res.json()

      if (!data.success) {
        throw new Error(data.error || '取得に失敗しました')
      }

      setTotalFound(data.totalFound)
      const pages = Math.ceil(data.totalFound / CARDS_PER_PAGE)
      setTotalPages(pages)
      setSelectedPage(1)
      setStep('pageSelect')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // Step 2: プレビュー取得
  const fetchPreview = async () => {
    setLoading(true)
    setError(null)
    setCards([])
    setStep('preview')

    try {
      const targetUrl = getTargetUrl()
      
      if (selectedPage === 'all') {
        await fetchAllPages(targetUrl)
      } else {
        await fetchSinglePage(targetUrl, selectedPage)
      }
    } catch (err: any) {
      setError(err.message)
      setStep('pageSelect')
    } finally {
      setLoading(false)
    }
  }

  // 単一ページ取得
  const fetchSinglePage = async (targetUrl: string, page: number) => {
    const offset = (page - 1) * CARDS_PER_PAGE
    const apiUrl = `/api/pokemon-card-import?url=${encodeURIComponent(targetUrl)}&limit=${CARDS_PER_PAGE}&offset=${offset}`
    
    const res = await fetch(apiUrl)
    const data = await res.json()

    if (!data.success) {
      throw new Error(data.error || '取得に失敗しました')
    }

    const cardsWithCheck = await checkExistingCards(data.cards)
    setCards(cardsWithCheck)
  }

  // すべてのページを取得（進行度表示付き）
  const fetchAllPages = async (targetUrl: string) => {
    const allCards: any[] = []
    setProgress({ current: 0, total: totalFound, currentPage: 0 })

    for (let page = 1; page <= totalPages; page++) {
      setProgress(prev => ({ ...prev, currentPage: page }))
      
      const offset = (page - 1) * CARDS_PER_PAGE
      const apiUrl = `/api/pokemon-card-import?url=${encodeURIComponent(targetUrl)}&limit=${CARDS_PER_PAGE}&offset=${offset}`
      
      const res = await fetch(apiUrl)
      const data = await res.json()

      if (!data.success) {
        console.error(`Page ${page} failed:`, data.error)
        continue
      }

      allCards.push(...data.cards)
      setProgress(prev => ({ ...prev, current: allCards.length }))
      
      if (page < totalPages) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    const cardsWithCheck = await checkExistingCards(allCards)
    setCards(cardsWithCheck)
  }

  // 既存チェック
  const checkExistingCards = async (cardsData: any[]) => {
    return await Promise.all(
      cardsData.map(async (card: any, index: number) => {
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
  }

  // DBに保存
  const saveToDatabase = async () => {
    setSaving(true)
    setError(null)
    setSaveResult(null)
    setStep('saving')

    try {
      const targetUrl = getTargetUrl()
      
      if (selectedPage === 'all') {
        await saveAllPages(targetUrl)
      } else {
        await saveSinglePage(targetUrl, selectedPage)
      }
    } catch (err: any) {
      setError(err.message)
      setStep('preview')
    } finally {
      setSaving(false)
    }
  }

  // 単一ページ保存
  const saveSinglePage = async (targetUrl: string, page: number) => {
    const offset = (page - 1) * CARDS_PER_PAGE
    
    const res = await fetch('/api/pokemon-card-import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: targetUrl,
        limit: CARDS_PER_PAGE,
        offset: offset,
        skipExisting: skipExisting,
      }),
    })
    
    const data = await res.json()
    
    if (!data.success) {
      throw new Error(data.error)
    }

    setSaveResult(data)
    setStep('done')
    
    if (data.newCount > 0 || data.updateCount > 0) {
      if (onCompleted) onCompleted()
    }
  }

  // すべてのページを保存（進行度表示付き）
  const saveAllPages = async (targetUrl: string) => {
    let totalNew = 0
    let totalUpdate = 0
    let totalSkip = 0
    let totalError = 0
    
    setProgress({ current: 0, total: totalFound, currentPage: 0 })

    for (let page = 1; page <= totalPages; page++) {
      setProgress(prev => ({ ...prev, currentPage: page }))
      
      const offset = (page - 1) * CARDS_PER_PAGE
      
      const res = await fetch('/api/pokemon-card-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: targetUrl,
          limit: CARDS_PER_PAGE,
          offset: offset,
          skipExisting: skipExisting,
        }),
      })
      
      const data = await res.json()
      
      if (data.success) {
        totalNew += data.newCount || 0
        totalUpdate += data.updateCount || 0
        totalSkip += data.skipCount || 0
        totalError += data.errorCount || 0
      }
      
      setProgress(prev => ({ 
        ...prev, 
        current: Math.min(page * CARDS_PER_PAGE, totalFound) 
      }))
      
      if (page < totalPages) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    setSaveResult({
      newCount: totalNew,
      updateCount: totalUpdate,
      skipCount: totalSkip,
      errorCount: totalError,
    })
    setStep('done')
    
    if (totalNew > 0 || totalUpdate > 0) {
      if (onCompleted) onCompleted()
    }
  }

  const toggleSelect = (id: string | number) => {
    setCards(prev => prev.map(c => 
      c.id === id ? { ...c, selected: !c.selected } : c
    ))
  }

  const toggleAll = () => {
    const allSelected = cards.every(c => c.selected)
    setCards(prev => prev.map(c => ({ ...c, selected: !allSelected })))
  }

  const selectNewOnly = () => {
    setCards(prev => prev.map(c => ({ ...c, selected: !c.exists })))
  }

  const goBack = () => {
    if (step === 'pageSelect') {
      setStep('config')
      setTotalPages(0)
      setTotalFound(0)
    } else if (step === 'preview') {
      setStep('pageSelect')
      setCards([])
    }
  }

  const newCount = cards.filter(c => !c.exists).length
  const existingCount = cards.filter(c => c.exists).length

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-[1100px] max-h-[90vh] flex flex-col">
        {/* ヘッダー */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {(step === 'pageSelect' || step === 'preview') && (
              <button onClick={goBack} className="p-2 hover:bg-gray-100 rounded-lg">
                <ChevronLeft size={20} className="text-gray-500" />
              </button>
            )}
            <div>
              <h2 className="text-xl font-bold text-gray-800">ポケモンカード公式からインポート</h2>
              <p className="text-sm text-gray-500">
                {step === 'config' && '公式サイトからカード情報と画像を取得します'}
                {step === 'pageSelect' && `全${totalFound}件（${totalPages}ページ）見つかりました`}
                {step === 'preview' && `${cards.length}件を取得しました`}
                {step === 'saving' && '保存中...'}
                {step === 'done' && 'インポート完了'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-auto p-6">
          
          {/* Step 1: 設定 */}
          {step === 'config' && !loading && !error && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Download size={40} className="text-yellow-600" />
                </div>
                <p className="text-gray-600 mb-6">ポケモンカード公式サイトからカード情報を取得します</p>
              </div>

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

                <div className="border-t border-gray-200 pt-4 mt-4">
                  <label className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                    <input
                      type="checkbox"
                      checked={useCustomUrl}
                      onChange={(e) => setUseCustomUrl(e.target.checked)}
                      className="rounded"
                    />
                    カスタムURLを使用
                  </label>
                  {useCustomUrl && (
                    <input
                      type="text"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      placeholder="https://www.pokemon-card.com/card-search/..."
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400"
                    />
                  )}
                </div>

                <div className="mt-6 text-center">
                  <button
                    onClick={fetchPageCount}
                    disabled={useCustomUrl && !customUrl}
                    className="px-8 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 disabled:opacity-50 font-medium"
                  >
                    ページ数を確認
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: ページ選択 */}
          {step === 'pageSelect' && !loading && !error && (
            <div className="max-w-2xl mx-auto">
              <div className="text-center mb-8">
                <div className="text-4xl font-bold text-yellow-600 mb-2">{totalFound}件</div>
                <div className="text-gray-500">{totalPages}ページ（1ページ20件）</div>
              </div>

              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  取得するページを選択
                </label>
                
                {/* すべてのページ */}
                <button
                  onClick={() => setSelectedPage('all')}
                  className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${
                    selectedPage === 'all'
                      ? 'border-yellow-400 bg-yellow-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-bold text-gray-800">すべてのページ</div>
                      <div className="text-sm text-gray-500">{totalFound}件すべてを取得（時間がかかります）</div>
                    </div>
                    {selectedPage === 'all' && (
                      <Check size={24} className="text-yellow-500" />
                    )}
                  </div>
                </button>

                {/* ページ指定 */}
                <div className={`p-4 rounded-lg border-2 ${
                  selectedPage !== 'all' ? 'border-yellow-400 bg-yellow-50' : 'border-gray-200'
                }`}>
                  <div className="font-bold text-gray-800 mb-3">特定のページを選択</div>
                  <div className="flex flex-wrap gap-2 max-h-[200px] overflow-auto">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                      <button
                        key={page}
                        onClick={() => setSelectedPage(page)}
                        className={`w-12 h-10 rounded-lg font-medium transition-colors ${
                          selectedPage === page
                            ? 'bg-yellow-500 text-white'
                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  {selectedPage !== 'all' && (
                    <div className="mt-3 text-sm text-gray-500">
                      {selectedPage}/{totalPages}ページ目を取得（{((selectedPage - 1) * CARDS_PER_PAGE) + 1}〜{Math.min(selectedPage * CARDS_PER_PAGE, totalFound)}件目）
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-8 text-center">
                <button
                  onClick={fetchPreview}
                  className="px-8 py-3 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 font-medium"
                >
                  {selectedPage === 'all' ? `全${totalPages}ページを取得` : `${selectedPage}/${totalPages}ページ目を取得`}
                </button>
              </div>
            </div>
          )}

          {/* ローディング */}
          {loading && (
            <div className="text-center py-12">
              <RefreshCw size={48} className="animate-spin text-yellow-500 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">
                {step === 'config' && 'ページ数を確認中...'}
                {step === 'preview' && selectedPage === 'all' && (
                  <>
                    <span className="block font-bold text-xl mb-2">
                      {progress.currentPage} / {totalPages} ページ取得中
                    </span>
                    <span className="block text-gray-500">
                      {progress.current} / {totalFound} 件
                    </span>
                  </>
                )}
                {step === 'preview' && selectedPage !== 'all' && 'カード情報を取得中...'}
              </p>
              {step === 'preview' && selectedPage === 'all' && (
                <div className="max-w-md mx-auto mt-6">
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-yellow-500 transition-all duration-300"
                      style={{ width: `${(progress.current / totalFound) * 100}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-400 mt-2">
                    {Math.round((progress.current / totalFound) * 100)}% 完了
                  </p>
                </div>
              )}
            </div>
          )}

          {/* 保存中 */}
          {step === 'saving' && (
            <div className="text-center py-12">
              <RefreshCw size={48} className="animate-spin text-green-500 mx-auto mb-4" />
              <p className="text-gray-600 text-lg">
                {selectedPage === 'all' ? (
                  <>
                    <span className="block font-bold text-xl mb-2">
                      {progress.currentPage} / {totalPages} ページ保存中
                    </span>
                    <span className="block text-gray-500">
                      {progress.current} / {totalFound} 件
                    </span>
                  </>
                ) : (
                  'データベースに保存中...'
                )}
              </p>
              {selectedPage === 'all' && (
                <div className="max-w-md mx-auto mt-6">
                  <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-green-500 transition-all duration-300"
                      style={{ width: `${(progress.current / totalFound) * 100}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-400 mt-2">
                    {Math.round((progress.current / totalFound) * 100)}% 完了
                  </p>
                </div>
              )}
            </div>
          )}

          {/* エラー */}
          {error && (
            <div className="text-center py-8">
              <AlertTriangle size={40} className="text-red-500 mx-auto mb-4" />
              <p className="text-red-500 mb-4">{error}</p>
              <button
                onClick={() => { setError(null); setStep('config'); }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                やり直す
              </button>
            </div>
          )}

          {/* 完了 */}
          {step === 'done' && saveResult && (
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

          {/* カード一覧プレビュー */}
          {step === 'preview' && cards.length > 0 && !loading && (
            <div>
              <div className="flex items-center justify-between mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-6">
                  <span className="text-sm">
                    取得: <strong>{cards.length}</strong> 件
                    {selectedPage !== 'all' && ` （${selectedPage}/${totalPages}ページ）`}
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

              <div className="grid grid-cols-4 gap-4 max-h-[400px] overflow-auto">
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
                      <div className="w-24 flex-shrink-0">
                        <img
                          src={card.imageUrl}
                          alt={card.name}
                          className="w-full aspect-[3/4] object-cover"
                        />
                      </div>
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
                      </div>
                    </div>

                    {card.exists && (
                      <div className="absolute top-1 left-1 px-1.5 py-0.5 bg-orange-500 text-white text-xs rounded">
                        既存
                      </div>
                    )}
                    
                    <div className="absolute top-1 right-1">
                      {card.selected ? (
                        <CheckSquare size={20} className={`${
                          card.exists ? 'text-orange-500' : 'text-green-500'
                        } bg-white rounded`} />
                      ) : (
                        <Square size={20} className="text-gray-400 bg-white rounded" />
                      )}
                    </div>

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
        {step === 'preview' && cards.length > 0 && !loading && (
          <div className="p-6 border-t border-gray-100">
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
                {selectedPage === 'all' 
                  ? <><strong className="text-yellow-600">{cards.length}件</strong>を保存します</>
                  : <><strong className="text-yellow-600">{cards.length}件</strong>（{selectedPage}/{totalPages}ページ）を保存します</>
                }
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep('pageSelect')}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  ページ選択に戻る
                </button>
                <button
                  onClick={saveToDatabase}
                  disabled={saving}
                  className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
                >
                  <Save size={16} />
                  DBに保存
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
