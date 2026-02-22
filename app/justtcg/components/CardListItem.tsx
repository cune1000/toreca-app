'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import RarityBadge from './RarityBadge'
import SparklineChart from './SparklineChart'
import type { JTCard } from '../hooks/useJustTcgState'
import { getNmVariant } from '../hooks/useJustTcgState'

interface CardListItemProps {
  card: JTCard
  selected: boolean
  onClick: () => void
  showRegistration: boolean
  isChecked: boolean
  isRegistered: boolean
  onToggleCheck: () => void
}

export default function CardListItem({
  card,
  selected,
  onClick,
  showRegistration,
  isChecked,
  isRegistered,
  onToggleCheck,
}: CardListItemProps) {
  const nm = getNmVariant(card)
  const hasJapanese = card.variants.some(v => v.language === 'Japanese')
  const priceHistory = nm?.priceHistory || []
  const change7d = nm?.priceChange7d

  return (
    <div
      className={`flex items-center gap-2 px-3 py-2.5 rounded-[var(--jtcg-radius)] cursor-pointer transition-all ${
        selected
          ? 'bg-[var(--jtcg-ink)]/5 border-l-2 border-[var(--jtcg-ink)]'
          : 'border-l-2 border-transparent hover:bg-gray-50/80'
      } ${isRegistered ? 'opacity-40' : ''}`}
      onClick={onClick}
    >
      {/* チェックボックス（登録モード時） */}
      {showRegistration && (
        <div className="shrink-0" onClick={e => e.stopPropagation()}>
          {isRegistered ? (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-bold">済</span>
          ) : (
            <input
              type="checkbox"
              checked={isChecked}
              onChange={onToggleCheck}
              className="rounded w-3.5 h-3.5 accent-[var(--jtcg-ink)]"
            />
          )}
        </div>
      )}

      {/* レアリティバッジ */}
      <div className="shrink-0">
        <RarityBadge rarity={card.rarity} />
      </div>

      {/* カード番号 */}
      <span
        className="text-[11px] text-[var(--jtcg-text-muted)] w-14 shrink-0 tabular-nums"
        style={{ fontFamily: 'var(--font-price)' }}
      >
        #{card.number}
      </span>

      {/* カード名 + セット名 */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[var(--jtcg-text)] truncate leading-tight">{card.name}</p>
        <p className="text-[10px] text-[var(--jtcg-text-muted)] truncate">{card.set_name}</p>
      </div>

      {/* 日本語フラグ */}
      {hasJapanese && <span className="text-xs shrink-0" title="日本語版あり">🇯🇵</span>}

      {/* 価格 */}
      <div className="text-right shrink-0 w-16">
        {nm?.price != null ? (
          <span
            className="text-sm font-bold text-[var(--jtcg-text)] tabular-nums"
            style={{ fontFamily: 'var(--font-price)' }}
          >
            ${nm.price.toFixed(2)}
          </span>
        ) : (
          <span className="text-xs text-[var(--jtcg-text-muted)]">--</span>
        )}
      </div>

      {/* 7日変動 */}
      <div className="w-14 text-right shrink-0">
        {change7d != null ? (
          <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold ${
            change7d > 0 ? 'text-[var(--jtcg-up)]' : change7d < 0 ? 'text-[var(--jtcg-down)]' : 'text-[var(--jtcg-text-muted)]'
          }`}>
            {change7d > 0 ? <TrendingUp size={10} /> : change7d < 0 ? <TrendingDown size={10} /> : <Minus size={10} />}
            {change7d > 0 ? '+' : ''}{(change7d * 100).toFixed(1)}%
          </span>
        ) : null}
      </div>

      {/* スパークライン */}
      <div className="w-16 h-6 shrink-0 hidden sm:block">
        {priceHistory.length > 1 && <SparklineChart data={priceHistory} />}
      </div>
    </div>
  )
}
