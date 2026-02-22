'use client'

import { useState } from 'react'
import { X, ChevronDown, ChevronUp, Search as SearchIcon, ExternalLink } from 'lucide-react'
import RarityBadge from './RarityBadge'
import VariantRow from './VariantRow'
import PriceHistoryChart from './PriceHistoryChart'
import type { JTCard, PCMatch } from '../hooks/useJustTcgState'
import { getNmVariant, formatUpdated } from '../hooks/useJustTcgState'

interface RightPanelProps {
  card: JTCard | null
  open: boolean
  onClose: () => void
  className?: string
  // 登録モード
  showRegistration: boolean
  pcMatch?: PCMatch | null
  pcLoading?: boolean
  onPcMatch?: () => void
  jaName?: string
  onJaNameChange?: (v: string) => void
  isRegistered?: boolean
  isRegistering?: boolean
  registerError?: string
  onRegister?: () => void
}

export default function RightPanel({
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
  isRegistered,
  isRegistering,
  registerError,
  onRegister,
}: RightPanelProps) {
  const [showChart, setShowChart] = useState(false)

  if (!card) return <aside className={`transition-all duration-300 w-0 overflow-hidden ${className}`} />

  const japaneseVariants = card.variants.filter(v => v.language === 'Japanese')
  const otherVariants = card.variants.filter(v => v.language !== 'Japanese')
  const nm = getNmVariant(card)
  const priceHistory = nm?.priceHistory || []

  return (
    <aside
      className={`border-l border-[var(--jtcg-border)] bg-[var(--jtcg-surface)] overflow-y-auto transition-all duration-300 ease-in-out shrink-0 ${
        open ? 'w-80 opacity-100' : 'w-0 opacity-0 overflow-hidden'
      } ${className}`}
    >
      <div className="p-4 space-y-4">
        {/* ヘッダー */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-[var(--jtcg-ink)] leading-tight" style={{ fontFamily: 'var(--font-heading)' }}>
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
            className="p-1 rounded-[var(--jtcg-radius)] hover:bg-gray-100 text-[var(--jtcg-text-muted)] shrink-0"
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
                {nm.price != null ? `$${nm.price.toFixed(2)}` : '--'}
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
                onClick={onPcMatch}
                disabled={pcLoading}
                className="w-full text-xs px-3 py-2 rounded-[var(--jtcg-radius)] bg-purple-50 text-purple-700 font-bold hover:bg-purple-100 disabled:opacity-50 flex items-center justify-center gap-1.5"
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
                    {pcMatch.loosePriceDollars != null && (
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
              <p className="text-xs text-[var(--jtcg-text-muted)]">PriceChartingで一致なし</p>
            )}

            {/* 日本語名入力 + 登録ボタン */}
            {isRegistered ? (
              <p className="text-xs text-green-600 font-bold py-2 text-center">登録完了</p>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={jaName || ''}
                  onChange={e => onJaNameChange?.(e.target.value)}
                  placeholder="日本語名を入力..."
                  className="w-full border border-[var(--jtcg-border)] rounded-[var(--jtcg-radius)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--jtcg-ink-light)]"
                />
                <button
                  onClick={onRegister}
                  disabled={isRegistering || !jaName?.trim()}
                  className="w-full text-xs px-3 py-2 rounded-[var(--jtcg-radius)] bg-[var(--jtcg-ink)] text-white font-bold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isRegistering ? '登録中...' : '登録'}
                </button>
                {registerError && <p className="text-xs text-red-500">{registerError}</p>}
                {pcMatch === undefined && (
                  <p className="text-[10px] text-amber-600">PC検索未実施（画像なしで登録されます）</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  )
}
