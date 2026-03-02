'use client'

import { Search, ChevronDown, ChevronUp, Link2, Unlink } from 'lucide-react'
import { LINK_FILTER_OPTIONS, SORT_OPTIONS } from '../lib/constants'
import type { LinkFilter, SortConfig } from '../lib/types'

interface LeftPanelProps {
  search: string
  setSearch: (s: string) => void
  linkFilter: LinkFilter
  setLinkFilter: (f: LinkFilter) => void
  sort: SortConfig
  setSort: (field: SortConfig['field']) => void
  stats: { total: number; linked: number; unlinked: number }
  loading: boolean
  className?: string
}

export default function LeftPanel({
  search, setSearch,
  linkFilter, setLinkFilter,
  sort, setSort,
  stats,
  loading,
  className = '',
}: LeftPanelProps) {
  return (
    <div className={`border-r border-[var(--lk-border)] bg-[var(--lk-surface)] overflow-y-auto ${className}`}>
      <div className="p-3 space-y-4">
        {/* 検索 */}
        <div>
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--lk-text-muted)]" />
            <input
              type="text"
              placeholder="商品名で検索..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs border border-[var(--lk-border)] rounded-[var(--lk-radius)] bg-white focus:outline-none focus:border-[var(--lk-accent)] focus:ring-1 focus:ring-[var(--lk-accent)]/30"
            />
          </div>
        </div>

        {/* 紐づけ状態フィルタ */}
        <div>
          <h3 className="text-[10px] font-bold text-[var(--lk-text-muted)] uppercase tracking-wider mb-1.5">紐づけ状態</h3>
          <div className="flex flex-wrap gap-1">
            {LINK_FILTER_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => setLinkFilter(opt.key)}
                className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors ${
                  linkFilter === opt.key
                    ? 'bg-[var(--lk-accent)] text-white'
                    : 'bg-[var(--lk-border-light)] text-[var(--lk-text-secondary)] hover:bg-[var(--lk-border)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* ソート */}
        <div>
          <h3 className="text-[10px] font-bold text-[var(--lk-text-muted)] uppercase tracking-wider mb-1.5">ソート</h3>
          <div className="space-y-0.5">
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.field}
                onClick={() => setSort(opt.field)}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-[var(--lk-radius)] text-[11px] transition-colors ${
                  sort.field === opt.field
                    ? 'bg-[var(--lk-accent-light)] text-[var(--lk-accent)] font-medium'
                    : 'text-[var(--lk-text-secondary)] hover:bg-[var(--lk-border-light)]'
                }`}
              >
                <span>{opt.label}</span>
                {sort.field === opt.field && (
                  sort.order === 'asc'
                    ? <ChevronUp size={12} />
                    : <ChevronDown size={12} />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* 統計 */}
        <div className="pt-2 border-t border-[var(--lk-border)]">
          <h3 className="text-[10px] font-bold text-[var(--lk-text-muted)] uppercase tracking-wider mb-2">統計</h3>
          <div className="space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-[var(--lk-text-secondary)]">合計</span>
              <span className="font-medium" style={{ fontFamily: 'var(--font-price)' }}>
                {loading ? '...' : stats.total.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="flex items-center gap-1 text-[var(--lk-linked)]">
                <Link2 size={10} />紐づけ済み
              </span>
              <span className="font-medium text-[var(--lk-linked)]" style={{ fontFamily: 'var(--font-price)' }}>
                {stats.linked.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="flex items-center gap-1 text-[var(--lk-unlinked)]">
                <Unlink size={10} />未紐づけ
              </span>
              <span className="font-medium text-[var(--lk-unlinked)]" style={{ fontFamily: 'var(--font-price)' }}>
                {stats.unlinked.toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
