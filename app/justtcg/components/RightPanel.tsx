'use client'

import { useState, useMemo, useRef, memo } from 'react'
import { X, ChevronDown, ChevronUp, Search as SearchIcon, ExternalLink } from 'lucide-react'
import RarityBadge from './RarityBadge'
import VariantRow from './VariantRow'
import PriceHistoryChart from './PriceHistoryChart'
import type { JTCard, PCMatch } from '../hooks/useJustTcgState'
import { getNmVariant, formatUpdated, isValidPrice } from '../hooks/useJustTcgState'

const EMPTY_HISTORY: Array<{ p: number; t: number }> = []

interface RightPanelProps {
  card: JTCard | null
  open: boolean
  onClose: () => void
  className?: string
  // 登録モード
  showRegistration: boolean
  /** undefined=未検索, null=検索済み一致なし, PCMatch=一致あり */
  pcMatch?: PCMatch | null
  pcLoading?: boolean
  onPcMatch?: () => void
  jaName?: string
  onJaNameChange?: (v: string) => void
  expansionName?: string
  onExpansionChange?: (v: string) => void
  isRegistered?: boolean
  isRegistering?: boolean
  registerError?: string
  onRegister?: () => void
  /** false でスクロールを外部コンテナに委任（モバイルボトムシート用） */
  scrollable?: boolean
}

export default memo(function RightPanel({
  card,
  open,
  onClose,
  className = '',
  showRegistration,
  pcMatch,
  pcLoading,
  onPcMatch,
  jaName,
  onJaNameChange,
  expansionName,
  onExpansionChange,
  isRegistered,
  isRegistering,
  registerError,
  onRegister,
  scrollable = true,
}: RightPanelProps) {
  const [showChart, setShowChart] = useState(false)

  // UI-05: カード切替時にチャートを閉じる（エフェクト内setStateを排除 — 直接算出）
  const cardId = card?.id ?? null
  const prevCardIdRef = useRef(cardId)
  if (cardId !== prevCardIdRef.current) {
    prevCardIdRef.current = cardId
    if (showChart) setShowChart(false)
  }

  // FIX: 全てのHooksは早期returnの前に呼ぶ（Reactのルール）
  // variants を useMemo で安定化（card.variants が falsy の場合の空配列生成を防止）
  const variants = useMemo(() => card?.variants ?? [], [card?.variants])
  const japaneseVariants = useMemo(() => variants.filter(v => v.language === 'Japanese'), [variants])
  const otherVariants = useMemo(() => variants.filter(v => v.language !== 'Japanese'), [variants])

  // R11-17: w-80 固定でレイアウトジャンプ防止（プレースホルダー表示）
  // R12-15: scrollable propを空状態にも適用し、DOM構造の一貫性を保つ
  if (!card) return (
    <aside aria-label="カード詳細" className={`border-l border-[var(--jtcg-border)] bg-[var(--jtcg-surface)] ${scrollable ? 'overflow-y-auto' : ''} ${className || 'w-80 shrink-0'}`}>
      <div className="flex items-center justify-center h-full">
        <p className="text-xs text-[var(--jtcg-text-muted)]">カードを選択してください</p>
      </div>
    </aside>
  )
  const nm = getNmVariant(card)
  const priceHistory = nm?.priceHistory ?? EMPTY_HISTORY

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
              <span className="text-xs text-[var(--jtcg-text-muted)]" style={{ fontFamily: 'var(--font-price)' }}>
                #{card.number}
              </span>
              <RarityBadge rarity={card.rarity} />
            </div>
            <p className="text-[10px] text-[var(--jtcg-text-muted)] mt-0.5">{card.set_name}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="詳細パネルを閉じる"
            className="p-2.5 -m-1.5 rounded-[var(--jtcg-radius)] hover:bg-gray-100 text-[var(--jtcg-text-muted)] shrink-0"
          >
            <X size={16} />
          </button>
        </div>

        {/* メイン価格 */}
        {nm && (
          <div className="bg-gray-50 rounded-[var(--jtcg-radius)] p-3">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-[var(--jtcg-text-muted)]">NM 価格</span>
              <span className="text-lg font-bold text-[var(--jtcg-text)]" style={{ fontFamily: 'var(--font-price)' }}>
                {isValidPrice(nm.price) ? `$${nm.price.toFixed(2)}` : '--'}
              </span>
            </div>
            <div className="text-[10px] text-[var(--jtcg-text-muted)] text-right mt-0.5">
              更新: {formatUpdated(nm.lastUpdated ?? null)}
            </div>
          </div>
        )}

        {/* 日本語バリアント */}
        {japaneseVariants.length > 0 && (
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--jtcg-accent)] mb-2 flex items-center gap-1">
              🇯🇵 Japanese ({japaneseVariants.length})
            </h3>
            <div className="space-y-1.5">
              {japaneseVariants.map(v => <VariantRow key={v.id} variant={v} />)}
            </div>
          </div>
        )}

        {/* その他のバリアント */}
        {otherVariants.length > 0 && (
          <div>
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--jtcg-text-muted)] mb-2">
              Others ({otherVariants.length})
            </h3>
            <div className="space-y-1.5">
              {otherVariants.map(v => <VariantRow key={v.id} variant={v} />)}
            </div>
          </div>
        )}

        {/* 価格チャートトグル */}
        {priceHistory.length > 1 && (
          <div>
            <button
              onClick={() => setShowChart(!showChart)}
              aria-expanded={showChart}
              className="w-full text-xs text-center py-2 rounded-[var(--jtcg-radius)] border border-[var(--jtcg-border)] hover:bg-gray-50 transition-colors flex items-center justify-center gap-1.5 text-[var(--jtcg-text-secondary)]"
            >
              {showChart ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {showChart ? 'チャートを閉じる' : '価格推移チャート'}
            </button>
            {showChart && (
              <div className="mt-2">
                <PriceHistoryChart data={priceHistory} />
              </div>
            )}
          </div>
        )}

        {/* 登録セクション */}
        {showRegistration && (
          <div className="border-t border-[var(--jtcg-border)] pt-4 space-y-3">
            <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--jtcg-text-muted)]">
              Register
            </h3>

            {/* PC検索 */}
            {pcMatch === undefined ? (
              <button
                onClick={() => onPcMatch?.()}
                disabled={pcLoading}
                className="w-full text-xs px-3 py-2.5 rounded-[var(--jtcg-radius)] bg-purple-50 text-purple-700 font-bold hover:bg-purple-100 disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <SearchIcon size={12} />
                {pcLoading ? '検索中...' : 'PriceCharting 検索'}
              </button>
            ) : pcMatch ? (
              <div className="bg-purple-50/60 rounded-[var(--jtcg-radius)] p-2.5 space-y-1.5">
                <div className="flex items-start gap-2">
                  {pcMatch.imageUrl && (
                    <img src={pcMatch.imageUrl} alt={pcMatch.name} className="w-12 h-16 object-contain rounded shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-purple-800 truncate">{pcMatch.name}</p>
                    {isValidPrice(pcMatch.loosePriceDollars) && (
                      <p className="text-xs text-purple-600" style={{ fontFamily: 'var(--font-price)' }}>
                        PC: ${pcMatch.loosePriceDollars.toFixed(2)}
                      </p>
                    )}
                    {pcMatch.pricechartingUrl && (
                      <a
                        href={pcMatch.pricechartingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-[10px] text-purple-600 hover:underline mt-0.5"
                      >
                        PriceCharting <ExternalLink size={9} />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-xs text-[var(--jtcg-text-muted)]">PriceChartingで一致なし</p>
                <button
                  onClick={() => onPcMatch?.()}
                  disabled={pcLoading}
                  className="text-[10px] text-purple-600 hover:text-purple-800 underline disabled:opacity-50"
                >
                  {pcLoading ? '検索中...' : '再試行'}
                </button>
              </div>
            )}

            {/* 収録弾名・日本語名入力 + 登録ボタン */}
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
              {pcMatch === undefined && !isRegistered && (
                <p className="text-[10px] text-amber-600">PC検索未実施（画像なしで登録されます）</p>
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  )
})
