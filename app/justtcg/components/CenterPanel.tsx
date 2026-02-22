'use client'

import { useRef, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Search, Package } from 'lucide-react'
import CardListItem from './CardListItem'
import type { useJustTcgState } from '../hooks/useJustTcgState'
import type { JTCard } from '../hooks/useJustTcgState'
import type { useRegistration } from '../hooks/useRegistration'

type State = ReturnType<typeof useJustTcgState>
type Reg = ReturnType<typeof useRegistration>

interface CenterPanelProps {
  state: State
  reg: Reg
  onSelectCard?: (card: JTCard | null) => void
  className?: string
}

const ROW_HEIGHT = 48

export default function CenterPanel({ state, reg, onSelectCard, className = '' }: CenterPanelProps) {
  const handleSelect = onSelectCard || state.selectCard
  const scrollRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: state.filteredCards.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

  const showList = !state.loadingSets && !!state.selectedSetId && !state.loadingCards && state.filteredCards.length > 0

  // 全選択チェック（最大2000件の every() をメモ化）
  const filteredIds = useMemo(() => state.filteredCards.map(c => c.id), [state.filteredCards])
  const allChecked = useMemo(() =>
    filteredIds.length > 0 && filteredIds.every(id => reg.checkedCards.has(id))
  , [filteredIds, reg.checkedCards])

  return (
    <main className={`flex flex-col overflow-hidden ${className}`}>
      {/* 検索バー */}
      <div className="p-3 border-b border-[var(--jtcg-border)] bg-[var(--jtcg-surface)] shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--jtcg-text-muted)]" size={14} />
          <input
            type="text"
            value={state.search}
            onChange={e => state.setSearch(e.target.value)}
            placeholder="カード名・番号で検索..."
            className="w-full pl-9 pr-4 py-2 rounded-[var(--jtcg-radius)] border border-[var(--jtcg-border)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--jtcg-ink-light)] bg-white"
          />
        </div>
        <div className="flex items-center gap-2 mt-2 text-[10px] text-[var(--jtcg-text-muted)] flex-wrap">
          <span>
            {state.filteredCards.length === state.cards.length
              ? `${state.cards.length}件`
              : `${state.filteredCards.length} / ${state.cards.length}件`
            }
          </span>
          {state.rarities.length > 0 && (
            <>
              <span className="text-[var(--jtcg-border)]">|</span>
              <button
                onClick={() => state.setRarityFilter('')}
                className={`px-2 py-0.5 rounded-full transition-colors ${
                  !state.rarityFilter ? 'bg-[var(--jtcg-ink)] text-white font-bold' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              {state.rarities.map(r => (
                <button
                  key={r}
                  onClick={() => state.setRarityFilter(state.rarityFilter === r ? '' : r)}
                  className={`px-2 py-0.5 rounded-full transition-colors ${
                    state.rarityFilter === r ? 'bg-[var(--jtcg-ink)] text-white font-bold' : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {r}
                </button>
              ))}
            </>
          )}
        </div>

        {/* 登録ツールバー */}
        {state.showRegistration && state.filteredCards.length > 0 && (
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--jtcg-border)]">
            <div className="flex items-center gap-2">
              <button
                onClick={() => reg.toggleAllFiltered(filteredIds)}
                className="text-[10px] px-2 py-1 rounded-[var(--jtcg-radius)] bg-gray-100 hover:bg-gray-200 text-[var(--jtcg-text-secondary)]"
              >
                {allChecked ? '全解除' : '全選択'}
              </button>
              {reg.checkedCount > 0 && (
                <span className="text-xs text-[var(--jtcg-text-secondary)]">
                  {reg.checkedCount}件選択
                </span>
              )}
            </div>
            {reg.checkedCount > 0 && (
              <div className="flex items-center gap-2">
                {reg.bulkProgress && (
                  <span className="text-[10px] text-[var(--jtcg-text-secondary)] tabular-nums">
                    {reg.bulkProgress.current}/{reg.bulkProgress.total}
                  </span>
                )}
                <button
                  onClick={reg.handleBulkRegister}
                  disabled={reg.readyCount === 0 || !!reg.bulkProgress}
                  className="text-xs px-3 py-1.5 rounded-[var(--jtcg-radius)] bg-[var(--jtcg-ink)] text-white font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {reg.bulkProgress ? `登録中...` : `${reg.readyCount}件を一括登録`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* カードリスト */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {state.loadingSets ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--jtcg-text-muted)]">
            <div className="w-6 h-6 border-2 border-[var(--jtcg-border)] border-t-[var(--jtcg-ink)] rounded-full animate-spin" />
            <p className="text-sm mt-3">セット読み込み中...</p>
          </div>
        ) : !state.selectedSetId ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--jtcg-text-muted)]">
            <Package size={40} strokeWidth={1} />
            <p className="text-sm mt-3">セットを選択してカード一覧を表示</p>
            <p className="text-xs mt-1">{state.sets.length} セット利用可能</p>
          </div>
        ) : state.loadingCards ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--jtcg-text-muted)]">
            <div className="w-6 h-6 border-2 border-[var(--jtcg-border)] border-t-[var(--jtcg-ink)] rounded-full animate-spin" />
            <p className="text-sm mt-3">カード読み込み中...</p>
          </div>
        ) : state.filteredCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--jtcg-text-muted)]">
            <p className="text-sm">該当するカードがありません</p>
          </div>
        ) : showList ? (
          <div
            className="p-2"
            style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
          >
            {virtualizer.getVirtualItems().map(virtualRow => {
              const card = state.filteredCards[virtualRow.index]
              return (
                <div
                  key={card.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <CardListItem
                    card={card}
                    selected={state.selectedCard?.id === card.id}
                    onSelect={handleSelect}
                    showRegistration={state.showRegistration}
                    isChecked={reg.checkedCards.has(card.id)}
                    isRegistered={!!reg.registered[card.id]}
                    onToggleCheck={reg.toggleCheck}
                  />
                </div>
              )
            })}
          </div>
        ) : null}
      </div>
    </main>
  )
}
