'use client'

import { memo } from 'react'
import { Check, Link2, Unlink } from 'lucide-react'
import type { ExternalItem } from '../lib/types'

interface ExternalItemRowProps {
  item: ExternalItem
  selected: boolean
  checked: boolean
  onSelect: () => void
  onToggleCheck: () => void
  showCheckbox: boolean
}

export default memo(function ExternalItemRow({
  item,
  selected,
  checked,
  onSelect,
  onToggleCheck,
  showCheckbox,
}: ExternalItemRowProps) {
  const isLinked = !!item.linkedCardId

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors border-b border-[var(--lk-border-light)] ${
        selected
          ? 'bg-[var(--lk-accent-light)]'
          : 'hover:bg-[var(--lk-border-light)]'
      }`}
      onClick={onSelect}
    >
      {/* チェックボックス */}
      {showCheckbox && (
        <button
          onClick={e => { e.stopPropagation(); onToggleCheck() }}
          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
            checked
              ? 'bg-[var(--lk-accent)] border-[var(--lk-accent)] text-white'
              : 'border-[var(--lk-border)] hover:border-[var(--lk-accent)]'
          }`}
        >
          {checked && <Check size={10} strokeWidth={3} />}
        </button>
      )}

      {/* 画像 */}
      <div className="w-8 h-8 rounded bg-[var(--lk-border-light)] overflow-hidden shrink-0">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[var(--lk-text-muted)] text-[8px]">
            No img
          </div>
        )}
      </div>

      {/* 名前・型番 */}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-[var(--lk-text)] truncate leading-tight">
          {item.name}
        </p>
        {item.modelno && (
          <p className="text-[9px] text-[var(--lk-text-muted)] truncate">{item.modelno}</p>
        )}
      </div>

      {/* 価格 */}
      {item.price != null && item.price > 0 && (
        <span className="text-[11px] font-medium text-[var(--lk-text)] shrink-0 tabular-nums" style={{ fontFamily: 'var(--font-price)' }}>
          ¥{item.price.toLocaleString()}
        </span>
      )}

      {/* 紐づけ状態 */}
      <span className={`shrink-0 ${isLinked ? 'text-[var(--lk-linked)]' : 'text-[var(--lk-text-muted)]'}`}>
        {isLinked ? <Link2 size={12} /> : <Unlink size={12} />}
      </span>
    </div>
  )
})
