'use client'

import { useState, useRef, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'
import { escapeIlike } from '@/lib/utils'
import { X, RefreshCw, Globe, Check, Square, CheckSquare, Save, AlertTriangle, ExternalLink } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface PCCard {
  id: number
  url: string
  pricechartingId: string | null
  pricechartingName: string
  imageUrl: string | null
  imageBase64: string | null
  setCode: string | null
  cardData: {
    name: string | null
    number: string | null
    rarity: string | null
    confidence: number
  } | null
  // 編集可能フィールド
  editName: string
  editNumber: string
  editRarity: string
  editSetCode: string
  // 状態
  exists: boolean
  existsReason?: string
  existingId?: string
  existingImageUrl?: string | null
  selected: boolean
  error?: string
}

interface Props {
  onClose: () => void
  onCompleted?: () => void
}

export default function PriceChartingImporter({ onClose, onCompleted }: Props) {
  const [urlInput, setUrlInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [cards, setCards] = useState<PCCard[]>([])
  const [error, setError] = useState<string | null>(null)
  const [fetchProgress, setFetchProgress] = useState('')
  const [saveProgress, setSaveProgress] = useState('')
  const [saveResult, setSaveResult] = useState<{ added: number; linked: number; skipped: number; errors: number } | null>(null)
  const [categoryLargeId, setCategoryLargeId] = useState<string>('')
  const [categories, setCategories] = useState<{ id: string; name: string; icon: string }[]>([])
  // 手動編集時の重複チェック結果
  const [editDupCheck, setEditDupCheck] = useState<Record<number, { checking: boolean; match?: string; matchId?: string }>>({})
  const dupCheckTimers = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  // 手動編集時に重複チェック（デバウンス付き）
  const checkDuplicate = useCallback((cardId: number, name: string, number: string) => {
    if (dupCheckTimers.current[cardId]) clearTimeout(dupCheckTimers.current[cardId])
    if (!name.trim() || !number.trim()) {
      setEditDupCheck(prev => { const n = { ...prev }; delete n[cardId]; return n })
      return
    }
    setEditDupCheck(prev => ({ ...prev, [cardId]: { checking: true } }))
    dupCheckTimers.current[cardId] = setTimeout(async () => {
      try {
        // 大文字小文字を無視して検索（ilike）
        const { data } = await supabase
          .from('cards')
          .select('id, name, card_number')
          .ilike('name', escapeIlike(name.trim()))
          .eq('card_number', number.trim())
          .limit(1)
        if (data?.length) {
          setEditDupCheck(prev => ({ ...prev, [cardId]: { checking: false, match: `${data[0].name} (${data[0].card_number})`, matchId: data[0].id } }))
        } else {
          setEditDupCheck(prev => ({ ...prev, [cardId]: { checking: false } }))
        }
      } catch {
        setEditDupCheck(prev => ({ ...prev, [cardId]: { checking: false } }))
      }
    }, 500)
  }, [])

  // URL抽出
  const getUrls = (): string[] => {
    return urlInput
      .split(/[\n\r,\s]+/)
      .map(u => u.trim())
      .filter(u => u.startsWith('http') && u.includes('pricecharting.com'))
  }

  // カテゴリ取得
  const fetchCategories = async () => {
    const { data } = await supabase.from('category_large').select('id, name, icon').order('sort_order')
    if (data) setCategories(data)
  }

  // スクレイピング+AI認識実行
  const handleFetch = async () => {
    const urls = getUrls()
    if (urls.length === 0) {
      setError('PriceChartingのURLを入力してください')
      return
    }

    setLoading(true)
    setError(null)
    setCards([])
    setSaveResult(null)
    setFetchProgress(`${urls.length}件のURLを処理中...`)

    // カテゴリも一緒に取得
    fetchCategories()

    try {
      const res = await fetch('/api/pricecharting-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls }),
      })
      const data = await res.json()

      if (!data.success) throw new Error(data.error)
      if (!data.results || data.results.length === 0) throw new Error('結果が取得できませんでした')

      // 重複チェック
      setFetchProgress('重複チェック中...')
      const cardsWithCheck: PCCard[] = await Promise.all(
        data.results.map(async (r: any, i: number) => {
          let exists = false
          let existsReason = ''
          let existingId = ''
          let existingImageUrl: string | null = null

          if (r.pricechartingId) {
            const { data: pcMatch } = await supabase
              .from('cards')
              .select('id, name, image_url')
              .eq('pricecharting_id', r.pricechartingId)
              .limit(1)
            if (pcMatch?.length) {
              exists = true
              existsReason = `PC ID一致: ${pcMatch[0].name}`
              existingId = pcMatch[0].id
              existingImageUrl = pcMatch[0].image_url
            }
          }

          if (!exists && r.cardData?.name && r.cardData?.number) {
            const { data: nameMatch } = await supabase
              .from('cards')
              .select('id, name, image_url')
              .eq('name', r.cardData.name)
              .eq('card_number', r.cardData.number)
              .limit(1)
            if (nameMatch?.length) {
              exists = true
              existsReason = `名前+型番一致`
              existingId = nameMatch[0].id
              existingImageUrl = nameMatch[0].image_url
            }
          }

          return {
            id: i,
            url: r.url,
            pricechartingId: r.pricechartingId,
            pricechartingName: r.pricechartingName,
            imageUrl: r.imageUrl,
            imageBase64: r.imageBase64 || null,
            setCode: r.setCode || null,
            cardData: r.cardData,
            editName: r.cardData?.name || r.pricechartingName || '',
            editNumber: r.cardData?.number || '',
            editRarity: r.cardData?.rarity || '',
            editSetCode: r.setCode || '',
            exists,
            existsReason,
            existingId,
            existingImageUrl,
            selected: !exists && !r.error,
            error: r.error,
          }
        })
      )

      setCards(cardsWithCheck)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
      setFetchProgress('')
    }
  }

  // 画像アップロード（サーバーから取得済みのbase64を使用、CORS回避）
  const uploadImage = async (card: PCCard): Promise<string | null> => {
    if (!card.imageBase64) return null
    try {
      const dataUri = `data:image/jpeg;base64,${card.imageBase64}`
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: dataUri, fileName: `pc_${card.pricechartingId || Date.now()}.jpg` }),
      })
      const data = await res.json()
      return data.success ? data.url : null
    } catch (e) {
      console.error('Image upload failed:', e)
      return null
    }
  }

  // PriceCharting紐付け（名前補完+価格取得）
  const linkPriceCharting = async (cardId: string, pricechartingId: string) => {
    await fetch('/api/overseas-prices/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card_id: cardId, pricecharting_id: pricechartingId }),
    }).catch(() => {})
    await fetch('/api/overseas-prices/update', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ card_id: cardId, pricecharting_id: pricechartingId }),
    }).catch(() => {})
  }

  // 一括登録
  const handleSave = async () => {
    const selected = cards.filter(c => c.selected)
    if (selected.length === 0) return

    setSaving(true)
    setError(null)
    setSaveResult(null)

    let added = 0
    let linked = 0
    let skipped = 0
    let errors = 0

    for (let i = 0; i < selected.length; i++) {
      const card = selected[i]
      setSaveProgress(`${i + 1}/${selected.length} ${card.exists ? '紐付け中' : '登録中'}: ${card.editName}`)

      try {
        // 登録済みカード → PriceCharting ID紐付け + 画像補完
        if (card.exists && card.existingId) {
          if (card.pricechartingId) {
            const updateFields: Record<string, any> = {
              pricecharting_id: card.pricechartingId,
              ...(card.editSetCode ? { set_code: card.editSetCode } : {}),
            }

            // 既存カードに画像がなければアップロード
            if (!card.existingImageUrl && card.imageBase64) {
              const uploadedUrl = await uploadImage(card)
              if (uploadedUrl) updateFields.image_url = uploadedUrl
            }

            await supabase
              .from('cards')
              .update(updateFields)
              .eq('id', card.existingId)

            await linkPriceCharting(card.existingId, card.pricechartingId)
            linked++
          } else {
            skipped++
          }
          continue
        }

        // 新規カード → 画像アップロード + カード登録
        const uploadedImageUrl = await uploadImage(card)

        const { data: insertedCard, error: insertError } = await supabase
          .from('cards')
          .insert({
            name: card.editName,
            card_number: card.editNumber || null,
            rarity: card.editRarity || null,
            image_url: uploadedImageUrl,
            pricecharting_id: card.pricechartingId,
            set_code: card.editSetCode || null,
            category_large_id: categoryLargeId || null,
          })
          .select('id')
          .single()

        if (insertError) throw insertError

        if (card.pricechartingId && insertedCard) {
          await linkPriceCharting(insertedCard.id, card.pricechartingId)
        }

        added++
      } catch (err) {
        console.error(`Failed to register ${card.editName}:`, err)
        errors++
      }
    }

    setSaveResult({ added, linked, skipped, errors })
    setSaving(false)
    setSaveProgress('')

    if ((added > 0 || linked > 0) && onCompleted) onCompleted()
  }

  // 選択操作
  const toggleSelect = (id: number) => {
    setCards(prev => prev.map(c => c.id === id ? { ...c, selected: !c.selected } : c))
  }
  const toggleAll = () => {
    const allSelected = cards.filter(c => !c.error).every(c => c.selected)
    setCards(prev => prev.map(c => c.error ? c : { ...c, selected: !allSelected }))
  }
  const selectNewOnly = () => {
    setCards(prev => prev.map(c => ({ ...c, selected: !c.exists && !c.error })))
  }

  const urlCount = getUrls().length
  const selectedCount = cards.filter(c => c.selected).length
  const newCount = cards.filter(c => !c.exists && !c.error).length
  const existingCount = cards.filter(c => c.exists).length

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-[1100px] max-h-[90vh] flex flex-col">
        {/* ヘッダー */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-gray-800">PriceChartingからインポート</h2>
            <p className="text-sm text-gray-500">URLから画像取得→AI認識→カード登録+海外価格紐付け</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-auto p-6">
          {/* フェーズ1: URL入力 */}
          {cards.length === 0 && !loading && !saveResult && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Globe size={40} className="text-blue-600" />
                </div>
                <p className="text-gray-600 mb-6">PriceChartingのURLを貼り付けてカードを一括登録</p>
              </div>

              <div className="max-w-2xl mx-auto">
                <textarea
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  onPaste={(e) => {
                    e.preventDefault()
                    const pasted = e.clipboardData.getData('text')
                    const urls = pasted.split(/[\n\r,\s]+/).map(s => s.trim()).filter(s => s.startsWith('http'))
                    if (urls.length > 0) {
                      const prev = urlInput.trim()
                      setUrlInput(prev ? prev + '\n' + urls.join('\n') : urls.join('\n'))
                    } else {
                      setUrlInput(prev => prev + pasted)
                    }
                  }}
                  placeholder={"PriceChartingのURLをまとめて貼り付け\nhttps://www.pricecharting.com/game/pokemon-japanese-promo/piplup-232s-p\nhttps://www.pricecharting.com/game/pokemon-japanese-promo/glaceon-nagaba-69sv-p"}
                  rows={6}
                  className="w-full px-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y text-sm"
                />
                <p className="text-xs text-gray-400 mt-2">
                  {urlCount > 0 ? `${urlCount}件のURL検出（最大40件）` : 'URLをまとめて貼り付け可能（スペース・カンマ区切りも対応）'}
                </p>
              </div>

              {error && (
                <div className="max-w-2xl mx-auto bg-red-50 border border-red-200 rounded-lg p-4 text-red-600 text-sm">
                  <AlertTriangle size={16} className="inline mr-2" />{error}
                </div>
              )}
            </div>
          )}

          {/* ローディング */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-16">
              <RefreshCw className="animate-spin text-blue-500 mb-4" size={40} />
              <p className="text-gray-600">{fetchProgress}</p>
              <p className="text-xs text-gray-400 mt-2">ページ取得 → 画像取得 → AI認識を実行中...</p>
            </div>
          )}

          {/* フェーズ2: プレビュー/選択 */}
          {cards.length > 0 && !saveResult && !saving && (
            <div>
              {/* 統計バー */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-600">取得: <strong>{cards.length}件</strong></span>
                  <span className="text-green-600">新規: <strong>{newCount}件</strong></span>
                  <span className="text-orange-600">既存: <strong>{existingCount}件</strong></span>
                  <span className="text-blue-600">選択中: <strong>{selectedCount}件</strong></span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={toggleAll} className="px-3 py-1 text-xs border rounded hover:bg-gray-50">
                    {cards.filter(c => !c.error).every(c => c.selected) ? '全解除' : '全選択'}
                  </button>
                  <button onClick={selectNewOnly} className="px-3 py-1 text-xs border rounded hover:bg-gray-50">
                    新規のみ
                  </button>
                </div>
              </div>

              {/* カテゴリ選択 */}
              <div className="mb-4">
                <select
                  value={categoryLargeId}
                  onChange={(e) => setCategoryLargeId(e.target.value)}
                  className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm"
                >
                  <option value="">ゲーム（一括指定）</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                </select>
              </div>

              {/* カードグリッド */}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                {cards.map(card => (
                  <div
                    key={card.id}
                    className={`border rounded-lg p-3 transition-colors ${
                      card.error ? 'border-red-200 bg-red-50 opacity-60' :
                      card.exists ? 'border-orange-200 bg-orange-50' :
                      card.selected ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                    }`}
                  >
                    <div className="flex gap-3">
                      {/* チェックボックス + 画像 */}
                      <div className="flex flex-col items-center gap-2">
                        <button onClick={() => !card.error && toggleSelect(card.id)} disabled={!!card.error}>
                          {card.selected ? <CheckSquare size={18} className="text-blue-500" /> : <Square size={18} className="text-gray-300" />}
                        </button>
                        {card.imageUrl ? (
                          <img src={card.imageUrl} alt={card.editName} className="w-16 h-22 object-cover rounded" />
                        ) : (
                          <div className="w-16 h-22 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-[10px]">No Img</div>
                        )}
                      </div>

                      {/* 情報 */}
                      <div className="flex-1 min-w-0 space-y-1.5">
                        {card.error ? (
                          <p className="text-xs text-red-500">{card.error}</p>
                        ) : (
                          <>
                            <input
                              value={card.editName}
                              onChange={(e) => {
                                const val = e.target.value
                                setCards(prev => prev.map(c => c.id === card.id ? { ...c, editName: val } : c))
                                checkDuplicate(card.id, val, card.editNumber)
                              }}
                              className="w-full px-2 py-1 border border-gray-200 rounded text-sm font-medium"
                              placeholder="カード名"
                            />
                            <div className="flex gap-1.5 items-center">
                              <input
                                value={card.editNumber}
                                onChange={(e) => {
                                  const val = e.target.value
                                  setCards(prev => prev.map(c => c.id === card.id ? { ...c, editNumber: val } : c))
                                  checkDuplicate(card.id, card.editName, val)
                                }}
                                className="w-24 px-2 py-0.5 border border-gray-200 rounded text-xs"
                                placeholder="型番"
                              />
                              <input
                                value={card.editRarity}
                                onChange={(e) => setCards(prev => prev.map(c => c.id === card.id ? { ...c, editRarity: e.target.value } : c))}
                                className="w-20 px-2 py-0.5 border border-gray-200 rounded text-xs"
                                placeholder="レアリティ"
                              />
                              <input
                                value={card.editSetCode}
                                onChange={(e) => setCards(prev => prev.map(c => c.id === card.id ? { ...c, editSetCode: e.target.value } : c))}
                                className="w-16 px-2 py-0.5 border border-amber-300 bg-amber-50 rounded text-xs font-mono"
                                placeholder="SET"
                              />
                            </div>
                            {editDupCheck[card.id]?.checking && (
                              <p className="text-[10px] text-gray-400">重複チェック中...</p>
                            )}
                            {editDupCheck[card.id]?.match && !editDupCheck[card.id]?.checking && (
                              <p className="text-[10px] text-red-500 font-medium">
                                ⚠ 既存カードと重複: {editDupCheck[card.id].match}
                              </p>
                            )}
                            {card.cardData && (
                              <span className="text-[10px] text-gray-400">
                                AI信頼度: {Math.round(card.cardData.confidence * 100)}%
                              </span>
                            )}
                            {card.exists && (
                              <p className="text-[10px] text-orange-600 font-medium">
                                {card.existsReason?.startsWith('PC ID一致')
                                  ? `⚡ PC紐付け済み: ${card.existsReason}`
                                  : `📎 登録済み（選択でPC紐付け）: ${card.existsReason}`}
                              </p>
                            )}
                            <a href={card.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-blue-500 hover:underline flex items-center gap-0.5">
                              <ExternalLink size={10} /> PriceCharting
                            </a>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {error && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 text-red-600 text-sm">
                  <AlertTriangle size={16} className="inline mr-2" />{error}
                </div>
              )}
            </div>
          )}

          {/* 登録中 */}
          {saving && (
            <div className="flex flex-col items-center justify-center py-16">
              <RefreshCw className="animate-spin text-blue-500 mb-4" size={40} />
              <p className="text-gray-600">{saveProgress}</p>
            </div>
          )}

          {/* フェーズ3: 完了 */}
          {saveResult && (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={40} className="text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-800 mb-4">インポート完了</h3>
              <div className="flex justify-center gap-6 text-sm">
                <span className="text-green-600">新規追加: <strong>{saveResult.added}件</strong></span>
                {saveResult.linked > 0 && <span className="text-blue-600">PC紐付け: <strong>{saveResult.linked}件</strong></span>}
                <span className="text-gray-500">スキップ: <strong>{saveResult.skipped}件</strong></span>
                {saveResult.errors > 0 && <span className="text-red-500">エラー: <strong>{saveResult.errors}件</strong></span>}
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="p-4 border-t border-gray-100 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {cards.length > 0 && !saveResult && `${selectedCount}件選択中`}
          </div>
          <div className="flex gap-3">
            {saveResult ? (
              <button onClick={onClose} className="px-6 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700">
                閉じる
              </button>
            ) : cards.length > 0 ? (
              <>
                <button
                  onClick={() => { setCards([]); setError(null) }}
                  className="px-4 py-2 border border-gray-200 rounded-lg hover:bg-gray-50"
                  disabled={saving}
                >
                  戻る
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || selectedCount === 0}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <Save size={16} />
                  {selectedCount}件を登録
                </button>
              </>
            ) : (
              <button
                onClick={handleFetch}
                disabled={loading || urlCount === 0}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                <Globe size={16} />
                {loading ? '取得中...' : `${urlCount}件を取得開始`}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
