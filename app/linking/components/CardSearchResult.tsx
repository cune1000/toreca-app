'use client'

import { memo } from 'react'
import type { LinkableCard } from '../lib/types'

interface CardSearchResultProps {
  card: LinkableCard
  score?: number
  matchType?: string
  onLink: (card: LinkableCard) => void
}

export default memo(function CardSearchResult({ card, score, matchType, onLink }: CardSearchResultProps) {
  return (
    <div
      className="flex items-center gap-2 px-2.5 py-2 hover:bg-[var(--lk-border-light)] cursor-pointer rounded-[var(--lk-radius)] transition-colors"
      onClick={() => onLink(card)}
    >
      {/* 画像 */}
      <div className="w-8 h-10 rounded bg-[var(--lk-border-light)] overflow-hidden shrink-0">
        {card.imageUrl ? (
          <img src={card.imageUrl} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-[var(--lk-text-muted)] text-[7px]">
            No img
          </div>
        )}
      </div>

      {/* カード情報 */}
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-[var(--lk-text)] truncate leading-tight">
          {card.name}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          {card.cardNumber && (
            <span className="text-[9px] text-[var(--lk-text-muted)]">{card.cardNumber}</span>
          )}
          {card.expansion && (
            <span className="text-[9px] text-[var(--lk-text-muted)] truncate">{card.expansion}</span>
          )}
          {card.rarity && (
            <span className="text-[9px] px-1 rounded bg-[var(--lk-border-light)] text-[var(--lk-text-secondary)]">
              {card.rarity}
            </span>
          )}
        </div>
      </div>

      {/* スコア */}
      {score != null && (
        <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
          score >= 90 ? 'bg-green-100 text-green-700'
            : score >= 70 ? 'bg-amber-100 text-amber-700'
            : 'bg-gray-100 text-gray-600'
        }`} style={{ fontFamily: 'var(--font-price)' }}>
          {score}
        </span>
      )}
    </div>
  )
})
