'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import type { ExternalItem, MatchCandidate } from '../lib/types'

interface UseAutoMatchReturn {
  matches: MatchCandidate[]
  loading: boolean
  fetchMatches: (item: ExternalItem) => Promise<void>
  clear: () => void
}

export function useAutoMatch(item: ExternalItem | null): UseAutoMatchReturn {
  const [matches, setMatches] = useState<MatchCandidate[]>([])
  const [loading, setLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const fetchMatches = useCallback(async (targetItem: ExternalItem) => {
    // 前のリクエストをキャンセル
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    try {
      const res = await fetch('/api/linking/auto-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: targetItem.name,
          modelno: targetItem.modelno,
          limit: 10,
        }),
        signal: controller.signal,
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setMatches(data.matches || [])
    } catch (err: any) {
      if (err.name === 'AbortError') return
      console.error('[useAutoMatch] Error:', err)
      setMatches([])
    } finally {
      setLoading(false)
    }
  }, [])

  // アイテム変更時に自動取得
  useEffect(() => {
    if (!item) {
      setMatches([])
      return
    }

    // 既に紐づけ済みならマッチング不要
    if (item.linkedCardId) {
      setMatches([])
      return
    }

    fetchMatches(item)

    return () => {
      if (abortRef.current) abortRef.current.abort()
    }
  }, [item?.id, item?.linkedCardId]) // eslint-disable-line react-hooks/exhaustive-deps

  const clear = useCallback(() => {
    setMatches([])
    if (abortRef.current) abortRef.current.abort()
  }, [])

  return { matches, loading, fetchMatches, clear }
}
