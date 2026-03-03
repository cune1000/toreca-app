'use client'

import { useRef, memo } from 'react'
import { X } from 'lucide-react'
import RarityBadge from './RarityBadge'
import type { TcgCard, TcgSet } from '../hooks/useTcgApiState'
import { isValidPrice } from '../hooks/useTcgApiState'

interface RightPanelProps {
  card: TcgCard | null
  open: boolean
  onClose: () => void
  className?: string
  showRegistration: boolean
  jaName?: string
  onJaNameChange?: (v: string) => void
  expansionName?: string
  onExpansionChange?: (v: string) => void
  isRegistered?: boolean
  isRegistering?: boolean
  registerError?: string
  onRegister?: () => void
  scrollable?: boolean
  selectedSet?: TcgSet | null
}

export default memo(function RightPanel({
  card,
  open,
  onClose,
  className = '',
  showRegistration,
  jaName,
  onJaNameChange,
  expansionName,
  onExpansionChange,
  isRegistered,
  isRegistering,
  registerError,
  onRegister,
  scrollable = true,
  selectedSet,
}: RightPanelProps) {
  // カード切替時の処理
  const cardId = card?.id ?? null
  const prevCardIdRef = useRef(cardId)
  if (cardId !== prevCardIdRef.current) {
    prevCardIdRef.current = cardId
  }

  if (!card) return (
    <aside aria-label="カード詳細" className={`border-l border-[var(--jtcg-border)] bg-[var(--jtcg-surface)] ${scrollable ? 'overflow-y-auto' : ''} ${className || 'w-80 shrink-0'}`}>
      <div className="flex items-center justify-center h-full">
        <p className="text-xs text-[var(--jtcg-text-muted)]">カードを選択してください</p>
      </div>
    </aside>
  )

  return (
    <aside
      aria-label="カード詳細"
      className={`border-l border-[var(--jtcg-border)] bg-[var(--jtcg-surface)] ${scrollable ? 'overflow-y-auto' : ''} ${className || 'w-80 shrink-0'} transition-opacity duration-200 ease-in-out ${
        open ? 'opacity-100' : 'opacity-0 overflow-hidden pointer-events-none'
      }`}
    >
      <div className="p-4 space-y-4">
        {/* ヘッダー */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-[var(--jtcg-ink)] leading-tight break-words" style={{ fontFamily: 'var(--font-heading)' }}>
              {card.name}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              {card.number && (
                <span className="text-xs text-[var(--jtcg-text-muted)]" style={{ fontFamily: 'var(--font-price)' }}>
                  #{card.number}
                </span>
              )}
              <RarityBadge rarity={card.rarity} />
            </div>
            {card.printing !== 'Normal' && (
              <p className="text-[10px] text-[var(--jtcg-text-muted)] mt-0.5">{card.printing}</p>
            )}
            {/* セットコード・発売日 */}
            {(selectedSet?.abbreviation || selectedSet?.release_date) && (
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {selectedSet?.abbreviation && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-[var(--jtcg-text-secondary)] font-mono">
                    {selectedSet.abbreviation}
                  </span>
                )}
                {selectedSet?.release_date && (
                  <span className="text-[10px] text-[var(--jtcg-text-muted)]">
                    {selectedSet.release_date.slice(0, 10)}
                  </span>
                )}
              </div>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="詳細パネルを閉じる"
            className="p-2.5 -m-1.5 rounded-[var(--jtcg-radius)] hover:bg-gray-100 text-[var(--jtcg-text-muted)] shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* カード画像 */}
        {card.image_url && (
          <div className="flex justify-center">
            <img
              src={card.image_url}
              alt={card.name}
              className="w-48 h-auto object-contain rounded-lg shadow-sm"
            />
          </div>
        )}

        {/* 価格情報 */}
        <div className="bg-gray-50 rounded-[var(--jtcg-radius)] p-3 space-y-2">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-[var(--jtcg-text-muted)]">Market Price</span>
            <span className="text-lg font-bold text-[var(--jtcg-text)]" style={{ fontFamily: 'var(--font-price)' }}>
              {isValidPrice(card.market_price) ? `$${card.market_price.toFixed(2)}` : '--'}
            </span>
          </div>
          {isValidPrice(card.low_price) && (
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-[var(--jtcg-text-muted)]">Low Price</span>
              <span className="text-sm text-[var(--jtcg-text-secondary)]" style={{ fontFamily: 'var(--font-price)' }}>
                ${card.low_price.toFixed(2)}
              </span>
            </div>
          )}
          {isValidPrice(card.median_price) && (
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-[var(--jtcg-text-muted)]">Median Price</span>
              <span className="text-sm text-[var(--jtcg-text-secondary)]" style={{ fontFamily: 'var(--font-price)' }}>
                ${card.median_price.toFixed(2)}
              </span>
            </div>
          )}
          {card.total_listings > 0 && (
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-[var(--jtcg-text-muted)]">リスティング数</span>
              <span className="text-sm text-[var(--jtcg-text-secondary)]" style={{ fontFamily: 'var(--font-price)' }}>
                {card.total_listings}
              </span>
            </div>
          )}
        </div>

        {/* Foil Only バッジ */}
        {card.foil_only && (
          <div className="flex justify-center">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-300">
              Foil Only
            </span>
          </div>
        )}

        {/* メタ情報 */}
        <div className="bg-gray-50 rounded-[var(--jtcg-radius)] p-3 space-y-1.5 text-[10px] text-[var(--jtcg-text-muted)]">
          <div className="flex justify-between">
            <span>TCGPlayer ID</span>
            <span className="font-mono text-[var(--jtcg-text-secondary)]">{card.tcgplayer_id}</span>
          </div>
          {selectedSet?.abbreviation && card.number && (
            <div className="flex justify-between">
              <span>Set Code</span>
              <span className="font-mono text-[var(--jtcg-text-secondary)]">
                {selectedSet.abbreviation} / {card.number}
              </span>
            </div>
          )}
          {card.number && !selectedSet?.abbreviation && (
            <div className="flex justify-between">
              <span>Card #</span>
              <span className="font-mono text-[var(--jtcg-text-secondary)]">{card.number}</span>
            </div>
          )}
        </div>

        {/* 登録セクション */}
        {showRegistration && (
          <div className="border-t border-[var(--jtcg-border)] pt-4 space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--jtcg-text-muted)]">
              Register
            </h3>

            <div className="space-y-1.5">
              <input
                type="text"
                value={expansionName || ''}
                onChange={e => onExpansionChange?.(e.target.value)}
                placeholder="収録弾名..."
                aria-label="収録弾名"
                className="w-full border border-[var(--jtcg-border)] rounded-[var(--jtcg-radius)] px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--jtcg-ink-light)]"
              />
              <input
                type="text"
                value={jaName || ''}
                onChange={e => onJaNameChange?.(e.target.value)}
                placeholder="日本語名を入力..."
                aria-label="日本語名"
                className="w-full border border-[var(--jtcg-border)] rounded-[var(--jtcg-radius)] px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[var(--jtcg-ink-light)]"
              />
              <button
                onClick={() => onRegister?.()}
                disabled={isRegistering || !jaName?.trim()}
                className={`w-full text-xs px-3 py-2 rounded-[var(--jtcg-radius)] font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed ${
                  isRegistered
                    ? 'bg-amber-500 text-white'
                    : 'bg-[var(--jtcg-ink)] text-white'
                }`}
              >
                {isRegistering ? '処理中...' : isRegistered ? '上書き更新' : '登録'}
              </button>
              {isRegistered && (
                <p className="text-[10px] text-green-600 font-bold text-center">登録済み</p>
              )}
              {registerError && <p className="text-xs text-red-500" role="alert">{registerError}</p>}
            </div>
          </div>
        )}
      </div>
    </aside>
  )
})
