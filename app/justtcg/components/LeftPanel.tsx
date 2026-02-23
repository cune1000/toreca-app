'use client'

import { memo } from 'react'
import { ChevronDown, ChevronUp, Filter } from 'lucide-react'
import { GAME_OPTIONS, SORT_OPTIONS } from '../lib/constants'
import { getSetNameJa } from '@/lib/justtcg-set-names'
import type { JTSet } from '../hooks/useJustTcgState'
import type { SortKey } from '../lib/constants'

interface LeftPanelProps {
  selectedGame: string
  setSelectedGame: (game: string) => void
  setFilterText: string
  setSetFilterText: (text: string) => void
  filteredSets: JTSet[]
  selectedSetId: string
  selectSet: (id: string) => void
  loadingSets: boolean
  sortBy: SortKey
  setSortBy: (key: SortKey) => void
  sortOrder: 'asc' | 'desc'
  setSortOrder: (order: 'asc' | 'desc') => void
  japaneseOnly: boolean
  setJapaneseOnly: (v: boolean) => void
  hasCards: boolean
  stats: { totalCards: number; avgPrice: number; maxPrice: number; minPrice: number }
  showRegistration: boolean
  toggleRegistration: () => void
  className?: string
}

export default memo(function LeftPanel({
  selectedGame, setSelectedGame,
  setFilterText, setSetFilterText,
  filteredSets, selectedSetId, selectSet,
  loadingSets,
  sortBy, setSortBy, sortOrder, setSortOrder,
  japaneseOnly, setJapaneseOnly,
  hasCards, stats, showRegistration, toggleRegistration,
  className = '',
}: LeftPanelProps) {
  return (
    <aside className={`border-r border-[var(--jtcg-border)] bg-[var(--jtcg-surface)] overflow-y-auto ${className}`}>
      <div className="p-4 space-y-5">

        {/* ゲーム選択 */}
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--jtcg-text-muted)] mb-2">
            Game
          </h3>
          <select
            value={selectedGame}
            onChange={e => setSelectedGame(e.target.value)}
            className="w-full px-2.5 py-1.5 rounded-[var(--jtcg-radius)] text-xs border border-[var(--jtcg-border)] bg-white focus:outline-none focus:ring-1 focus:ring-[var(--jtcg-ink-light)]"
          >
            {GAME_OPTIONS.map(g => (
              <option key={g.id} value={g.id}>{g.short}</option>
            ))}
          </select>
        </div>

        {/* セット選択 */}
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--jtcg-text-muted)] mb-2">
            Set
          </h3>
          <input
            type="text"
            value={setFilterText}
            onChange={e => setSetFilterText(e.target.value)}
            placeholder="セット検索..."
            className="w-full border border-[var(--jtcg-border)] rounded-[var(--jtcg-radius)] px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--jtcg-ink-light)] bg-white mb-1.5"
          />
          <div className="max-h-64 overflow-y-auto overscroll-contain space-y-0.5">
            {loadingSets ? (
              <p className="text-xs text-[var(--jtcg-text-muted)] py-3 text-center">読み込み中...</p>
            ) : (
              filteredSets.map(s => (
                <button
                  key={s.id}
                  onClick={() => selectSet(s.id)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-[var(--jtcg-radius)] text-xs transition-colors ${
                    selectedSetId === s.id
                      ? 'bg-[rgba(27,58,107,0.1)] text-[var(--jtcg-ink)] font-bold border-l-2 border-[var(--jtcg-ink)]'
                      : 'text-[var(--jtcg-text)] hover:bg-gray-50'
                  }`}
                >
                  <span className="block truncate">{getSetNameJa(s.id, s.name)}</span>
                  <span className="text-[10px] text-[var(--jtcg-text-muted)]">
                    {s.cards_count}枚{s.release_date ? ` / ${s.release_date.slice(0, 10)}` : ''}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>

        {/* ソート */}
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--jtcg-text-muted)] mb-2">
            Sort
          </h3>
          <div className="space-y-1">
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => {
                  if (sortBy === opt.value) {
                    setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')
                  } else {
                    setSortBy(opt.value)
                    setSortOrder('desc')
                  }
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-[var(--jtcg-radius)] text-xs flex items-center justify-between transition-colors ${
                  sortBy === opt.value
                    ? 'bg-gray-100 text-[var(--jtcg-text)] font-bold'
                    : 'text-[var(--jtcg-text-secondary)] hover:bg-gray-50'
                }`}
              >
                {opt.label}
                {sortBy === opt.value && (
                  sortOrder === 'desc'
                    ? <ChevronDown size={12} />
                    : <ChevronUp size={12} />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 言語フィルタ */}
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--jtcg-text-muted)] mb-2">
            Language
          </h3>
          <button
            onClick={() => setJapaneseOnly(!japaneseOnly)}
            className={`w-full text-left px-2.5 py-1.5 rounded-[var(--jtcg-radius)] text-xs transition-colors ${
              japaneseOnly
                ? 'bg-amber-50 text-amber-800 border border-amber-200 font-bold'
                : 'text-[var(--jtcg-text-secondary)] hover:bg-gray-50 border border-transparent'
            }`}
          >
            {japaneseOnly ? '🇯🇵 日本語版のみ' : '全言語表示'}
          </button>
        </div>

        {/* 統計 */}
        {hasCards && (
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--jtcg-text-muted)] mb-2">
              Stats
            </h3>
            <div className="space-y-1 text-xs text-[var(--jtcg-text-secondary)]">
              <div className="flex justify-between">
                <span>合計</span>
                <span className="font-bold text-[var(--jtcg-text)]">{stats.totalCards}枚</span>
              </div>
              <div className="flex justify-between">
                <span>平均価格</span>
                <span className="font-bold" style={{ fontFamily: 'var(--font-price)' }}>
                  {stats.avgPrice > 0 ? `$${stats.avgPrice.toFixed(2)}` : '--'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>最高</span>
                <span style={{ fontFamily: 'var(--font-price)' }}>
                  {stats.maxPrice > 0 ? `$${stats.maxPrice.toFixed(2)}` : '--'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>最低</span>
                <span style={{ fontFamily: 'var(--font-price)' }}>
                  {stats.minPrice > 0 ? `$${stats.minPrice.toFixed(2)}` : '--'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 登録モードトグル */}
        {hasCards && (
          <button
            onClick={toggleRegistration}
            className={`w-full text-xs px-3 py-2 rounded-[var(--jtcg-radius)] font-bold transition-colors flex items-center justify-center gap-1.5 ${
              showRegistration
                ? 'bg-[var(--jtcg-ink)] text-white'
                : 'bg-gray-100 text-[var(--jtcg-text-secondary)] hover:bg-gray-200'
            }`}
          >
            <Filter size={12} />
            {showRegistration ? '登録モード ON' : '登録モード'}
          </button>
        )}
      </div>
    </aside>
  )
})
