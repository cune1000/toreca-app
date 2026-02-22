'use client'

import { useState } from 'react'
import { Menu, X, Settings2 } from 'lucide-react'
import { useJustTcgState } from './hooks/useJustTcgState'
import { useRegistration } from './hooks/useRegistration'
import LeftPanel from './components/LeftPanel'
import CenterPanel from './components/CenterPanel'
import RightPanel from './components/RightPanel'
import { GAME_OPTIONS } from './lib/constants'

export default function JustTcgExplorer() {
  const state = useJustTcgState()
  const reg = useRegistration(state.cards, state.selectedSet, state.selectedGame, state.pcMatches)
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)

  const gameName = GAME_OPTIONS.find(g => g.id === state.selectedGame)?.short || 'JustTCG'

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* ヘッダー */}
      <header className="border-b border-[var(--jtcg-border)] bg-[var(--jtcg-surface)] px-4 py-2.5 shrink-0 z-20">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {/* モバイルメニューボタン */}
            <button
              onClick={() => setMobileFilterOpen(true)}
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

          <div className="flex items-center gap-2">
            {/* API使用量 */}
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
        </div>
      </header>

      {/* エラー */}
      {state.error && (
        <div className="bg-red-50 border-b border-red-200 px-4 py-2 text-xs text-red-700 flex items-center justify-between shrink-0">
          <span>{state.error}</span>
          <button onClick={state.clearError} className="text-red-400 hover:text-red-600 ml-2">
            <X size={14} />
          </button>
        </div>
      )}

      {/* 3カラム本体 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左パネル（デスクトップ） */}
        <LeftPanel state={state} className="w-56 shrink-0 hidden lg:block" />

        {/* 中央パネル */}
        <CenterPanel state={state} reg={reg} className="flex-1 min-w-0" />

        {/* 右パネル（デスクトップ） */}
        <div className="hidden lg:block">
          <RightPanel
            card={state.selectedCard}
            open={!!state.selectedCard}
            onClose={() => state.selectCard(null)}
            showRegistration={state.showRegistration}
            pcMatch={state.selectedCard ? state.pcMatches[state.selectedCard.id] : undefined}
            pcLoading={state.selectedCard ? state.pcLoading[state.selectedCard.id] : false}
            onPcMatch={() => state.selectedCard && state.handlePcMatch(state.selectedCard)}
            jaName={state.selectedCard ? reg.jaNames[state.selectedCard.id] : ''}
            onJaNameChange={v => state.selectedCard && reg.setJaName(state.selectedCard.id, v)}
            isRegistered={state.selectedCard ? !!reg.registered[state.selectedCard.id] : false}
            isRegistering={state.selectedCard ? !!reg.registering[state.selectedCard.id] : false}
            registerError={state.selectedCard ? reg.registerError[state.selectedCard.id] : ''}
            onRegister={() => state.selectedCard && reg.handleRegister(state.selectedCard)}
          />
        </div>
      </div>

      {/* モバイル: 左パネルドロワー */}
      {mobileFilterOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => setMobileFilterOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-[var(--jtcg-surface)] shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--jtcg-border)]">
              <h2 className="text-sm font-bold text-[var(--jtcg-ink)]" style={{ fontFamily: 'var(--font-heading)' }}>
                <Settings2 size={14} className="inline mr-1.5" />
                Filters
              </h2>
              <button
                onClick={() => setMobileFilterOpen(false)}
                className="p-1 rounded-[var(--jtcg-radius)] hover:bg-gray-100"
              >
                <X size={16} />
              </button>
            </div>
            <LeftPanel state={state} className="h-full overflow-y-auto" />
          </div>
        </div>
      )}

      {/* モバイル: カード詳細ボトムシート */}
      {state.selectedCard && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => state.selectCard(null)}
          />
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] bg-[var(--jtcg-surface)] rounded-t-2xl overflow-y-auto shadow-xl">
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-2 mb-1" />
            <RightPanel
              card={state.selectedCard}
              open={true}
              onClose={() => state.selectCard(null)}
              className="w-full"
              showRegistration={state.showRegistration}
              pcMatch={state.pcMatches[state.selectedCard.id]}
              pcLoading={state.pcLoading[state.selectedCard.id]}
              onPcMatch={() => state.handlePcMatch(state.selectedCard!)}
              jaName={reg.jaNames[state.selectedCard.id] || ''}
              onJaNameChange={v => reg.setJaName(state.selectedCard!.id, v)}
              isRegistered={!!reg.registered[state.selectedCard.id]}
              isRegistering={!!reg.registering[state.selectedCard.id]}
              registerError={reg.registerError[state.selectedCard.id] || ''}
              onRegister={() => reg.handleRegister(state.selectedCard!)}
            />
          </div>
        </div>
      )}
    </div>
  )
}
