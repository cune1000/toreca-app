'use client'

import { useState, useCallback, useRef } from 'react'
import { Search, ChevronDown, ChevronUp, Link2, Unlink } from 'lucide-react'
import { LINK_FILTER_OPTIONS, SORT_OPTIONS } from '../lib/constants'
import type { LinkFilter, SortConfig, ItemFilterConfig, SetCodeInfo } from '../lib/types'

interface LeftPanelProps {
  search: string
  setSearch: (s: string) => void
  linkFilter: LinkFilter
  setLinkFilter: (f: LinkFilter) => void
  sort: SortConfig
  setSort: (field: SortConfig['field']) => void
  stats: { total: number; linked: number; unlinked: number }
  loading: boolean
  // 除外フィルタ
  itemFilter: ItemFilterConfig
  setExcludeLangs: (langs: string[]) => void
  setMinPrice: (price: number | null) => void
  setExcludeNoPrice: (v: boolean) => void
  setSetCode: (code: string | null) => void
  setCodes: SetCodeInfo[]
  sourceKey: string
  className?: string
}

const ALL_LANGS = ['CN', 'EN', 'KR', 'TW', 'ID', 'TH']

export default function LeftPanel({
  search, setSearch,
  linkFilter, setLinkFilter,
  sort, setSort,
  stats,
  loading,
  itemFilter,
  setExcludeLangs,
  setMinPrice,
  setExcludeNoPrice,
  setSetCode,
  setCodes,
  sourceKey,
  className = '',
}: LeftPanelProps) {
  // 最低価格のデバウンス
  const [minPriceInput, setMinPriceInput] = useState(itemFilter.minPrice != null ? String(itemFilter.minPrice) : '')
  const priceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleMinPriceChange = useCallback((val: string) => {
    setMinPriceInput(val)
    if (priceTimerRef.current) clearTimeout(priceTimerRef.current)
    priceTimerRef.current = setTimeout(() => {
      const num = parseInt(val)
      setMinPrice(isNaN(num) || num <= 0 ? null : num)
    }, 500)
  }, [setMinPrice])

  const excludeLangsActive = itemFilter.excludeLangs.length > 0

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

        {/* 除外フィルタ（スニダンのみ） */}
        {sourceKey === 'snkrdunk' && (
          <div>
            <h3 className="text-[10px] font-bold text-[var(--lk-text-muted)] uppercase tracking-wider mb-1.5">除外設定</h3>
            <div className="space-y-1.5">
              {/* 多言語除外 */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={excludeLangsActive}
                  onChange={e => setExcludeLangs(e.target.checked ? ALL_LANGS : [])}
                  className="w-3.5 h-3.5 rounded border-[var(--lk-border)] text-[var(--lk-accent)] focus:ring-[var(--lk-accent)]/30"
                />
                <span className="text-[11px] text-[var(--lk-text-secondary)]">多言語を除外</span>
              </label>

              {/* 価格なし除外 */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={itemFilter.excludeNoPrice}
                  onChange={e => setExcludeNoPrice(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-[var(--lk-border)] text-[var(--lk-accent)] focus:ring-[var(--lk-accent)]/30"
                />
                <span className="text-[11px] text-[var(--lk-text-secondary)]">価格なしを除外</span>
              </label>

              {/* 最低価格 */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-[var(--lk-text-secondary)] shrink-0">最低価格</span>
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={minPriceInput}
                  onChange={e => handleMinPriceChange(e.target.value)}
                  className="w-20 px-2 py-1 text-[11px] border border-[var(--lk-border)] rounded-[var(--lk-radius)] bg-white focus:outline-none focus:border-[var(--lk-accent)] tabular-nums"
                  style={{ fontFamily: 'var(--font-price)' }}
                />
                <span className="text-[11px] text-[var(--lk-text-muted)]">円</span>
              </div>
            </div>
          </div>
        )}

        {/* 収録弾フィルタ（スニダンのみ） */}
        {sourceKey === 'snkrdunk' && setCodes.length > 0 && (
          <div>
            <h3 className="text-[10px] font-bold text-[var(--lk-text-muted)] uppercase tracking-wider mb-1.5">収録弾</h3>
            <select
              value={itemFilter.setCode || ''}
              onChange={e => setSetCode(e.target.value || null)}
              className="w-full px-2 py-1.5 text-[11px] border border-[var(--lk-border)] rounded-[var(--lk-radius)] bg-white focus:outline-none focus:border-[var(--lk-accent)]"
            >
              <option value="">すべて</option>
              {setCodes.map(s => (
                <option key={s.code} value={s.code}>
                  {s.jaName} [{s.code}] ({s.count})
                </option>
              ))}
            </select>
          </div>
        )}

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
