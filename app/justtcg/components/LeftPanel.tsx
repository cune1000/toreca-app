'use client'

import { ChevronDown, ChevronUp, Filter } from 'lucide-react'
import { GAME_OPTIONS, SORT_OPTIONS } from '../lib/constants'
import { getSetNameJa } from '@/lib/justtcg-set-names'
import type { useJustTcgState } from '../hooks/useJustTcgState'

type State = ReturnType<typeof useJustTcgState>

interface LeftPanelProps {
  state: State
  className?: string
}

export default function LeftPanel({ state, className = '' }: LeftPanelProps) {
  return (
    <aside className={`border-r border-[var(--jtcg-border)] bg-[var(--jtcg-surface)] overflow-y-auto ${className}`}>
      <div className="p-4 space-y-5">

        {/* ゲーム選択 */}
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--jtcg-text-muted)] mb-2">
            Game
          </h3>
          <div className="space-y-1">
            {GAME_OPTIONS.map(g => (
              <button
                key={g.id}
                onClick={() => state.setSelectedGame(g.id)}
                className={`w-full text-left px-2.5 py-1.5 rounded-[var(--jtcg-radius)] text-xs transition-colors ${
                  state.selectedGame === g.id
                    ? 'bg-[var(--jtcg-ink)] text-white font-bold'
                    : 'text-[var(--jtcg-text-secondary)] hover:bg-gray-50'
                }`}
              >
                {g.short}
              </button>
            ))}
          </div>
        </div>

        {/* セット選択 */}
        <div>
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--jtcg-text-muted)] mb-2">
            Set
          </h3>
          <input
            type="text"
            value={state.setFilterText}
            onChange={e => state.setSetFilterText(e.target.value)}
            placeholder="セット検索..."
            className="w-full border border-[var(--jtcg-border)] rounded-[var(--jtcg-radius)] px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--jtcg-ink-light)] bg-white mb-1.5"
          />
          <div className="max-h-48 overflow-y-auto space-y-0.5">
            {state.loadingSets ? (
              <p className="text-xs text-[var(--jtcg-text-muted)] py-3 text-center">読み込み中...</p>
            ) : (
              state.filteredSets.map(s => (
                <button
                  key={s.id}
                  onClick={() => state.selectSet(s.id)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-[var(--jtcg-radius)] text-xs transition-colors ${
                    state.selectedSetId === s.id
                      ? 'bg-[var(--jtcg-ink)]/10 text-[var(--jtcg-ink)] font-bold border-l-2 border-[var(--jtcg-ink)]'
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
                  if (state.sortBy === opt.value) {
                    state.setSortOrder(state.sortOrder === 'desc' ? 'asc' : 'desc')
                  } else {
                    state.setSortBy(opt.value)
                    state.setSortOrder('desc')
                  }
                }}
                className={`w-full text-left px-2.5 py-1.5 rounded-[var(--jtcg-radius)] text-xs flex items-center justify-between transition-colors ${
                  state.sortBy === opt.value
                    ? 'bg-gray-100 text-[var(--jtcg-text)] font-bold'
                    : 'text-[var(--jtcg-text-secondary)] hover:bg-gray-50'
                }`}
              >
                {opt.label}
                {state.sortBy === opt.value && (
                  state.sortOrder === 'desc'
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
            onClick={() => state.setJapaneseOnly(!state.japaneseOnly)}
            className={`w-full text-left px-2.5 py-1.5 rounded-[var(--jtcg-radius)] text-xs transition-colors ${
              state.japaneseOnly
                ? 'bg-amber-50 text-amber-800 border border-amber-200 font-bold'
                : 'text-[var(--jtcg-text-secondary)] hover:bg-gray-50 border border-transparent'
            }`}
          >
            {state.japaneseOnly ? '🇯🇵 日本語版のみ' : '全言語表示'}
          </button>
        </div>

        {/* 統計 */}
        {state.cards.length > 0 && (
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--jtcg-text-muted)] mb-2">
              Stats
            </h3>
            <div className="space-y-1 text-xs text-[var(--jtcg-text-secondary)]">
              <div className="flex justify-between">
                <span>合計</span>
                <span className="font-bold text-[var(--jtcg-text)]">{state.stats.totalCards}枚</span>
              </div>
              <div className="flex justify-between">
                <span>平均価格</span>
                <span className="font-bold" style={{ fontFamily: 'var(--font-price)' }}>
                  {state.stats.avgPrice > 0 ? `$${state.stats.avgPrice.toFixed(2)}` : '--'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>最高</span>
                <span style={{ fontFamily: 'var(--font-price)' }}>
                  {state.stats.maxPrice > 0 ? `$${state.stats.maxPrice.toFixed(2)}` : '--'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>最低</span>
                <span style={{ fontFamily: 'var(--font-price)' }}>
                  {state.stats.minPrice > 0 ? `$${state.stats.minPrice.toFixed(2)}` : '--'}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 登録モードトグル */}
        {state.cards.length > 0 && (
          <button
            onClick={state.toggleRegistration}
            className={`w-full text-xs px-3 py-2 rounded-[var(--jtcg-radius)] font-bold transition-colors flex items-center justify-center gap-1.5 ${
              state.showRegistration
                ? 'bg-[var(--jtcg-ink)] text-white'
                : 'bg-gray-100 text-[var(--jtcg-text-secondary)] hover:bg-gray-200'
            }`}
          >
            <Filter size={12} />
            {state.showRegistration ? '登録モード ON' : '登録モード'}
          </button>
        )}
      </div>
    </aside>
  )
}
