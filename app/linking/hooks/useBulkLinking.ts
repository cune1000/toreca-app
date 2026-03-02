'use client'

import { useState, useCallback, useRef } from 'react'
import type { ExternalItem, BulkLinkProgress, SourceConfig } from '../lib/types'
import { AUTO_LINK_THRESHOLD } from '../lib/constants'
import { buildLinkBody, getLinkEndpoint } from '../lib/link-helpers'

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

        if (!topMatch || topMatch.score < AUTO_LINK_THRESHOLD) {
          skipped++
        } else {
          const linkRes = await fetch(getLinkEndpoint(config.key), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildLinkBody(config.key, item, topMatch.card.id)),
          })

          if (linkRes.ok) {
            linked++
            onItemLinked(item.id, topMatch.card.id, topMatch.card.name)
          } else if (linkRes.status === 409) {
            skipped++
          } else {
            const errData = await linkRes.json().catch(() => ({}))
            console.error(`[bulkLink] Link failed for ${item.name}:`, errData.error)
            errors++
          }
        }
      } catch {
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
