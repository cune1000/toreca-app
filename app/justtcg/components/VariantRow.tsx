'use client'

import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import type { JTVariant } from '../hooks/useJustTcgState'

function PriceChange({ change, label }: { change: number | null; label: string }) {
  if (change == null || isNaN(change)) return null
  const pct = change.toFixed(1)
  const isUp = change > 0
  const isDown = change < 0
  const Icon = isUp ? TrendingUp : isDown ? TrendingDown : Minus

  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold ${
      isUp ? 'text-[var(--jtcg-up)]' : isDown ? 'text-[var(--jtcg-down)]' : 'text-[var(--jtcg-text-muted)]'
    }`}>
      <Icon size={10} />
      {label}: {isUp ? '+' : ''}{pct}%
    </span>
  )
}

export default function VariantRow({ variant }: { variant: JTVariant }) {
  const isJapanese = variant.language === 'Japanese'

  return (
    <div className={`p-2.5 rounded-[var(--jtcg-radius)] text-xs ${
      isJapanese
        ? 'bg-amber-50/60 border border-amber-200/60'
        : 'bg-gray-50 border border-transparent'
    }`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="text-[var(--jtcg-text-secondary)] truncate">{variant.condition}</span>
          <span className="text-[var(--jtcg-border)]">|</span>
          <span className="text-[var(--jtcg-text-secondary)] truncate">{variant.printing}</span>
          <span className={`px-1 py-0.5 rounded text-[9px] font-bold shrink-0 ${
            isJapanese
              ? 'bg-amber-100 text-amber-800'
              : 'bg-gray-200 text-gray-600'
          }`}>
            {variant.language === 'Japanese' ? 'JA' : variant.language === 'English' ? 'EN' : (variant.language || '??').slice(0, 2).toUpperCase()}
          </span>
        </div>

        <span className="font-bold shrink-0" style={{ fontFamily: 'var(--font-price)' }}>
          {variant.price != null && !isNaN(variant.price) ? `$${variant.price.toFixed(2)}` : '--'}
        </span>
      </div>

      <div className="flex items-center gap-3 mt-1">
        <PriceChange change={variant.priceChange7d ?? null} label="7d" />
        <PriceChange change={variant.priceChange30d ?? null} label="30d" />
        {variant.avgPrice != null && !isNaN(variant.avgPrice) && (
          <span className="text-[10px] text-[var(--jtcg-text-muted)]">
            avg: ${variant.avgPrice.toFixed(2)}
          </span>
        )}
      </div>
    </div>
  )
}
