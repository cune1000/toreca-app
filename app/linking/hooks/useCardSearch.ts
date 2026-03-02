'use client'

import { useState, useCallback, useRef } from 'react'
import type { LinkableCard } from '../lib/types'

interface UseCardSearchReturn {
  query: string
  setQuery: (q: string) => void
  results: LinkableCard[]
  loading: boolean
  search: (q: string) => Promise<void>
  clear: () => void
}

export function useCardSearch(): UseCardSearchReturn {
  const [query, setQueryRaw] = useState('')
  const [results, setResults] = useState<LinkableCard[]>([])
  const [loading, setLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cacheRef = useRef<Map<string, LinkableCard[]>>(new Map())

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim()
    if (trimmed.length < 2) {
      setResults([])
      return
    }

    // キャッシュチェック
    if (cacheRef.current.has(trimmed)) {
      setResults(cacheRef.current.get(trimmed)!)
      return
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/linking/search-cards?q=${encodeURIComponent(trimmed)}&limit=20`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const cards = data.cards || []
      cacheRef.current.set(trimmed, cards)
      setResults(cards)
    } catch (err) {
      console.error('[useCardSearch] Error:', err)
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  // デバウンス付きsetQuery
  const setQuery = useCallback((q: string) => {
    setQueryRaw(q)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => search(q), 300)
  }, [search])

  const clear = useCallback(() => {
    setQueryRaw('')
    setResults([])
  }, [])

  return { query, setQuery, results, loading, search, clear }
}
