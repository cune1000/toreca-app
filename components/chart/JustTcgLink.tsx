'use client'

import { useState } from 'react'

interface Props {
  cardId: string
  cardName: string
  justtcgId?: string | null
  justtcgPrice?: number | null
  onLinked?: () => void
}

interface JustTcgSet {
  id: string
  name: string
  cards_count: number
}

interface JustTcgCard {
  id: string
  name: string
  number: string
  rarity: string
  variants?: { condition: string; language: string; price: number | null }[]
}

const formatUsd = (price: number | null | undefined) => {
  if (price == null) return '-'
  return `$${price.toFixed(2)}`
}

export default function JustTcgLink({ cardId, cardName, justtcgId, justtcgPrice, onLinked }: Props) {
  const [game, setGame] = useState<'pokemon-japan' | 'one-piece-card-game'>('pokemon-japan')
  const [sets, setSets] = useState<JustTcgSet[]>([])
  const [cards, setCards] = useState<JustTcgCard[]>([])
  const [selectedSetId, setSelectedSetId] = useState('')
  const [setQuery, setSetQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [linking, setLinking] = useState(false)
  const [error, setError] = useState('')
  const [showManualInput, setShowManualInput] = useState(false)
  const [manualId, setManualId] = useState('')

  const fetchSets = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/justtcg/sets?game=${game}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setSets(json.data || [])
      setCards([])
      setSelectedSetId('')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchCards = async (setId: string) => {
    setSelectedSetId(setId)
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/justtcg/cards?set=${setId}&game=${game}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setCards(json.data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const link = async (jtcgId: string) => {
    setLinking(true)
    setError('')
    try {
      const res = await fetch('/api/justtcg/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_id: cardId, justtcg_id: jtcgId }),
      })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      onLinked?.()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLinking(false)
    }
  }

  const unlink = async () => {
    setLinking(true)
    setError('')
    try {
      const res = await fetch(`/api/justtcg/link?card_id=${cardId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setCards([])
      setSets([])
      onLinked?.()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLinking(false)
    }
  }

  const getBestPrice = (card: JustTcgCard) => {
    const v = card.variants || []
    const best =
      v.find(x => x.condition === 'Near Mint' && x.language === 'Japanese') ||
      v.find(x => x.condition === 'Near Mint') ||
      v.find(x => x.condition === 'Sealed' && x.language === 'Japanese') ||
      v.find(x => x.condition === 'Sealed') ||
      v.find(x => x.price != null && x.price > 0)
    return best?.price
  }

  const filteredSets = setQuery
    ? sets.filter(s => s.name.toLowerCase().includes(setQuery.toLowerCase()) || s.id.toLowerCase().includes(setQuery.toLowerCase()))
    : sets

  return (
    <div className="space-y-3">
      {/* 紐付け済み表示 */}
      {justtcgId && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 flex items-center gap-3">
          <div className="w-10 h-14 bg-emerald-100 rounded-lg flex items-center justify-center text-lg flex-shrink-0">💲</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-gray-900 truncate">{justtcgId}</p>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {justtcgPrice != null && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-200 text-emerald-700 font-medium">
                  NM: {formatUsd(justtcgPrice)}
                </span>
              )}
            </div>
          </div>
          <button
            onClick={unlink}
            disabled={linking}
            className="text-xs px-3 py-1.5 bg-white border border-emerald-200 text-emerald-600 rounded-lg hover:bg-emerald-50 disabled:opacity-50 flex-shrink-0"
          >
            解除
          </button>
        </div>
      )}

      {/* ゲーム選択 + セット取得 */}
      <div className="flex gap-2">
        <select
          value={game}
          onChange={e => setGame(e.target.value as any)}
          className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm"
        >
          <option value="pokemon-japan">ポケモン</option>
          <option value="one-piece-card-game">ワンピース</option>
        </select>
        <button
          onClick={fetchSets}
          disabled={loading}
          className="flex-1 px-4 py-2.5 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-50"
        >
          {loading && sets.length === 0 ? '読込中...' : 'セット一覧を取得'}
        </button>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* セット一覧 */}
      {sets.length > 0 && !selectedSetId && (
        <>
          <input
            type="text"
            value={setQuery}
            onChange={e => setSetQuery(e.target.value)}
            placeholder="セット名で絞り込み..."
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {filteredSets.map(s => (
              <button
                key={s.id}
                onClick={() => fetchCards(s.id)}
                className="w-full text-left px-3 py-2 border border-gray-200 rounded-lg hover:border-emerald-300 hover:bg-emerald-50 transition-colors"
              >
                <p className="text-sm font-medium text-gray-900">{s.name}</p>
                <p className="text-[10px] text-gray-400">{s.id} / {s.cards_count}枚</p>
              </button>
            ))}
          </div>
        </>
      )}

      {/* カード一覧 */}
      {selectedSetId && (
        <div>
          <button
            onClick={() => { setSelectedSetId(''); setCards([]) }}
            className="text-xs text-gray-400 hover:text-emerald-500 mb-2"
          >
            ← セット一覧に戻る
          </button>
          {loading ? (
            <div className="py-4 text-center">
              <div className="inline-block w-5 h-5 border-2 border-gray-200 border-t-emerald-600 rounded-full animate-spin" />
              <p className="text-xs text-gray-400 mt-2">カード取得中...</p>
            </div>
          ) : (
            <div className="space-y-1 max-h-[400px] overflow-y-auto">
              {cards.map(c => {
                const isLinked = justtcgId === c.id
                const price = getBestPrice(c)
                return (
                  <div
                    key={c.id}
                    className={`border rounded-lg p-2.5 ${isLinked ? 'border-emerald-300 bg-emerald-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}
                  >
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{c.name}</p>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">#{c.number}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">{c.rarity}</span>
                          {price != null && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">
                              {formatUsd(price)}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => link(c.id)}
                        disabled={linking || isLinked}
                        className={`px-3 py-1 rounded-lg text-[11px] font-medium flex-shrink-0 ${isLinked
                          ? 'bg-emerald-200 text-emerald-700 cursor-default'
                          : 'bg-gray-800 text-white hover:bg-gray-900 disabled:opacity-50'
                          }`}
                      >
                        {isLinked ? '紐付け済' : '紐付け'}
                      </button>
                    </div>
                  </div>
                )
              })}
              {cards.length === 0 && <p className="text-xs text-gray-400 text-center py-4">カードが見つかりません</p>}
            </div>
          )}
        </div>
      )}

      {/* 手動ID入力 */}
      <div>
        <button
          onClick={() => setShowManualInput(!showManualInput)}
          className="text-xs text-gray-400 hover:text-emerald-500 underline"
        >
          {showManualInput ? '▲ 手動入力を閉じる' : '▼ 手動でJustTCG IDを入力'}
        </button>
        {showManualInput && (
          <div className="mt-2 bg-gray-50 border border-gray-200 rounded-xl p-3">
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={manualId}
                onChange={e => setManualId(e.target.value)}
                placeholder="JustTCG ID (例: pokemon-japan-...)"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
              <button
                onClick={() => manualId && link(manualId)}
                disabled={linking || !manualId}
                className="px-4 py-2 bg-gray-800 text-white rounded-lg text-xs font-medium hover:bg-gray-900 disabled:opacity-50"
              >
                紐付け
              </button>
            </div>
          </div>
        )}
      </div>

      {loading && sets.length === 0 && (
        <div className="py-4 text-center">
          <div className="inline-block w-5 h-5 border-2 border-gray-200 border-t-emerald-600 rounded-full animate-spin" />
          <p className="text-xs text-gray-400 mt-2">JustTCGからセット取得中...</p>
        </div>
      )}
    </div>
  )
}
