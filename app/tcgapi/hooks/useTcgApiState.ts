'use client'

import { useState, useEffect, useMemo, useCallback, useRef, useDeferredValue } from 'react'
import { getSetNameJa } from '@/lib/justtcg-set-names'
import type { SortKey } from '../lib/constants'

// === 型定義 ===

export interface TcgSet {
  id: number
  name: string
  nameJa: string
  slug: string
  card_count: number
  release_date: string | null
  abbreviation: string | null
  image_url: string | null
}

export interface TcgCard {
  id: number              // TCG API 内部ID
  tcgplayer_id: number    // TCGPlayer ID（3ソース共通キー）
  name: string
  clean_name: string
  number: string | null
  rarity: string
  image_url: string | null
  market_price: number | null
  low_price: number | null
  median_price: number | null
  total_listings: number
  foil_only: boolean
  printing: string
}

export interface RateLimit {
  daily_limit: number
  daily_remaining: number
}

// === ユーティリティ ===

/** 価格が有効な数値かチェック */
export function isValidPrice(p: unknown): p is number {
  return typeof p === 'number' && !isNaN(p) && isFinite(p)
}

/** カードのキー文字列（tcgplayer_id）*/
export function cardKey(card: TcgCard): string {
  return String(card.tcgplayer_id)
}

// === フック ===

export function useTcgApiState() {
  // ゲーム選択（localStorageで永続化）
  const [selectedGame, setSelectedGameRaw] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('tcgapi-selectedGame') || 'pokemon-japan'
    }
    return 'pokemon-japan'
  })
  const setSelectedGame = useCallback((game: string) => {
    setSelectedGameRaw(game)
    try { localStorage.setItem('tcgapi-selectedGame', game) } catch {}
  }, [])

  const [sets, setSets] = useState<TcgSet[]>([])
  const [selectedSetId, setSelectedSetId] = useState<string>('')  // String(set.id)
  const [cards, setCards] = useState<TcgCard[]>([])
  const [selectedCard, setSelectedCard] = useState<TcgCard | null>(null)
  const [rateLimit, setRateLimit] = useState<RateLimit | null>(null)

  // UI状態
  const [loadingSets, setLoadingSets] = useState(true)
  const [loadingCards, setLoadingCards] = useState(false)
  const [error, setError] = useState('')

  // フィルタ
  const [search, setSearch] = useState('')
  const [rarityFilter, setRarityFilter] = useState<Set<string>>(new Set())
  const [setFilterText, setSetFilterText] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('price')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  // 登録モード
  const [showRegistration, setShowRegistration] = useState(false)

  // セット取得（ゲーム変更時）
  useEffect(() => {
    const controller = new AbortController()
    setLoadingSets(true)
    setSets([])
    setSelectedSetId('')
    setCards([])
    setSelectedCard(null)
    setSetFilterText('')
    setSearch('')
    setRarityFilter(prev => prev.size === 0 ? prev : new Set())
    setError('')

    fetch(`/api/tcgapi/sets?game=${encodeURIComponent(selectedGame)}`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(res => {
        if (controller.signal.aborted) return
        if (res.success) {
          const raw: any[] = res.data || []
          setSets(raw.map((s: any) => ({
            ...s,
            nameJa: getSetNameJa(`${s.slug}-${selectedGame}`, s.name),
          })))
          if (res.rateLimit) setRateLimit(res.rateLimit)
        } else {
          setError(res.error || 'セット取得失敗')
        }
      })
      .catch(e => {
        if (e.name !== 'AbortError') setError(e.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingSets(false)
      })

    return () => controller.abort()
  }, [selectedGame])

  // カード取得（セット変更時）
  useEffect(() => {
    if (!selectedSetId) { setCards([]); setLoadingCards(false); return }
    const controller = new AbortController()
    setLoadingCards(true)
    setSearch('')
    setRarityFilter(prev => prev.size === 0 ? prev : new Set())
    setSelectedCard(null)
    setError('')

    fetch(`/api/tcgapi/cards?setId=${encodeURIComponent(selectedSetId)}`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(res => {
        if (controller.signal.aborted) return
        if (res.success) {
          setCards(res.data || [])
        } else {
          setError(res.error || 'カード取得失敗')
        }
      })
      .catch(e => {
        if (e.name !== 'AbortError') setError(e.message)
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingCards(false)
      })

    return () => controller.abort()
  }, [selectedSetId])

  // レアリティ一覧（"None" を除外）
  const rarities = useMemo(() => {
    const set = new Set(cards.map(c => c.rarity).filter(r => r && r !== 'None'))
    return Array.from(set).sort()
  }, [cards])

  // 検索テキストのデバウンス
  const deferredSearch = useDeferredValue(search)

  // フィルタ・ソート済みカード
  const filteredCards = useMemo(() => {
    let list = cards

    if (deferredSearch) {
      const q = deferredSearch.toLowerCase()
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.number && c.number.toLowerCase().includes(q))
      )
    }
    if (rarityFilter.size > 0) {
      list = list.filter(c => rarityFilter.has(c.rarity))
    }

    const noValueFallback = sortOrder === 'asc' ? Infinity : -Infinity
    list = [...list].sort((a, b) => {
      let va: number | string = 0, vb: number | string = 0

      if (sortBy === 'price') {
        va = a.market_price ?? noValueFallback
        vb = b.market_price ?? noValueFallback
      } else if (sortBy === 'number') {
        va = a.number || ''; vb = b.number || ''
        return sortOrder === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va))
      } else if (sortBy === 'name') {
        va = a.name; vb = b.name
        return sortOrder === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va))
      } else if (sortBy === 'listings') {
        va = a.total_listings ?? noValueFallback
        vb = b.total_listings ?? noValueFallback
      }

      return sortOrder === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
    })

    return list
  }, [cards, deferredSearch, rarityFilter, sortBy, sortOrder])

  // フィルタ変更で selectedCard がリストから消えたらクリア
  useEffect(() => {
    if (selectedCard && !filteredCards.some(c => c.id === selectedCard.id)) {
      setSelectedCard(null)
    }
  }, [filteredCards, selectedCard])

  // セットフィルタ + 発売日ソート
  const filteredSets = useMemo(() => {
    let list = sets
    if (setFilterText) {
      const q = setFilterText.toLowerCase()
      list = list.filter(s =>
        s.name.toLowerCase().includes(q) ||
        s.nameJa.toLowerCase().includes(q) ||
        (s.slug && s.slug.toLowerCase().includes(q)) ||
        (s.abbreviation && s.abbreviation.toLowerCase().includes(q))
      )
    }
    return [...list].sort((a, b) => {
      if (a.release_date && b.release_date) return b.release_date.localeCompare(a.release_date)
      if (a.release_date && !b.release_date) return -1
      if (!a.release_date && b.release_date) return 1
      return 0
    })
  }, [sets, setFilterText])

  // 統計
  const stats = useMemo(() => {
    const prices = cards.map(c => c.market_price).filter((p): p is number => isValidPrice(p) && p > 0)
    return {
      totalCards: cards.length,
      avgPrice: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
      maxPrice: prices.length > 0 ? prices.reduce((a, b) => a > b ? a : b, -Infinity) : 0,
      minPrice: prices.length > 0 ? prices.reduce((a, b) => a < b ? a : b, Infinity) : 0,
    }
  }, [cards])

  // アクション
  const selectSet = useCallback((setId: string) => {
    setSelectedSetId(setId)
    if (setId) setSetFilterText('')
  }, [])

  const selectCard = useCallback((card: TcgCard | null) => {
    setSelectedCard(card)
  }, [])

  const selectedSet = useMemo(() =>
    sets.find(s => String(s.id) === selectedSetId) || null
  , [sets, selectedSetId])

  const clearError = useCallback(() => setError(''), [])
  const toggleRegistration = useCallback(() => setShowRegistration(p => !p), [])

  const toggleRarity = useCallback((rarity: string) => {
    setRarityFilter(prev => {
      const next = new Set(prev)
      if (next.has(rarity)) next.delete(rarity)
      else next.add(rarity)
      return next
    })
  }, [])
  const clearRarityFilter = useCallback(() => setRarityFilter(prev => prev.size === 0 ? prev : new Set()), [])

  return {
    selectedGame, sets, selectedSetId, cards, selectedCard, rateLimit,
    loadingSets, loadingCards, error,
    search, rarityFilter, setFilterText, sortBy, sortOrder,
    showRegistration,
    filteredCards, filteredSets, rarities, stats,
    selectedSet,

    setSelectedGame, selectSet, selectCard,
    setSearch, toggleRarity, clearRarityFilter, setSetFilterText,
    setSortBy, setSortOrder,
    clearError,
    toggleRegistration,
  }
}
