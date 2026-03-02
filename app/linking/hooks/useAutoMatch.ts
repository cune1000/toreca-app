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
  const prevItemIdRef = useRef<string | null>(null)

  const fetchMatches = useCallback(async (item: ExternalItem) => {
    setLoading(true)
    try {
      const res = await fetch('/api/linking/auto-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: item.name,
          modelno: item.modelno,
          limit: 10,
        }),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setMatches(data.matches || [])
    } catch (err) {
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
      prevItemIdRef.current = null
      return
    }
    if (item.id === prevItemIdRef.current) return
    prevItemIdRef.current = item.id

    // 既に紐づけ済みならマッチング不要
    if (item.linkedCardId) {
      setMatches([])
      return
    }

    fetchMatches(item)
  }, [item, fetchMatches])

  const clear = useCallback(() => {
    setMatches([])
    prevItemIdRef.current = null
  }, [])

  return { matches, loading, fetchMatches, clear }
}
