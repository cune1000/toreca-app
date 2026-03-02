'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import type { ExternalItem, LinkFilter, SortConfig, PaginationInfo, SourceConfig } from '../lib/types'

interface UseLinkingStateReturn {
  items: ExternalItem[]
  loading: boolean
  error: string | null
  clearError: () => void
  pagination: PaginationInfo
  setPage: (page: number) => void
  search: string
  setSearch: (s: string) => void
  linkFilter: LinkFilter
  setLinkFilter: (f: LinkFilter) => void
  sort: SortConfig
  setSort: (field: SortConfig['field']) => void
  selectedItem: ExternalItem | null
  selectItem: (item: ExternalItem | null) => void
  checkedItems: Set<string>
  toggleCheck: (id: string) => void
  toggleAllFiltered: () => void
  checkedCount: number
  fetchItems: () => Promise<void>
  updateItemLink: (itemId: string, cardId: string | null, cardName: string | null) => void
  stats: { total: number; linked: number; unlinked: number }
}

export function useLinkingState(config: SourceConfig): UseLinkingStateReturn {
  const [items, setItems] = useState<ExternalItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, perPage: 100, total: 0, totalPages: 0 })
  const [search, setSearchDisplay] = useState('')
  const [linkFilter, setLinkFilterState] = useState<LinkFilter>('all')
  const [sort, setSortState] = useState<SortConfig>({ field: 'name', order: 'asc' })
  const [selectedItem, setSelectedItem] = useState<ExternalItem | null>(null)
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set())

  // デバウンス用: 実際にAPIに送る検索語はrefで管理
  const debouncedSearchRef = useRef('')
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  // fetchトリガー用カウンター（ref値変更後に再取得を発火させる）
  const [fetchTrigger, setFetchTrigger] = useState(0)

  // デバウンス付き検索
  const setSearch = useCallback((s: string) => {
    setSearchDisplay(s)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      debouncedSearchRef.current = s
      setPagination(prev => ({ ...prev, page: 1 }))
      setFetchTrigger(n => n + 1)
    }, 300)
  }, [])

  // フィルタ変更時はページリセット + 即時取得
  const setLinkFilter = useCallback((f: LinkFilter) => {
    setLinkFilterState(f)
    setPagination(prev => ({ ...prev, page: 1 }))
    setCheckedItems(new Set())
  }, [])

  // ソートトグル
  const setSort = useCallback((field: SortConfig['field']) => {
    setSortState(prev => {
      if (prev.field === field) {
        return { field, order: prev.order === 'asc' ? 'desc' : 'asc' }
      }
      return { field, order: 'asc' }
    })
    setPagination(prev => ({ ...prev, page: 1 }))
  }, [])

  // ページ変更時はcheckedItemsクリア
  const setPage = useCallback((page: number) => {
    setPagination(prev => ({ ...prev, page }))
    setCheckedItems(new Set())
  }, [])

  // データ取得（searchはrefから読むのでdepsに入らない）
  const fetchItems = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setLoading(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        page: String(pagination.page),
        perPage: String(pagination.perPage),
        search: debouncedSearchRef.current,
        filter: linkFilter,
        sort: sort.field,
        order: sort.order,
      })

      const res = await fetch(`${config.itemsEndpoint}?${params}`, {
        signal: controller.signal,
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `HTTP ${res.status}`)
      }

      const data = await res.json()
      setItems(data.items || [])
      setPagination(data.pagination || { page: 1, perPage: 100, total: 0, totalPages: 0 })
    } catch (err: any) {
      if (err.name === 'AbortError') return
      setError(err.message)
    } finally {
      setLoading(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.itemsEndpoint, pagination.page, pagination.perPage, linkFilter, sort.field, sort.order, fetchTrigger])

  // deps変更時に再取得
  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
      if (abortRef.current) abortRef.current.abort()
    }
  }, [])

  // チェック操作
  const toggleCheck = useCallback((id: string) => {
    setCheckedItems(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAllFiltered = useCallback(() => {
    const ids = items.map(i => i.id)
    setCheckedItems(prev => {
      const allChecked = ids.length > 0 && ids.every(id => prev.has(id))
      if (allChecked) {
        const next = new Set(prev)
        ids.forEach(id => next.delete(id))
        return next
      } else {
        const next = new Set(prev)
        ids.forEach(id => next.add(id))
        return next
      }
    })
  }, [items])

  // 紐づけ状態更新（UI側で即時反映）
  const updateItemLink = useCallback((itemId: string, cardId: string | null, cardName: string | null) => {
    setItems(prev => prev.map(item =>
      item.id === itemId
        ? { ...item, linkedCardId: cardId, linkedCardName: cardName }
        : item
    ))
    setSelectedItem(prev =>
      prev?.id === itemId
        ? { ...prev, linkedCardId: cardId, linkedCardName: cardName }
        : prev
    )
  }, [])

  const selectItem = useCallback((item: ExternalItem | null) => {
    setSelectedItem(item)
  }, [])

  const clearError = useCallback(() => setError(null), [])

  // 統計（現在ページの情報）
  const stats = useMemo(() => {
    const linked = items.filter(i => i.linkedCardId).length
    return {
      total: pagination.total,
      linked,
      unlinked: items.length - linked,
    }
  }, [items, pagination.total])

  return {
    items, loading, error, clearError,
    pagination, setPage,
    search, setSearch,
    linkFilter, setLinkFilter,
    sort, setSort,
    selectedItem, selectItem,
    checkedItems, toggleCheck, toggleAllFiltered,
    checkedCount: checkedItems.size,
    fetchItems, updateItemLink, stats,
  }
}
