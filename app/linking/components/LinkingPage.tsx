'use client'

import { useCallback, useEffect, useState } from 'react'
import { Menu, X } from 'lucide-react'
import { useLinkingState } from '../hooks/useLinkingState'
import { useBulkLinking } from '../hooks/useBulkLinking'
import LeftPanel from './LeftPanel'
import CenterPanel from './CenterPanel'
import RightPanel from './RightPanel'
import type { ExternalItem, SourceConfig } from '../lib/types'

interface LinkingPageProps {
  config: SourceConfig
}

export default function LinkingPage({ config }: LinkingPageProps) {
  const state = useLinkingState(config)
  const bulk = useBulkLinking(state.updateItemLink)
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)
  const showCondition = config.key === 'shinsoku' || config.key === 'lounge'
  const [condition, setCondition] = useState('素体')

  const item = state.selectedItem
  const isOverlayOpen = mobileFilterOpen || !!item

  // スクロールロック
  useEffect(() => {
    if (isOverlayOpen) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [isOverlayOpen])

  // ESCキー
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (item) state.selectItem(null)
        else if (mobileFilterOpen) setMobileFilterOpen(false)
      }
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [item, mobileFilterOpen, state.selectItem])

  const handleSelectItem = useCallback((i: ExternalItem | null) => {
    state.selectItem(i)
    if (i) setMobileFilterOpen(false)
  }, [state.selectItem])

  const handleClosePanel = useCallback(() => state.selectItem(null), [state.selectItem])

  const handleLink = useCallback((itemId: string, cardId: string, cardName: string) => {
    state.updateItemLink(itemId, cardId, cardName)
  }, [state.updateItemLink])

  const handleUnlink = useCallback((itemId: string) => {
    state.updateItemLink(itemId, null, null)
  }, [state.updateItemLink])

  const handleBulkLink = useCallback(() => {
    const checked = state.items.filter(i => state.checkedItems.has(i.id))
    bulk.startBulkLink(checked, config, showCondition ? condition : undefined)
  }, [state.items, state.checkedItems, bulk.startBulkLink, config, showCondition, condition])

  const cssVars = {
    '--lk-source-color': config.accentColor,
    '--lk-source-color-light': config.accentColorLight,
  } as React.CSSProperties

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ height: '100vh', ...cssVars }}>
      {/* ヘッダー */}
      <header className="border-b border-[var(--lk-border)] bg-[var(--lk-surface)] px-4 py-2.5 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setMobileFilterOpen(true)}
            aria-label="フィルターを開く"
            className="lg:hidden p-1.5 rounded-[var(--lk-radius)] hover:bg-gray-100 text-[var(--lk-text-secondary)]"
          >
            <Menu size={18} />
          </button>
          <div>
            <h1 className="text-base font-bold text-[var(--lk-ink)] leading-tight" style={{ fontFamily: 'var(--font-heading)' }}>
              {config.label} 紐づけ
            </h1>
            <p className="text-[10px] text-[var(--lk-text-muted)]">ポケモンカード</p>
          </div>
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

      {/* 3カラム */}
      <div className="flex flex-1 overflow-hidden">
        <LeftPanel
          search={state.search}
          setSearch={state.setSearch}
          linkFilter={state.linkFilter}
          setLinkFilter={state.setLinkFilter}
          sort={state.sort}
          setSort={state.setSort}
          stats={state.stats}
          loading={state.loading}
          itemFilter={state.itemFilter}
          setExcludeLangs={state.setExcludeLangs}
          setMinPrice={state.setMinPrice}
          setExcludeNoPrice={state.setExcludeNoPrice}
          setSetCode={state.setSetCode}
          setCodes={state.setCodes}
          sourceKey={config.key}
          className="w-52 shrink-0 hidden lg:block"
        />
        <CenterPanel
          items={state.items}
          loading={state.loading}
          selectedItemId={item?.id ?? null}
          onSelectItem={handleSelectItem}
          checkedItems={state.checkedItems}
          toggleCheck={state.toggleCheck}
          toggleAllFiltered={state.toggleAllFiltered}
          checkedCount={state.checkedCount}
          pagination={state.pagination}
          setPage={state.setPage}
          bulkProgress={bulk.progress}
          onBulkLink={handleBulkLink}
          cancelBulkLink={bulk.cancel}
          className="flex-1 min-w-0"
        />
        <div className="hidden lg:block">
          <RightPanel
            item={item}
            open={!!item}
            onClose={handleClosePanel}
            config={config}
            onLink={handleLink}
            onUnlink={handleUnlink}
            condition={showCondition ? condition : undefined}
            onConditionChange={showCondition ? setCondition : undefined}
          />
        </div>
      </div>

      {/* モバイル: 左パネルドロワー */}
      {mobileFilterOpen && !item && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setMobileFilterOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-72 bg-[var(--lk-surface)] shadow-xl flex flex-col" role="dialog" aria-modal="true" aria-label="フィルター">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--lk-border)] shrink-0">
              <h2 className="text-sm font-bold text-[var(--lk-ink)]">フィルター</h2>
              <button onClick={() => setMobileFilterOpen(false)} aria-label="フィルターを閉じる" className="p-1 rounded hover:bg-gray-100">
                <X size={16} />
              </button>
            </div>
            <LeftPanel
              search={state.search}
              setSearch={state.setSearch}
              linkFilter={state.linkFilter}
              setLinkFilter={state.setLinkFilter}
              sort={state.sort}
              setSort={state.setSort}
              stats={state.stats}
              loading={state.loading}
              itemFilter={state.itemFilter}
              setExcludeLangs={state.setExcludeLangs}
              setMinPrice={state.setMinPrice}
              setExcludeNoPrice={state.setExcludeNoPrice}
              setSetCode={state.setSetCode}
              setCodes={state.setCodes}
              sourceKey={config.key}
              className="flex-1 min-h-0 overflow-y-auto"
            />
          </div>
        </div>
      )}

      {/* モバイル: 右パネルボトムシート */}
      {item && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={handleClosePanel} />
          <div
            className="absolute bottom-0 left-0 right-0 max-h-[85dvh] bg-[var(--lk-surface)] rounded-t-2xl overflow-y-auto shadow-xl overscroll-contain"
            style={{ maxHeight: '85vh' }}
            role="dialog" aria-modal="true" aria-label="商品詳細"
          >
            <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mt-2 mb-1" />
            <RightPanel
              item={item}
              open={true}
              onClose={handleClosePanel}
              config={config}
              onLink={handleLink}
              onUnlink={handleUnlink}
              className="w-full"
            />
          </div>
        </div>
      )}
    </div>
  )
}
