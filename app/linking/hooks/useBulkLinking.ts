'use client'

import { useState, useCallback, useRef } from 'react'
import type { ExternalItem, BulkLinkProgress, SourceConfig } from '../lib/types'
import { AUTO_LINK_THRESHOLD } from '../lib/constants'

interface UseBulkLinkingReturn {
  progress: BulkLinkProgress | null
  startBulkLink: (items: ExternalItem[], config: SourceConfig) => Promise<void>
  cancel: () => void
}

export function useBulkLinking(
  onItemLinked: (itemId: string, cardId: string, cardName: string) => void,
): UseBulkLinkingReturn {
  const [progress, setProgress] = useState<BulkLinkProgress | null>(null)
  const cancelledRef = useRef(false)

  const startBulkLink = useCallback(async (items: ExternalItem[], config: SourceConfig) => {
    // 未紐づけアイテムのみ
    const unlinked = items.filter(i => !i.linkedCardId)
    if (unlinked.length === 0) return

    cancelledRef.current = false
    setProgress({ total: unlinked.length, processed: 0, linked: 0, skipped: 0, errors: 0, running: true })

    let linked = 0
    let skipped = 0
    let errors = 0

    for (let i = 0; i < unlinked.length; i++) {
      if (cancelledRef.current) break

      const item = unlinked[i]

      try {
        // 1. 自動マッチング候補を取得
        const matchRes = await fetch('/api/linking/auto-match', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: item.name, modelno: item.modelno, limit: 1 }),
        })

        if (!matchRes.ok) {
          errors++
          continue
        }

        const matchData = await matchRes.json()
        const topMatch = matchData.matches?.[0]

        // 2. 閾値以上のマッチのみ紐づけ
        if (!topMatch || topMatch.score < AUTO_LINK_THRESHOLD) {
          skipped++
        } else {
          // 3. 紐づけ実行
          const linkEndpoint = getLinkEndpoint(config.key)
          const linkBody = buildLinkBody(config.key, item, topMatch.card.id)

          const linkRes = await fetch(linkEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(linkBody),
          })

          if (linkRes.ok) {
            linked++
            onItemLinked(item.id, topMatch.card.id, topMatch.card.name)
          } else {
            const errData = await linkRes.json().catch(() => ({}))
            // 409 = 既に紐づけ済み → スキップ扱い
            if (linkRes.status === 409) {
              skipped++
            } else {
              console.error(`[bulkLink] Link failed for ${item.name}:`, errData.error)
              errors++
            }
          }
        }
      } catch (err) {
        errors++
      }

      setProgress({
        total: unlinked.length,
        processed: i + 1,
        linked,
        skipped,
        errors,
        running: !cancelledRef.current,
      })
    }

    setProgress(prev => prev ? { ...prev, running: false } : null)
  }, [onItemLinked])

  const cancel = useCallback(() => {
    cancelledRef.current = true
  }, [])

  return { progress, startBulkLink, cancel }
}

function getLinkEndpoint(source: string): string {
  switch (source) {
    case 'snkrdunk': return '/api/linking/snkrdunk/link'
    case 'shinsoku': return '/api/linking/shinsoku/link'
    case 'lounge': return '/api/linking/lounge/link'
    default: throw new Error(`Unknown source: ${source}`)
  }
}

function buildLinkBody(source: string, item: ExternalItem, cardId: string): Record<string, unknown> {
  switch (source) {
    case 'snkrdunk':
      return { cardId, apparelId: (item.meta as any).apparelId }
    case 'shinsoku':
      return { cardId, itemId: (item.meta as any).itemId }
    case 'lounge':
      return { cardId, cardKey: (item.meta as any).cardKey }
    default:
      throw new Error(`Unknown source: ${source}`)
  }
}
