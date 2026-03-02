'use client'

import { useRef, useCallback, useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronLeft, ChevronRight, Loader2, Check } from 'lucide-react'
import ExternalItemRow from './ExternalItemRow'
import type { ExternalItem, PaginationInfo, BulkLinkProgress } from '../lib/types'

const ROW_HEIGHT = 52

interface CenterPanelProps {
  items: ExternalItem[]
  loading: boolean
  selectedItemId: string | null
  onSelectItem: (item: ExternalItem | null) => void
  checkedItems: Set<string>
  toggleCheck: (id: string) => void
  toggleAllFiltered: () => void
  checkedCount: number
  pagination: PaginationInfo
  setPage: (page: number) => void
  bulkProgress: BulkLinkProgress | null
  onBulkLink: () => void
  cancelBulkLink: () => void
  className?: string
}

export default function CenterPanel({
  items,
  loading,
  selectedItemId,
  onSelectItem,
  checkedItems,
  toggleCheck,
  toggleAllFiltered,
  checkedCount,
  pagination,
  setPage,
  bulkProgress,
  onBulkLink,
  cancelBulkLink,
  className = '',
}: CenterPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const getScrollElement = useCallback(() => scrollRef.current, [])

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
  })

  const filteredIds = useMemo(() => items.map(i => i.id), [items])
  const allChecked = useMemo(
    () => filteredIds.length > 0 && filteredIds.every(id => checkedItems.has(id)),
    [filteredIds, checkedItems]
  )

  return (
    <div className={`flex flex-col overflow-hidden bg-[var(--lk-bg)] ${className}`}>
      {/* ツールバー */}
      <div className="shrink-0 px-3 py-2 border-b border-[var(--lk-border)] bg-[var(--lk-surface)] flex items-center gap-2">
        {/* 全選択チェックボックス */}
        <button
          onClick={toggleAllFiltered}
          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
            allChecked
              ? 'bg-[var(--lk-accent)] border-[var(--lk-accent)] text-white'
              : 'border-[var(--lk-border)] hover:border-[var(--lk-accent)]'
          }`}
        >
          {allChecked && <Check size={10} strokeWidth={3} />}
        </button>

        <span className="text-[10px] text-[var(--lk-text-secondary)]">
          {pagination.total.toLocaleString()}件
          {checkedCount > 0 && ` (${checkedCount}件選択)`}
        </span>

        <div className="flex-1" />

        {/* 一括紐づけ */}
        {bulkProgress?.running ? (
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-blue-600 tabular-nums" style={{ fontFamily: 'var(--font-price)' }}>
              {bulkProgress.processed}/{bulkProgress.total}
              ({bulkProgress.linked}件紐づけ)
            </span>
            <button
              onClick={cancelBulkLink}
              className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold hover:bg-red-200"
            >
              中止
            </button>
          </div>
        ) : checkedCount > 0 ? (
          <button
            onClick={onBulkLink}
            className="px-2.5 py-1 rounded-[var(--lk-radius)] bg-[var(--lk-accent)] text-white text-[10px] font-bold hover:opacity-90"
          >
            一括自動紐づけ ({checkedCount}件)
          </button>
        ) : null}

        {/* ページネーション */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="p-0.5 rounded text-[var(--lk-text-secondary)] hover:bg-[var(--lk-border-light)] disabled:opacity-30"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-[10px] text-[var(--lk-text-secondary)] tabular-nums" style={{ fontFamily: 'var(--font-price)' }}>
              {pagination.page}/{pagination.totalPages}
            </span>
            <button
              onClick={() => setPage(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="p-0.5 rounded text-[var(--lk-text-secondary)] hover:bg-[var(--lk-border-light)] disabled:opacity-30"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>

      {/* 商品一覧（仮想スクロール） */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={20} className="animate-spin text-[var(--lk-accent)]" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-12 text-[11px] text-[var(--lk-text-muted)]">
            商品が見つかりません
          </div>
        ) : (
          <div
            style={{
              height: virtualizer.getTotalSize(),
              position: 'relative',
              width: '100%',
            }}
          >
            {virtualizer.getVirtualItems().map(virtualItem => {
              const item = items[virtualItem.index]
              return (
                <div
                  key={item.id}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: virtualItem.size,
                    transform: `translateY(${virtualItem.start}px)`,
                  }}
                >
                  <ExternalItemRow
                    item={item}
                    selected={item.id === selectedItemId}
                    checked={checkedItems.has(item.id)}
                    onSelect={onSelectItem}
                    onToggleCheck={toggleCheck}
                    showCheckbox={true}
                  />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
