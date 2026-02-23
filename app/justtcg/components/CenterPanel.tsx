'use client'

import { useRef, useMemo, useCallback, memo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Search, Package } from 'lucide-react'
import CardListItem from './CardListItem'
import type { JTCard } from '../hooks/useJustTcgState'

interface CenterPanelProps {
  // State data
  filteredCards: JTCard[]
  totalCards: number
  selectedCardId: string | null
  search: string
  loadingSets: boolean
  loadingCards: boolean
  hasSelectedSet: boolean
  totalSets: number
  rarities: string[]
  rarityFilter: Set<string>
  showRegistration: boolean
  // State setters
  setSearch: (v: string) => void
  toggleRarity: (rarity: string) => void
  clearRarityFilter: () => void
  onSelectCard: (card: JTCard | null) => void
  // Registration data
  checkedCards: Set<string>
  registered: Record<string, boolean>
  checkedCount: number
  readyCount: number
  readyOverwriteCount: number
  bulkProgress: { current: number; total: number; succeeded: number; failed: number } | null
  // Registration callbacks
  toggleCheck: (cardId: string) => void
  toggleAllFiltered: (filteredIds: string[]) => void
  handleBulkRegister: () => void
  handleBulkOverwrite: () => void
  cancelBulkRegister: () => void
  // Bulk PC search
  bulkPcProgress: { current: number; total: number; succeeded: number; failed: number } | null
  handleBulkPcSearchChecked: () => void
  handleBulkPcSearchFiltered: () => void
  cancelBulkPcSearch: () => void
  className?: string
}

const ROW_HEIGHT = 48

export default memo(function CenterPanel({
  filteredCards, totalCards, selectedCardId, search,
  loadingSets, loadingCards, hasSelectedSet, totalSets,
  rarities, rarityFilter, showRegistration,
  setSearch, toggleRarity, clearRarityFilter, onSelectCard,
  checkedCards, registered, checkedCount, readyCount, readyOverwriteCount, bulkProgress,
  toggleCheck, toggleAllFiltered, handleBulkRegister, handleBulkOverwrite, cancelBulkRegister,
  bulkPcProgress, handleBulkPcSearchChecked, handleBulkPcSearchFiltered, cancelBulkPcSearch,
  className = '',
}: CenterPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const getScrollElement = useCallback(() => scrollRef.current, [])
  const estimateSize = useCallback(() => ROW_HEIGHT, [])

  const virtualizer = useVirtualizer({
    count: filteredCards.length,
    getScrollElement,
    estimateSize,
    overscan: 10,
  })

  const showList = !loadingSets && hasSelectedSet && !loadingCards && filteredCards.length > 0

  // 全選択チェック（最大2000件の every() をメモ化）
  const filteredIds = useMemo(() => filteredCards.map(c => c.id), [filteredCards])
  // R13-FE01: 登録済みカードを除外して全選択状態を判定
  const allChecked = useMemo(() => {
    const unregistered = filteredIds.filter(id => !registered[id])
    return unregistered.length > 0 && unregistered.every(id => checkedCards.has(id))
  }, [filteredIds, checkedCards, registered])

  return (
    <main className={`flex flex-col overflow-hidden ${className}`}>
      {/* 検索バー */}
      <div className="p-3 border-b border-[var(--jtcg-border)] bg-[var(--jtcg-surface)] shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--jtcg-text-muted)]" size={14} />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="カード名・番号で検索..."
            className="w-full pl-9 pr-4 py-2 rounded-[var(--jtcg-radius)] border border-[var(--jtcg-border)] text-sm focus:outline-none focus:ring-1 focus:ring-[var(--jtcg-ink-light)] bg-white"
          />
        </div>
        <div className="flex items-center gap-2 mt-2 text-[10px] text-[var(--jtcg-text-muted)] flex-wrap">
          <span>
            {filteredCards.length === totalCards
              ? `${totalCards}件`
              : `${filteredCards.length} / ${totalCards}件`
            }
          </span>
          {rarities.length > 0 && (
            <>
              <span className="text-[var(--jtcg-border)]">|</span>
              <button
                onClick={clearRarityFilter}
                className={`px-2 py-0.5 rounded-full transition-colors ${
                  rarityFilter.size === 0 ? 'bg-[var(--jtcg-ink)] text-white font-bold' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              {rarities.map(r => (
                <button
                  key={r}
                  onClick={() => toggleRarity(r)}
                  aria-pressed={rarityFilter.has(r)}
                  className={`px-2 py-0.5 rounded-full transition-colors ${
                    rarityFilter.has(r) ? 'bg-[var(--jtcg-ink)] text-white font-bold' : 'bg-gray-100 hover:bg-gray-200'
                  }`}
                >
                  {r}
                </button>
              ))}
            </>
          )}
        </div>

        {/* 登録ツールバー（R14-08: bulk進行中はfilteredCards=0でも表示） */}
        {showRegistration && (filteredCards.length > 0 || bulkPcProgress || bulkProgress) && (
          <div className="mt-2 pt-2 border-t border-[var(--jtcg-border)] space-y-2">
            {/* 一括PC検索 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {bulkPcProgress ? (
                  <>
                    <span className="text-[10px] text-purple-600 tabular-nums" style={{ fontFamily: 'var(--font-price)' }}>
                      PC: {bulkPcProgress.current}/{bulkPcProgress.total}
                      {bulkPcProgress.failed > 0 && <span className="text-red-500 ml-1">({bulkPcProgress.failed}失敗)</span>}
                    </span>
                    <button
                      onClick={cancelBulkPcSearch}
                      className="text-[10px] px-2 py-0.5 rounded-[var(--jtcg-radius)] bg-red-100 text-red-700 font-bold hover:bg-red-200"
                    >
                      PC中止
                    </button>
                  </>
                ) : (
                  <>
                    {checkedCount > 0 && (
                      <button
                        onClick={handleBulkPcSearchChecked}
                        disabled={!!bulkProgress}
                        className="text-[10px] px-2 py-1 rounded-[var(--jtcg-radius)] bg-purple-50 text-purple-700 font-bold hover:bg-purple-100 disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        選択分PC検索
                      </button>
                    )}
                    <button
                      onClick={handleBulkPcSearchFiltered}
                      disabled={!!bulkProgress}
                      className="text-[10px] px-2 py-1 rounded-[var(--jtcg-radius)] bg-purple-50 text-purple-700 font-bold hover:bg-purple-100 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      表示中全PC検索
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* 選択・一括登録 */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleAllFiltered(filteredIds)}
                  className="text-[10px] px-2 py-1 rounded-[var(--jtcg-radius)] bg-gray-100 hover:bg-gray-200 text-[var(--jtcg-text-secondary)]"
                >
                  {allChecked ? '全解除' : '全選択'}
                </button>
                {checkedCount > 0 && (
                  <span className="text-xs text-[var(--jtcg-text-secondary)]">
                    {checkedCount}件選択
                  </span>
                )}
              </div>
              {checkedCount > 0 && (
                <div className="flex items-center gap-2">
                  {bulkProgress && (
                    <span className="text-[10px] text-[var(--jtcg-text-secondary)] tabular-nums">
                      {bulkProgress.current}/{bulkProgress.total}
                      {bulkProgress.failed > 0 && (
                        <span className="text-red-500 ml-1">({bulkProgress.failed}失敗)</span>
                      )}
                    </span>
                  )}
                  {bulkProgress ? (
                    <button
                      onClick={cancelBulkRegister}
                      className="text-xs px-3 py-1.5 rounded-[var(--jtcg-radius)] bg-red-100 text-red-700 font-bold hover:bg-red-200"
                    >
                      中止
                    </button>
                  ) : (
                    <div className="flex items-center gap-1.5">
                      {readyCount > 0 && (
                        <button
                          onClick={handleBulkRegister}
                          disabled={!!bulkPcProgress}
                          className="text-xs px-3 py-1.5 rounded-[var(--jtcg-radius)] bg-[var(--jtcg-ink)] text-white font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {`${readyCount}件を登録`}
                        </button>
                      )}
                      {readyOverwriteCount > 0 && (
                        <button
                          onClick={handleBulkOverwrite}
                          disabled={!!bulkPcProgress}
                          className="text-xs px-3 py-1.5 rounded-[var(--jtcg-radius)] bg-amber-500 text-white font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          {`${readyOverwriteCount}件を上書き`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* カードリスト */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {loadingSets ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--jtcg-text-muted)]">
            <div className="w-6 h-6 border-2 border-[var(--jtcg-border)] border-t-[var(--jtcg-ink)] rounded-full animate-spin" />
            <p className="text-sm mt-3">セット読み込み中...</p>
          </div>
        ) : !hasSelectedSet ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--jtcg-text-muted)]">
            <Package size={40} strokeWidth={1} />
            <p className="text-sm mt-3">セットを選択してカード一覧を表示</p>
            <p className="text-xs mt-1">{totalSets} セット利用可能</p>
          </div>
        ) : loadingCards ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--jtcg-text-muted)]">
            <div className="w-6 h-6 border-2 border-[var(--jtcg-border)] border-t-[var(--jtcg-ink)] rounded-full animate-spin" />
            <p className="text-sm mt-3">カード読み込み中...</p>
          </div>
        ) : filteredCards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[var(--jtcg-text-muted)]">
            <p className="text-sm">該当するカードがありません</p>
          </div>
        ) : showList ? (
          <div
            className="px-2 py-2"
            style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}
            role="list"
            aria-label="カード一覧"
          >
            {virtualizer.getVirtualItems().map(virtualRow => {
              const card = filteredCards[virtualRow.index]
              return (
                <div
                  key={card.id}
                  role="presentation"
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
                    selected={selectedCardId === card.id}
                    onSelect={onSelectCard}
                    showRegistration={showRegistration}
                    isChecked={checkedCards.has(card.id)}
                    isRegistered={!!registered[card.id]}
                    onToggleCheck={toggleCheck}
                  />
                </div>
              )
            })}
          </div>
        ) : null}
      </div>
    </main>
  )
})
