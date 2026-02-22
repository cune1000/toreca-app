'use client'

import { useState, useCallback, useEffect } from 'react'
import { Menu, X, Settings2 } from 'lucide-react'
import { useJustTcgState } from './hooks/useJustTcgState'
import { useRegistration } from './hooks/useRegistration'
import LeftPanel from './components/LeftPanel'
import CenterPanel from './components/CenterPanel'
import RightPanel from './components/RightPanel'
import { GAME_OPTIONS } from './lib/constants'
import type { JTCard } from './hooks/useJustTcgState'

export default function JustTcgExplorer() {
  const state = useJustTcgState()
  const reg = useRegistration(state.cards, state.selectedSet, state.selectedGame, state.pcMatches)
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)

  const gameName = GAME_OPTIONS.find(g => g.id === state.selectedGame)?.short || 'JustTCG'
  const card = state.selectedCard
  const hasCards = state.cards.length > 0

  // モバイルでカード選択時にフィルタドロワーを閉じる
  const handleSelectCard = useCallback((c: JTCard | null) => {
    state.selectCard(c)
    if (c) setMobileFilterOpen(false)
  }, [state.selectCard])

  // モバイルオーバーレイのスクロールロック
  const isOverlayOpen = mobileFilterOpen || !!card
  useEffect(() => {
    if (isOverlayOpen) {
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = '' }
    }
  }, [isOverlayOpen])

  // ESCキーでオーバーレイを閉じる
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (card) state.selectCard(null)
        else if (mobileFilterOpen) setMobileFilterOpen(false)
      }
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [card, mobileFilterOpen, state.selectCard])

  // RightPanel用の安定コールバック
  const handleClosePanel = useCallback(() => state.selectCard(null), [state.selectCard])
  const handlePcMatch = useCallback(() => { if (card) state.handlePcMatch(card) }, [card, state.handlePcMatch])
  const handleJaNameChange = useCallback((v: string) => { if (card) reg.setJaName(card.id, v) }, [card, reg.setJaName])
  const handleRegister = useCallback(() => { if (card) reg.handleRegister(card) }, [card, reg.handleRegister])

  // LeftPanel共通props（デスクトップ・モバイル両方で使用）
  const leftPanelProps = {
    selectedGame: state.selectedGame,
    setSelectedGame: state.setSelectedGame,
    setFilterText: state.setFilterText,
    setSetFilterText: state.setSetFilterText,
    filteredSets: state.filteredSets,
    selectedSetId: state.selectedSetId,
    selectSet: state.selectSet,
    loadingSets: state.loadingSets,
    sortBy: state.sortBy,
    setSortBy: state.setSortBy,
    sortOrder: state.sortOrder,
    setSortOrder: state.setSortOrder,
    japaneseOnly: state.japaneseOnly,
    setJapaneseOnly: state.setJapaneseOnly,
    hasCards,
    stats: state.stats,
    showRegistration: state.showRegistration,
    toggleRegistration: state.toggleRegistration,
  } as const

  return (
    <div className="h-dvh flex flex-col overflow-hidden supports-[height:100dvh]:h-dvh" style={{ height: '100vh' }}>
      {/* ヘッダー */}
      <header className="border-b border-[var(--jtcg-border)] bg-[var(--jtcg-surface)] px-4 py-2.5 shrink-0 z-20">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileFilterOpen(true)}
              aria-label="フィルターを開く"
              className="lg:hidden p-1.5 rounded-[var(--jtcg-radius)] hover:bg-gray-100 text-[var(--jtcg-text-secondary)]"
            >
              <Menu size={18} />
            </button>
            <div>
              <h1
                className="text-base font-bold text-[var(--jtcg-ink)] leading-tight"
                style={{ fontFamily: 'var(--font-heading)' }}
              >
                JustTCG Explorer
              </h1>
              <p className="text-[10px] text-[var(--jtcg-text-muted)]">{gameName}</p>
            </div>
          </div>

          {state.usage && (
            <div className="flex items-center gap-1.5 text-[10px]">
              <span className={`px-2 py-0.5 rounded-full font-bold ${
                state.usage.dailyRemaining < 10 ? 'bg-red-100 text-red-700' :
                state.usage.dailyRemaining < 30 ? 'bg-amber-100 text-amber-700' :
                'bg-green-100 text-green-700'
              }`}>
                {state.usage.dailyRemaining}/{state.usage.dailyLimit}
              </span>
              <span className="text-[var(--jtcg-text-muted)] hidden sm:inline">
                月: {state.usage.monthlyRemaining}/{state.usage.monthlyLimit}
              </span>
            </div>
          )}
        </div>
      </header>

      {/* エラー */}
      {state.error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-xs text-red-700 flex items-center justify-between shrink-0">
          <span>{state.error}</span>
          <button onClick={state.clearError} aria-label="エラーを閉じる" className="text-red-400 hover:text-red-600 ml-2">
            <X size={14} />
          </button>
        </div>
      )}

      {/* 3カラム本体 */}
      <div className="flex flex-1 overflow-hidden">
        <LeftPanel {...leftPanelProps} className="w-56 shrink-0 hidden lg:block" />
        <CenterPanel
          filteredCards={state.filteredCards}
          totalCards={state.cards.length}
          selectedCardId={card?.id ?? null}
          search={state.search}
          setSearch={state.setSearch}
          loadingSets={state.loadingSets}
          loadingCards={state.loadingCards}
          hasSelectedSet={!!state.selectedSetId}
          totalSets={state.sets.length}
          rarities={state.rarities}
          rarityFilter={state.rarityFilter}
          setRarityFilter={state.setRarityFilter}
          showRegistration={state.showRegistration}
          onSelectCard={handleSelectCard}
          checkedCards={reg.checkedCards}
          registered={reg.registered}
          checkedCount={reg.checkedCount}
          readyCount={reg.readyCount}
          bulkProgress={reg.bulkProgress}
          toggleCheck={reg.toggleCheck}
          toggleAllFiltered={reg.toggleAllFiltered}
          handleBulkRegister={reg.handleBulkRegister}
          cancelBulkRegister={reg.cancelBulkRegister}
          className="flex-1 min-w-0"
        />
        {/* R11-17: カードがある場合のみ右パネルを表示（セット選択時に自然に出現） */}
        {hasCards && (
          <div className="hidden lg:block">
            <RightPanel
              card={card}
              open={!!card}
              onClose={handleClosePanel}
              showRegistration={state.showRegistration}
              pcMatch={card ? state.pcMatches[card.id] : undefined}
              pcLoading={card ? state.pcLoading[card.id] : false}
              onPcMatch={handlePcMatch}
              jaName={card ? reg.jaNames[card.id] : ''}
              onJaNameChange={handleJaNameChange}
              isRegistered={card ? !!reg.registered[card.id] : false}
              isRegistering={card ? !!reg.registering[card.id] : false}
              registerError={card ? reg.registerError[card.id] : ''}
              onRegister={handleRegister}
            />
          </div>
        )}
      </div>

      {/* モバイル: 左パネルドロワー（カード詳細が開いていたら非表示） */}
      {mobileFilterOpen && !card && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileFilterOpen(false)} />
          {/* R12-19: dialog role + aria-modal でスクリーンリーダー対応 */}
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-[var(--jtcg-surface)] shadow-xl flex flex-col" role="dialog" aria-modal="true" aria-label="フィルター">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--jtcg-border)] shrink-0">
              <h2 className="text-sm font-bold text-[var(--jtcg-ink)]" style={{ fontFamily: 'var(--font-heading)' }}>
                <Settings2 size={14} className="inline mr-1.5" />
                Filters
              </h2>
              <button onClick={() => setMobileFilterOpen(false)} aria-label="フィルターを閉じる" className="p-1 rounded-[var(--jtcg-radius)] hover:bg-gray-100">
                <X size={16} />
              </button>
            </div>
            <LeftPanel {...leftPanelProps} className="flex-1 min-h-0 overflow-y-auto" />
          </div>
        </div>
      )}

      {/* モバイル: カード詳細ボトムシート */}
      {card && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={handleClosePanel} />
          {/* R12-19: dialog role でスクリーンリーダー対応 */}
          <div className="absolute bottom-0 left-0 right-0 max-h-[85dvh] bg-[var(--jtcg-surface)] rounded-t-2xl overflow-y-auto shadow-xl overscroll-contain" style={{ maxHeight: '85vh' }} role="dialog" aria-modal="true" aria-label="カード詳細">
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-2 mb-1" />
            <RightPanel
              card={card}
              open={true}
              onClose={handleClosePanel}
              scrollable={false}
              className="w-full"
              showRegistration={state.showRegistration}
              pcMatch={state.pcMatches[card.id]}
              pcLoading={state.pcLoading[card.id] || false}
              onPcMatch={handlePcMatch}
              jaName={reg.jaNames[card.id] || ''}
              onJaNameChange={handleJaNameChange}
              isRegistered={!!reg.registered[card.id]}
              isRegistering={!!reg.registering[card.id]}
              registerError={reg.registerError[card.id] || ''}
              onRegister={handleRegister}
            />
          </div>
        </div>
      )}
    </div>
  )
}
