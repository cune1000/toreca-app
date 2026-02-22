'use client'

import { useState, useEffect, useMemo } from 'react'

interface JTSet {
  id: string
  name: string
  cards_count: number
  release_date: string | null
}

interface JTVariant {
  id: string
  condition: string
  printing: string
  language: string
  price: number | null
  lastUpdated: number | null
  priceChange7d: number | null
  priceChange30d: number | null
  avgPrice: number | null
}

interface JTCard {
  id: string
  name: string
  number: string
  set: string
  set_name: string
  rarity: string
  variants: JTVariant[]
}

interface Usage {
  dailyUsed: number
  dailyLimit: number
  dailyRemaining: number
  monthlyUsed: number
  monthlyLimit: number
  monthlyRemaining: number
}

interface PCMatch {
  id: string
  name: string
  consoleName: string
  loosePrice: number | null
  loosePriceDollars: number | null
}

export default function JustTcgExplorer() {
  const [sets, setSets] = useState<JTSet[]>([])
  const [selectedSetId, setSelectedSetId] = useState('')
  const [cards, setCards] = useState<JTCard[]>([])
  const [usage, setUsage] = useState<Usage | null>(null)
  const [loadingSets, setLoadingSets] = useState(true)
  const [loadingCards, setLoadingCards] = useState(false)
  const [search, setSearch] = useState('')
  const [rarityFilter, setRarityFilter] = useState('')
  const [setFilterText, setSetFilterText] = useState('')
  const [pcMatches, setPcMatches] = useState<Record<string, PCMatch | null>>({})
  const [pcLoading, setPcLoading] = useState<Record<string, boolean>>({})
  const [error, setError] = useState('')

  // セット一覧取得
  useEffect(() => {
    fetch('/api/justtcg/sets')
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setSets(res.data || [])
          if (res.usage) setUsage(res.usage)
        } else {
          setError(res.error || 'セット取得失敗')
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoadingSets(false))
  }, [])

  // カード取得（全件、価格順）
  useEffect(() => {
    if (!selectedSetId) { setCards([]); return }
    setLoadingCards(true)
    setSearch('')
    setRarityFilter('')
    setPcMatches({})
    fetch(`/api/justtcg/cards?set=${encodeURIComponent(selectedSetId)}`)
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setCards(res.data || [])
          if (res.usage) setUsage(res.usage)
        } else {
          setError(res.error || 'カード取得失敗')
        }
      })
      .catch(e => setError(e.message))
      .finally(() => setLoadingCards(false))
  }, [selectedSetId])

  // レアリティ一覧
  const rarities = useMemo(() => {
    const set = new Set(cards.map(c => c.rarity).filter(Boolean))
    return Array.from(set).sort()
  }, [cards])

  // フィルタ済みカード
  const filtered = useMemo(() => {
    let list = cards
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.number.toLowerCase().includes(q)
      )
    }
    if (rarityFilter) {
      list = list.filter(c => c.rarity === rarityFilter)
    }
    return list
  }, [cards, search, rarityFilter])

  // セット検索フィルタ
  const filteredSets = useMemo(() => {
    if (!setFilterText) return sets
    const q = setFilterText.toLowerCase()
    return sets.filter(s => s.name.toLowerCase().includes(q) || s.id.toLowerCase().includes(q))
  }, [sets, setFilterText])

  // NM価格取得
  const getNmPrice = (card: JTCard) => {
    const nm = card.variants.find(v => v.condition === 'Near Mint' && v.printing === 'Normal')
      || card.variants.find(v => v.condition === 'Near Mint')
      || card.variants[0]
    return nm
  }

  // PC検索
  const handlePcMatch = async (card: JTCard) => {
    if (pcLoading[card.id]) return
    setPcLoading(prev => ({ ...prev, [card.id]: true }))
    try {
      const res = await fetch('/api/justtcg/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: card.name, number: card.number }),
      })
      const json = await res.json()
      if (json.success) {
        setPcMatches(prev => ({ ...prev, [card.id]: json.data }))
      } else {
        setPcMatches(prev => ({ ...prev, [card.id]: null }))
      }
    } catch {
      setPcMatches(prev => ({ ...prev, [card.id]: null }))
    } finally {
      setPcLoading(prev => ({ ...prev, [card.id]: false }))
    }
  }

  // 7d変動率フォーマット
  const formatChange = (change: number | null) => {
    if (change == null) return null
    const pct = (change * 100).toFixed(1)
    if (change > 0) return <span className="text-green-600 text-xs font-bold">+{pct}%</span>
    if (change < 0) return <span className="text-red-500 text-xs font-bold">{pct}%</span>
    return <span className="text-gray-400 text-xs">0%</span>
  }

  // 更新日時フォーマット
  const formatUpdated = (ts: number | null) => {
    if (!ts) return '-'
    const d = new Date(ts * 1000)
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const selectedSet = sets.find(s => s.id === selectedSetId)

  return (
    <div className="min-h-screen bg-[#f8f9fb]">
      {/* ヘッダー */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 md:px-8 md:py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🔍</span>
              <h1 className="text-lg font-bold text-gray-900">JustTCG Explorer</h1>
            </div>
            {usage && (
              <div className="flex items-center gap-2 text-xs">
                <span className={`px-2 py-1 rounded-full font-bold ${
                  usage.dailyRemaining < 10 ? 'bg-red-100 text-red-700' :
                  usage.dailyRemaining < 30 ? 'bg-amber-100 text-amber-700' :
                  'bg-green-100 text-green-700'
                }`}>
                  API: {usage.dailyRemaining}/{usage.dailyLimit}
                </span>
                <span className="text-gray-400 hidden sm:inline">
                  月: {usage.monthlyRemaining}/{usage.monthlyLimit}
                </span>
              </div>
            )}
          </div>

          {/* セット選択 */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-1 relative">
              <input
                type="text"
                value={setFilterText}
                onChange={e => setSetFilterText(e.target.value)}
                placeholder="セットを検索..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              />
              {setFilterText && filteredSets.length > 0 && !selectedSetId && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-60 overflow-y-auto z-40">
                  {filteredSets.slice(0, 20).map(s => (
                    <button
                      key={s.id}
                      onClick={() => { setSelectedSetId(s.id); setSetFilterText(s.name) }}
                      className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm border-b border-gray-50 last:border-0"
                    >
                      <span className="font-medium text-gray-800">{s.name}</span>
                      <span className="text-gray-400 ml-2">{s.cards_count}枚</span>
                      {s.release_date && <span className="text-gray-400 ml-2">{s.release_date}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <select
              value={selectedSetId}
              onChange={e => {
                setSelectedSetId(e.target.value)
                const s = sets.find(s => s.id === e.target.value)
                if (s) setSetFilterText(s.name)
              }}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200 max-w-full sm:max-w-xs"
            >
              <option value="">セットを選択</option>
              {sets.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.cards_count}枚){s.release_date ? ` - ${s.release_date}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 選択中セット情報 + フィルタ */}
          {selectedSet && (
            <div className="flex flex-col sm:flex-row gap-2 mt-2">
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="font-bold text-gray-700">{selectedSet.name}</span>
                <span>{selectedSet.cards_count}枚</span>
                {selectedSet.release_date && <span>{selectedSet.release_date}</span>}
              </div>
              <div className="flex gap-2 sm:ml-auto">
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="カード検索..."
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 w-40"
                />
                <select
                  value={rarityFilter}
                  onChange={e => setRarityFilter(e.target.value)}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                >
                  <option value="">全レアリティ</option>
                  {rarities.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* エラー */}
      {error && (
        <div className="max-w-6xl mx-auto px-4 md:px-8 mt-4">
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
            {error}
            <button onClick={() => setError('')} className="ml-2 text-red-500 hover:text-red-700">✕</button>
          </div>
        </div>
      )}

      {/* メインコンテンツ */}
      <div className="max-w-6xl mx-auto px-4 py-4 md:px-8 md:py-6">
        {loadingSets ? (
          <div className="text-center py-20">
            <div className="inline-block w-8 h-8 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
            <p className="text-sm text-gray-500 mt-3">セット一覧を読み込み中...</p>
          </div>
        ) : !selectedSetId ? (
          <div className="text-center py-20">
            <p className="text-4xl mb-3">📦</p>
            <p className="text-gray-500">セットを選択してカード一覧を表示</p>
            <p className="text-sm text-gray-400 mt-1">{sets.length} セット利用可能</p>
          </div>
        ) : loadingCards ? (
          <div className="text-center py-20">
            <div className="inline-block w-8 h-8 border-2 border-gray-200 border-t-gray-600 rounded-full animate-spin" />
            <p className="text-sm text-gray-500 mt-3">カード読み込み中...</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-400 mb-3">
              {filtered.length === cards.length
                ? `${cards.length}件（価格順）`
                : `${filtered.length} / ${cards.length}件`
              }
            </p>

            {/* PC: テーブル */}
            <div className="hidden md:block bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50">
                    <th className="text-left text-xs font-semibold text-gray-400 px-4 py-3 w-16">PC</th>
                    <th className="text-left text-xs font-semibold text-gray-400 px-4 py-3">カード名</th>
                    <th className="text-left text-xs font-semibold text-gray-400 px-4 py-3 w-24">型番</th>
                    <th className="text-left text-xs font-semibold text-gray-400 px-4 py-3 w-20">レア</th>
                    <th className="text-right text-xs font-semibold text-gray-400 px-4 py-3 w-28">NM価格</th>
                    <th className="text-right text-xs font-semibold text-gray-400 px-4 py-3 w-20">7d</th>
                    <th className="text-right text-xs font-semibold text-gray-400 px-4 py-3 w-20">PC価格</th>
                    <th className="text-right text-xs font-semibold text-gray-400 px-4 py-3 w-28">更新</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.length > 0 ? filtered.map(card => {
                    const nm = getNmPrice(card)
                    const pc = pcMatches[card.id]
                    const isPcLoading = pcLoading[card.id]
                    return (
                      <tr key={card.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3">
                          {pc !== undefined ? (
                            pc ? (
                              <a
                                href={`https://www.pricecharting.com/game/-/${pc.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:text-blue-800 text-xs font-bold"
                                title={pc.name}
                              >
                                PC
                              </a>
                            ) : (
                              <span className="text-gray-300 text-xs">-</span>
                            )
                          ) : (
                            <button
                              onClick={() => handlePcMatch(card)}
                              disabled={isPcLoading}
                              className="text-xs px-1.5 py-0.5 rounded bg-purple-50 text-purple-600 hover:bg-purple-100 disabled:opacity-50"
                            >
                              {isPcLoading ? '...' : '🔍'}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm font-medium text-gray-800">{card.name}</p>
                          {pc && (
                            <p className="text-xs text-purple-500 truncate">{pc.name}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{card.number}</td>
                        <td className="px-4 py-3">
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{card.rarity || '-'}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {nm?.price != null ? (
                            <span className="text-sm font-bold text-gray-900">${nm.price.toFixed(2)}</span>
                          ) : (
                            <span className="text-xs text-gray-300">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {formatChange(nm?.priceChange7d ?? null)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {pc?.loosePriceDollars != null ? (
                            <span className="text-sm font-bold text-purple-700">${pc.loosePriceDollars.toFixed(2)}</span>
                          ) : pc === null ? (
                            <span className="text-xs text-gray-300">-</span>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-gray-400">
                          {formatUpdated(nm?.lastUpdated ?? null)}
                        </td>
                      </tr>
                    )
                  }) : (
                    <tr>
                      <td colSpan={8} className="text-center py-12 text-sm text-gray-400">
                        該当するカードがありません
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* モバイル: カードリスト */}
            <div className="md:hidden space-y-2">
              {filtered.length > 0 ? filtered.map(card => {
                const nm = getNmPrice(card)
                const pc = pcMatches[card.id]
                const isPcLoading = pcLoading[card.id]
                return (
                  <div key={card.id} className="bg-white border border-gray-200 rounded-xl px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-gray-800 truncate">{card.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-500">#{card.number}</span>
                          <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{card.rarity || '-'}</span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {nm?.price != null ? (
                          <p className="text-sm font-bold text-gray-900">${nm.price.toFixed(2)}</p>
                        ) : (
                          <p className="text-xs text-gray-300">-</p>
                        )}
                        {formatChange(nm?.priceChange7d ?? null)}
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-xs text-gray-400">
                        更新: {formatUpdated(nm?.lastUpdated ?? null)}
                      </span>
                      <div className="flex items-center gap-2">
                        {pc && pc.loosePriceDollars != null && (
                          <span className="text-xs font-bold text-purple-700">PC: ${pc.loosePriceDollars.toFixed(2)}</span>
                        )}
                        {pc !== undefined ? (
                          pc ? (
                            <a
                              href={`https://www.pricecharting.com/game/-/${pc.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs px-2 py-1 rounded bg-purple-100 text-purple-700 font-bold"
                            >
                              PC
                            </a>
                          ) : (
                            <span className="text-xs text-gray-300">マッチなし</span>
                          )
                        ) : (
                          <button
                            onClick={() => handlePcMatch(card)}
                            disabled={isPcLoading}
                            className="text-xs px-2 py-1 rounded bg-purple-50 text-purple-600 hover:bg-purple-100 disabled:opacity-50"
                          >
                            {isPcLoading ? '検索中...' : '🔍 PC検索'}
                          </button>
                        )}
                      </div>
                    </div>
                    {pc && (
                      <p className="text-xs text-purple-500 mt-1 truncate">{pc.name}</p>
                    )}
                  </div>
                )
              }) : (
                <p className="text-center py-12 text-sm text-gray-400">該当するカードがありません</p>
              )}
            </div>

          </>
        )}
      </div>
    </div>
  )
}
