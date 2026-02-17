'use client'

import { useState } from 'react'
import { PriceChartingProduct } from '@/lib/types'

interface Props {
  cardId: string
  cardName: string
  pricechartingId?: string | null
  pricechartingName?: string | null
  onLinked?: () => void
}

const formatUsd = (pennies: number | undefined | null) => {
  if (pennies === undefined || pennies === null) return '-'
  return `$${(pennies / 100).toFixed(2)}`
}

/** sales-volume を人気度バッジの色に変換 */
const volumeBadge = (vol: string | undefined) => {
  const n = parseInt(vol || '0')
  if (n >= 100) return { label: `${vol}件`, color: 'bg-green-100 text-green-700' }
  if (n >= 30) return { label: `${vol}件`, color: 'bg-yellow-100 text-yellow-700' }
  if (n > 0) return { label: `${vol}件`, color: 'bg-gray-100 text-gray-500' }
  return null
}

export default function PriceChartingLink({ cardId, cardName, pricechartingId, pricechartingName, onLinked }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PriceChartingProduct[]>([])
  const [searching, setSearching] = useState(false)
  const [linking, setLinking] = useState(false)
  const [error, setError] = useState('')
  const [showManualInput, setShowManualInput] = useState(false)
  const [manualId, setManualId] = useState('')

  const search = async (q?: string) => {
    const searchQuery = q || query
    if (searchQuery.length < 2) {
      setError('2文字以上入力してください')
      return
    }
    setSearching(true)
    setError('')
    setResults([])
    try {
      const res = await fetch(`/api/overseas-prices/search?q=${encodeURIComponent(searchQuery)}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setResults(json.data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSearching(false)
    }
  }

  const link = async (pcId: string) => {
    setLinking(true)
    setError('')
    try {
      const res = await fetch('/api/overseas-prices/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ card_id: cardId, pricecharting_id: pcId }),
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
      const res = await fetch(`/api/overseas-prices/link?card_id=${cardId}`, { method: 'DELETE' })
      const json = await res.json()
      if (!json.success) throw new Error(json.error)
      setResults([])
      setQuery('')
      onLinked?.()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLinking(false)
    }
  }

  const pcPageUrl = (id: string) => `https://www.pricecharting.com/offers?product=${id}`

  return (
    <div className="space-y-3">
      {/* 紐付け済み表示 */}
      {pricechartingId && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-3 py-2.5 flex items-center gap-3">
          <div className="w-10 h-14 bg-blue-100 rounded-lg flex items-center justify-center text-lg flex-shrink-0">🌐</div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-gray-900 truncate">
              {pricechartingName || `ID: ${pricechartingId}`}
            </p>
            <div className="flex flex-wrap gap-1 mt-0.5">
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-200 text-blue-700 font-medium">
                PC ID: {pricechartingId}
              </span>
            </div>
            <a
              href={pcPageUrl(pricechartingId)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-blue-500 hover:underline mt-0.5 inline-block"
            >
              PriceChartingで確認（画像あり）→
            </a>
          </div>
          <button
            onClick={unlink}
            disabled={linking}
            className="text-xs px-3 py-1.5 bg-white border border-blue-200 text-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-50 flex-shrink-0"
          >
            解除
          </button>
        </div>
      )}

      {/* 検索フォーム */}
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="英語名で検索 (例: charizard base set)..."
          className="flex-1 px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100 focus:border-blue-300"
        />
        <button
          onClick={() => search()}
          disabled={searching}
          className="px-4 py-2.5 bg-gray-800 text-white rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-50 whitespace-nowrap"
        >
          {searching ? '検索中...' : '🔍 検索'}
        </button>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* 手動ID入力 */}
      <div>
        <button
          onClick={() => setShowManualInput(!showManualInput)}
          className="text-xs text-gray-400 hover:text-blue-500 underline"
        >
          {showManualInput ? '▲ 手動入力を閉じる' : '▼ 手動でPriceCharting IDを入力'}
        </button>
        {showManualInput && (
          <div className="mt-2 bg-gray-50 border border-gray-200 rounded-xl p-3">
            <div className="flex gap-2 items-center">
              <input
                type="text"
                value={manualId}
                onChange={e => setManualId(e.target.value)}
                placeholder="PriceCharting ID (例: 6910)"
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

      {/* 検索結果 */}
      {results.length > 0 && (
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {results.map(item => {
            const isLinked = String(pricechartingId) === String(item.id)
            const vol = volumeBadge(item['sales-volume'])
            return (
              <div
                key={item.id}
                className={`border rounded-xl p-3 ${isLinked
                  ? 'border-blue-300 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
              >
                <div className="flex gap-3 items-start">
                  <div className="flex-1 min-w-0">
                    {/* 商品名（大きく） */}
                    <p className="text-sm font-bold text-gray-900">{item['product-name']}</p>

                    {/* セット名・ジャンル・発売日・取引件数 */}
                    <div className="flex flex-wrap gap-1 mt-1">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-medium">
                        {item['console-name']}
                      </span>
                      {item.genre && item.genre !== item['console-name'] && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                          {item.genre}
                        </span>
                      )}
                      {item['release-date'] && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                          {item['release-date']}
                        </span>
                      )}
                      {vol && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${vol.color}`}>
                          取引 {vol.label}
                        </span>
                      )}
                    </div>

                    {/* 価格テーブル */}
                    <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 mt-2 text-[11px]">
                      <div>
                        <span className="text-gray-400">素体</span>
                        <span className="ml-1 font-medium text-gray-700">{formatUsd(item['loose-price'])}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">新品</span>
                        <span className="ml-1 font-medium text-gray-700">{formatUsd(item['new-price'])}</span>
                      </div>
                      <div>
                        <span className="text-gray-400">鑑定</span>
                        <span className="ml-1 font-medium text-gray-700">{formatUsd(item['graded-price'])}</span>
                      </div>
                    </div>

                    {/* アクション行 */}
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        onClick={() => link(item.id)}
                        disabled={linking || isLinked}
                        className={`px-3 py-1 rounded-lg text-[11px] font-medium transition-colors ${isLinked
                          ? 'bg-blue-200 text-blue-700 cursor-default'
                          : 'bg-gray-800 text-white hover:bg-gray-900 disabled:opacity-50'
                          }`}
                      >
                        {isLinked ? '✅ 紐付け済み' : '紐付け'}
                      </button>
                      <a
                        href={pcPageUrl(item.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-blue-500 hover:underline"
                      >
                        画像で確認 →
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {searching && (
        <div className="py-4 text-center">
          <div className="inline-block w-5 h-5 border-2 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
          <p className="text-xs text-gray-400 mt-2">PriceChartingを検索中...</p>
        </div>
      )}
    </div>
  )
}
