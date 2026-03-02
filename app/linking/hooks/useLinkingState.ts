'use client'

import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import type { ExternalItem, LinkFilter, SortConfig, PaginationInfo, SourceConfig } from '../lib/types'

interface UseLinkingStateReturn {
  // 商品データ
  items: ExternalItem[]
  loading: boolean
  error: string | null
  clearError: () => void

  // ページネーション
  pagination: PaginationInfo
  setPage: (page: number) => void

  // 検索・フィルタ
  search: string
  setSearch: (s: string) => void
  linkFilter: LinkFilter
  setLinkFilter: (f: LinkFilter) => void
  sort: SortConfig
  setSort: (field: SortConfig['field']) => void

  // 選択
  selectedItem: ExternalItem | null
  selectItem: (item: ExternalItem | null) => void
  checkedItems: Set<string>
  toggleCheck: (id: string) => void
  toggleAllFiltered: () => void
  checkedCount: number

  // アクション
  fetchItems: () => Promise<void>
  updateItemLink: (itemId: string, cardId: string | null, cardName: string | null) => void

  // 統計
  stats: { total: number; linked: number; unlinked: number }
}

export function useLinkingState(config: SourceConfig): UseLinkingStateReturn {
  const [items, setItems] = useState<ExternalItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pagination, setPagination] = useState<PaginationInfo>({ page: 1, perPage: 100, total: 0, totalPages: 0 })
  const [search, setSearchRaw] = useState('')
  const [linkFilter, setLinkFilter] = useState<LinkFilter>('all')
  const [sort, setSortState] = useState<SortConfig>({ field: 'name', order: 'asc' })
  const [selectedItem, setSelectedItem] = useState<ExternalItem | null>(null)
  const [checkedItems, setCheckedItems] = useState<Set<string>>(new Set())

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // デバウンス検索
  const setSearch = useCallback((s: string) => {
    setSearchRaw(s)
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current)
    searchTimerRef.current = setTimeout(() => {
      setPagination(prev => ({ ...prev, page: 1 }))
    }, 300)
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

  const setPage = useCallback((page: number) => {
    setPagination(prev => ({ ...prev, page }))
  }, [])

  // データ取得
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
        search,
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
  }, [config.itemsEndpoint, pagination.page, pagination.perPage, search, linkFilter, sort.field, sort.order])

  // ページ・検索・フィルタ・ソート変更時に再取得
  useEffect(() => {
    fetchItems()
  }, [fetchItems])

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
      const allChecked = ids.every(id => prev.has(id))
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
    // 選択中のアイテムも更新
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

  // 統計
  const stats = useMemo(() => {
    const linked = items.filter(i => i.linkedCardId).length
    return {
      total: pagination.total,
      linked,
      unlinked: items.length - linked,
    }
  }, [items, pagination.total])

  return {
    items,
    loading,
    error,
    clearError,
    pagination,
    setPage,
    search,
    setSearch,
    linkFilter,
    setLinkFilter,
    sort,
    setSort,
    selectedItem,
    selectItem,
    checkedItems,
    toggleCheck,
    toggleAllFiltered,
    checkedCount: checkedItems.size,
    fetchItems,
    updateItemLink,
    stats,
  }
}
