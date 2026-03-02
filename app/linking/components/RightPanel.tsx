'use client'

import { useState, useCallback } from 'react'
import { X, Search, Link2, Unlink, Loader2, Sparkles } from 'lucide-react'
import { useAutoMatch } from '../hooks/useAutoMatch'
import { useCardSearch } from '../hooks/useCardSearch'
import { buildLinkBody, buildUnlinkBody, getLinkEndpoint } from '../lib/link-helpers'
import CardSearchResult from './CardSearchResult'
import type { ExternalItem, LinkableCard, SourceConfig } from '../lib/types'

interface RightPanelProps {
  item: ExternalItem | null
  open: boolean
  onClose: () => void
  config: SourceConfig
  onLink: (itemId: string, cardId: string, cardName: string) => void
  onUnlink: (itemId: string) => void
  className?: string
}

export default function RightPanel({
  item,
  open,
  onClose,
  config,
  onLink,
  onUnlink,
  className = '',
}: RightPanelProps) {
  const autoMatch = useAutoMatch(item)
  const cardSearch = useCardSearch()
  const [linking, setLinking] = useState(false)
  const [unlinking, setUnlinking] = useState(false)

  const handleLink = useCallback(async (card: LinkableCard) => {
    if (!item || linking) return
    setLinking(true)
    try {
      const res = await fetch(getLinkEndpoint(config.key), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildLinkBody(config.key, item, card.id)),
      })

      if (res.ok) {
        onLink(item.id, card.id, card.name)
        cardSearch.clear()
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.error || '紐づけに失敗しました')
      }
    } catch (err: any) {
      alert(err.message)
    } finally {
      setLinking(false)
    }
  }, [item, config.key, linking, onLink, cardSearch])

  const handleUnlink = useCallback(async () => {
    if (!item || unlinking) return
    setUnlinking(true)
    try {
      const res = await fetch(getLinkEndpoint(config.key), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildUnlinkBody(config.key, item)),
      })

      if (res.ok) {
        onUnlink(item.id)
      } else {
        const data = await res.json().catch(() => ({}))
        alert(data.error || '紐づけ解除に失敗しました')
      }
    } catch (err: any) {
      alert(err.message)
    } finally {
      setUnlinking(false)
    }
  }, [item, config.key, unlinking, onUnlink])

  if (!open || !item) {
    return (
      <div className={`w-72 border-l border-[var(--lk-border)] bg-[var(--lk-surface)] flex items-center justify-center ${className}`}>
        <p className="text-[11px] text-[var(--lk-text-muted)]">商品を選択してください</p>
      </div>
    )
  }

  return (
    <div className={`relative w-72 border-l border-[var(--lk-border)] bg-[var(--lk-surface)] flex flex-col overflow-hidden ${className}`}>
      {/* ヘッダー */}
      <div className="shrink-0 px-3 py-2 border-b border-[var(--lk-border)] flex items-center justify-between">
        <h3 className="text-xs font-bold text-[var(--lk-ink)]">商品詳細</h3>
        <button onClick={onClose} aria-label="閉じる" className="p-1 rounded hover:bg-[var(--lk-border-light)]">
          <X size={14} className="text-[var(--lk-text-muted)]" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* 商品情報 */}
        <div className="p-3 border-b border-[var(--lk-border)]">
          {item.imageUrl && (
            <div className="w-full aspect-square mb-2 rounded-[var(--lk-radius)] overflow-hidden bg-[var(--lk-border-light)]">
              <img src={item.imageUrl} alt={item.name} className="w-full h-full object-contain" />
            </div>
          )}
          <h4 className="text-[12px] font-bold text-[var(--lk-text)] leading-snug">{item.name}</h4>
          {item.modelno && (
            <p className="text-[10px] text-[var(--lk-text-muted)] mt-0.5">{item.modelno}</p>
          )}
          {item.price != null && item.price > 0 && (
            <p className="text-[14px] font-bold text-[var(--lk-accent)] mt-1" style={{ fontFamily: 'var(--font-price)' }}>
              ¥{item.price.toLocaleString()}
            </p>
          )}
        </div>

        {/* 紐づけ状態 */}
        <div className="p-3 border-b border-[var(--lk-border)]">
          {item.linkedCardId ? (
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Link2 size={12} className="text-[var(--lk-linked)]" />
                <span className="text-[11px] font-medium text-[var(--lk-linked)]">紐づけ済み</span>
              </div>
              <p className="text-[11px] text-[var(--lk-text)] mb-2">{item.linkedCardName}</p>
              <button
                onClick={handleUnlink}
                disabled={unlinking}
                className="w-full py-1.5 rounded-[var(--lk-radius)] border border-red-200 text-red-600 text-[10px] font-medium hover:bg-red-50 disabled:opacity-50 flex items-center justify-center gap-1"
              >
                {unlinking ? <Loader2 size={10} className="animate-spin" /> : <Unlink size={10} />}
                紐づけ解除
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <Unlink size={12} className="text-[var(--lk-unlinked)]" />
              <span className="text-[11px] text-[var(--lk-unlinked)]">未紐づけ</span>
            </div>
          )}
        </div>

        {/* 自動マッチング候補 */}
        {!item.linkedCardId && (
          <div className="p-3 border-b border-[var(--lk-border)]">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles size={12} className="text-[var(--lk-accent)]" />
              <h5 className="text-[10px] font-bold text-[var(--lk-text-muted)] uppercase tracking-wider">
                自動マッチング候補
              </h5>
            </div>
            {autoMatch.loading ? (
              <div className="flex items-center justify-center py-3">
                <Loader2 size={14} className="animate-spin text-[var(--lk-accent)]" />
              </div>
            ) : autoMatch.matches.length === 0 ? (
              <p className="text-[10px] text-[var(--lk-text-muted)] py-2">候補なし</p>
            ) : (
              <div className="space-y-0.5">
                {autoMatch.matches.map(m => (
                  <CardSearchResult
                    key={m.card.id}
                    card={m.card}
                    score={m.score}
                    matchType={m.matchType}
                    onLink={handleLink}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 手動カード検索 */}
        {!item.linkedCardId && (
          <div className="p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Search size={12} className="text-[var(--lk-text-muted)]" />
              <h5 className="text-[10px] font-bold text-[var(--lk-text-muted)] uppercase tracking-wider">
                カード検索
              </h5>
            </div>
            <input
              type="text"
              placeholder="カード名で検索..."
              value={cardSearch.query}
              onChange={e => cardSearch.setQuery(e.target.value)}
              className="w-full px-2.5 py-1.5 text-[11px] border border-[var(--lk-border)] rounded-[var(--lk-radius)] bg-white focus:outline-none focus:border-[var(--lk-accent)] focus:ring-1 focus:ring-[var(--lk-accent)]/30"
            />
            {cardSearch.loading ? (
              <div className="flex items-center justify-center py-3">
                <Loader2 size={14} className="animate-spin text-[var(--lk-text-muted)]" />
              </div>
            ) : cardSearch.results.length > 0 ? (
              <div className="mt-1.5 space-y-0.5 max-h-60 overflow-y-auto">
                {cardSearch.results.map(card => (
                  <CardSearchResult
                    key={card.id}
                    card={card}
                    onLink={handleLink}
                  />
                ))}
              </div>
            ) : cardSearch.query.length >= 2 ? (
              <p className="text-[10px] text-[var(--lk-text-muted)] py-2 mt-1">該当カードなし</p>
            ) : null}
          </div>
        )}
      </div>

      {/* リンク中オーバーレイ（position:relativeを親に追加済み） */}
      {linking && (
        <div className="absolute inset-0 bg-white/60 flex items-center justify-center rounded-[var(--lk-radius)]">
          <Loader2 size={20} className="animate-spin text-[var(--lk-accent)]" />
        </div>
      )}
    </div>
  )
}
