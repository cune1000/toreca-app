'use client'

import { memo } from 'react'
import RarityBadge from './RarityBadge'
import type { TcgCard } from '../hooks/useTcgApiState'
import { isValidPrice } from '../hooks/useTcgApiState'

interface CardListItemProps {
  card: TcgCard
  selected: boolean
  onSelect: (card: TcgCard) => void
  showRegistration: boolean
  isChecked: boolean
  isRegistered: boolean
  onToggleCheck: (cardId: string) => void
}

export default memo(function CardListItem({
  card,
  selected,
  onSelect,
  showRegistration,
  isChecked,
  isRegistered,
  onToggleCheck,
}: CardListItemProps) {
  const price = card.market_price
  const cardKey = String(card.tcgplayer_id)

  return (
    <div
      role="listitem"
      aria-label={`${card.name} ${card.number ? `#${card.number}` : ''}${isValidPrice(price) ? ` $${price!.toFixed(2)}` : ''}`}
      tabIndex={selected ? 0 : -1}
      className={`flex items-center gap-2 px-3 py-2.5 rounded-[var(--jtcg-radius)] cursor-pointer transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--jtcg-ink-light)] ${
        selected
          ? 'bg-[rgba(15,76,129,0.08)] border-l-2 border-[var(--jtcg-ink)]'
          : 'border-l-2 border-transparent hover:bg-gray-50/80'
      } ${isRegistered ? 'opacity-60' : ''}`}
      onClick={() => onSelect(card)}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(card) } }}
    >
      {showRegistration && (
        <div className="shrink-0 flex items-center gap-1" onClick={e => e.stopPropagation()}>
          <label className="flex items-center justify-center w-8 h-8 -m-1 cursor-pointer">
            <input
              type="checkbox"
              checked={isChecked}
              onChange={() => onToggleCheck(cardKey)}
              className="rounded w-3.5 h-3.5 accent-[var(--jtcg-ink)]"
            />
          </label>
          {isRegistered && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-bold">済</span>
          )}
        </div>
      )}

      {/* サムネイル画像 */}
      {card.image_url ? (
        <img
          src={card.image_url}
          alt=""
          className="w-8 h-11 object-contain rounded shrink-0"
          loading="lazy"
        />
      ) : (
        <div className="shrink-0">
          <RarityBadge rarity={card.rarity} />
        </div>
      )}

      {card.number && (
        <span
          className="text-[11px] text-[var(--jtcg-text-muted)] w-14 shrink-0 tabular-nums"
          style={{ fontFamily: 'var(--font-price)' }}
        >
          #{card.number}
        </span>
      )}

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--jtcg-text)] truncate leading-tight">{card.name}</p>
        {card.printing !== 'Normal' && (
          <p className="text-[10px] text-[var(--jtcg-text-muted)] truncate">{card.printing}</p>
        )}
      </div>

      <div className="text-right shrink-0 w-16">
        {isValidPrice(price) ? (
          <span className="text-sm font-bold text-[var(--jtcg-text)] tabular-nums" style={{ fontFamily: 'var(--font-price)' }}>
            ${price.toFixed(2)}
          </span>
        ) : (
          <span className="text-xs text-[var(--jtcg-text-muted)]">--</span>
        )}
      </div>

      {card.total_listings > 0 && (
        <div className="w-10 text-right shrink-0">
          <span className="text-[10px] text-[var(--jtcg-text-muted)] tabular-nums">
            {card.total_listings}
          </span>
        </div>
      )}
    </div>
  )
})
