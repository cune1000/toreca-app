'use client'

import { useState, useEffect, useMemo, useCallback, useRef, useDeferredValue } from 'react'
import { getSetNameJa } from '@/lib/justtcg-set-names'
import type { SortKey } from '../lib/constants'

// === 型定義 ===

export interface JTSet {
  id: string
  name: string
  cards_count: number
  release_date: string | null
}

export interface JTVariant {
  id: string
  condition: string
  printing: string
  language: string
  price: number | null
  lastUpdated: number | null
  priceChange7d: number | null
  priceChange30d: number | null
  avgPrice: number | null
  priceHistory?: Array<{ p: number; t: number }>
}

export interface JTCard {
  id: string
  name: string
  number: string
  set: string
  set_name: string
  rarity: string
  variants: JTVariant[]
}

export interface Usage {
  dailyUsed: number
  dailyLimit: number
  dailyRemaining: number
  monthlyUsed: number
  monthlyLimit: number
  monthlyRemaining: number
}

export interface PCMatch {
  id: string
  name: string
  consoleName: string
  loosePrice: number | null
  loosePriceDollars: number | null
  imageUrl: string | null
  pricechartingUrl: string | null
}

// === ユーティリティ ===

export function getNmVariant(card: JTCard): JTVariant | undefined {
  const v = card.variants
  if (!Array.isArray(v) || v.length === 0) return undefined
  return v.find(v => v.condition === 'Near Mint' && v.printing === 'Normal')
    || v.find(v => v.condition === 'Near Mint')
    || v[0]
}

/** 価格が有効な数値かチェック */
export function isValidPrice(p: unknown): p is number {
  return typeof p === 'number' && !isNaN(p) && isFinite(p)
}

export function formatUpdated(ts: number | null) {
  if (ts == null) return '-'
  const d = new Date(ts * 1000)
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

// === フック ===

export function useJustTcgState() {
  // ゲーム・セット
  const [selectedGame, setSelectedGame] = useState('pokemon-japan')
  const [sets, setSets] = useState<JTSet[]>([])
  const [selectedSetId, setSelectedSetId] = useState('')
  const [cards, setCards] = useState<JTCard[]>([])
  const [selectedCard, setSelectedCard] = useState<JTCard | null>(null)
  const [usage, setUsage] = useState<Usage | null>(null)

  // UI状態
  const [loadingSets, setLoadingSets] = useState(true)
  const [loadingCards, setLoadingCards] = useState(false)
  const [error, setError] = useState('')

  // フィルタ
  const [search, setSearch] = useState('')
  const [rarityFilter, setRarityFilter] = useState('')
  const [setFilterText, setSetFilterText] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('price')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [japaneseOnly, setJapaneseOnly] = useState(false)

  // PC検索
  const [pcMatches, setPcMatches] = useState<Record<string, PCMatch | null>>({})
  const [pcLoading, setPcLoading] = useState<Record<string, boolean>>({})
  const pcLoadingRef = useRef(pcLoading)
  pcLoadingRef.current = pcLoading

  // 登録モード
  const [showRegistration, setShowRegistration] = useState(false)

  // セット取得（ゲーム変更時）— AbortController でレースコンディション防止
  useEffect(() => {
    const controller = new AbortController()
    setLoadingSets(true)
    setSets([])
    setSelectedSetId('')
    setCards([])
    setSelectedCard(null)
    setSetFilterText('')
    setError('')
    setPcMatches({})

    fetch(`/api/justtcg/sets?game=${encodeURIComponent(selectedGame)}`, { signal: controller.signal })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setSets(res.data || [])
          if (res.usage) setUsage(res.usage)
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

  // カード取得（セット変更時）— AbortController でレースコンディション防止
  useEffect(() => {
    if (!selectedSetId) { setCards([]); return }
    const controller = new AbortController()
    setLoadingCards(true)
    setSearch('')
    setRarityFilter('')
    setSelectedCard(null)
    setError('') // R12-06: 前セットのエラーをクリア
    setPcMatches({})
    setPcLoading({})

    fetch(`/api/justtcg/cards?set=${encodeURIComponent(selectedSetId)}&game=${encodeURIComponent(selectedGame)}`, { signal: controller.signal })
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setCards(res.data || [])
          if (res.usage) setUsage(res.usage)
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
  }, [selectedSetId, selectedGame])

  // レアリティ一覧（"None" を除外）
  const rarities = useMemo(() => {
    const set = new Set(cards.map(c => c.rarity).filter(r => r && r !== 'None'))
    return Array.from(set).sort()
  }, [cards])

  // 検索テキストのデバウンス（入力中のUI応答性を維持しつつフィルタリングを遅延）
  const deferredSearch = useDeferredValue(search)

  // フィルタ・ソート済みカード — BUG-01: price ソートも含めて全ソートを処理
  const filteredCards = useMemo(() => {
    let list = cards

    if (deferredSearch) {
      const q = deferredSearch.toLowerCase()
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.number.toLowerCase().includes(q)
      )
    }
    if (rarityFilter) {
      list = list.filter(c => c.rarity === rarityFilter)
    }
    if (japaneseOnly) {
      list = list.filter(c => Array.isArray(c.variants) && c.variants.some(v => v.language === 'Japanese'))
    }

    // ソート（price含む全モード）
    list = [...list].sort((a, b) => {
      let va: number | string = 0, vb: number | string = 0

      if (sortBy === 'price') {
        va = getNmVariant(a)?.price ?? -Infinity
        vb = getNmVariant(b)?.price ?? -Infinity
      } else if (sortBy === 'number') {
        va = a.number; vb = b.number
        return sortOrder === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va))
      } else if (sortBy === 'name') {
        va = a.name; vb = b.name
        return sortOrder === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va))
      } else if (sortBy === 'change7d') {
        va = getNmVariant(a)?.priceChange7d ?? -Infinity
        vb = getNmVariant(b)?.priceChange7d ?? -Infinity
      } else if (sortBy === 'change30d') {
        va = getNmVariant(a)?.priceChange30d ?? -Infinity
        vb = getNmVariant(b)?.priceChange30d ?? -Infinity
      }

      return sortOrder === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
    })

    return list
  }, [cards, deferredSearch, rarityFilter, japaneseOnly, sortBy, sortOrder])

  // R12-01: フィルタ変更で selectedCard がリストから消えたらクリア
  useEffect(() => {
    if (selectedCard && filteredCards.length > 0 && !filteredCards.some(c => c.id === selectedCard.id)) {
      setSelectedCard(null)
    }
  }, [filteredCards, selectedCard])

  // セットフィルタ
  const filteredSets = useMemo(() => {
    if (!setFilterText) return sets
    const q = setFilterText.toLowerCase()
    return sets.filter(s =>
      getSetNameJa(s.id, s.name).toLowerCase().includes(q) ||
      s.name.toLowerCase().includes(q) ||
      s.id.toLowerCase().includes(q)
    )
  }, [sets, setFilterText])

  // 統計 — NaN ガード追加
  const stats = useMemo(() => {
    const prices = cards.map(c => getNmVariant(c)?.price).filter((p): p is number => isValidPrice(p) && p > 0)
    return {
      totalCards: cards.length,
      avgPrice: prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0,
      maxPrice: prices.length > 0 ? prices.reduce((a, b) => a > b ? a : b, -Infinity) : 0,
      minPrice: prices.length > 0 ? prices.reduce((a, b) => a < b ? a : b, Infinity) : 0,
    }
  }, [cards])

  // PC検索 — useRef で pcLoading / selectedGame / selectedSetId を参照
  const selectedGameRef = useRef(selectedGame)
  selectedGameRef.current = selectedGame
  const selectedSetIdRef = useRef(selectedSetId)
  selectedSetIdRef.current = selectedSetId

  const handlePcMatch = useCallback(async (card: JTCard) => {
    if (pcLoadingRef.current[card.id]) return
    const capturedSetId = selectedSetIdRef.current
    setPcLoading(prev => ({ ...prev, [card.id]: true }))
    try {
      const res = await fetch('/api/justtcg/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: card.name, number: card.number, game: selectedGameRef.current }),
      })
      const json = await res.json()
      // セット切替後のstale writeを防止
      if (selectedSetIdRef.current === capturedSetId) {
        setPcMatches(prev => ({ ...prev, [card.id]: json.success ? json.data : null }))
      }
    } catch {
      if (selectedSetIdRef.current === capturedSetId) {
        setPcMatches(prev => ({ ...prev, [card.id]: null }))
      }
    } finally {
      // R12-05: セット切替後のstale writeを防止（pcLoadingも同様にガード）
      if (selectedSetIdRef.current === capturedSetId) {
        setPcLoading(prev => ({ ...prev, [card.id]: false }))
      }
    }
  }, [])

  // アクション
  const setsRef = useRef(sets)
  setsRef.current = sets
  const selectSet = useCallback((setId: string) => {
    setSelectedSetId(setId)
    if (setId) {
      const s = setsRef.current.find(s => s.id === setId)
      if (s) setSetFilterText(getSetNameJa(s.id, s.name))
    }
  }, [])

  const selectCard = useCallback((card: JTCard | null) => {
    setSelectedCard(card)
  }, [])

  // selectedSet メモ化（毎レンダーの sets.find を防止）
  const selectedSet = useMemo(() =>
    sets.find(s => s.id === selectedSetId) || null
  , [sets, selectedSetId])

  const clearError = useCallback(() => setError(''), [])
  const toggleRegistration = useCallback(() => setShowRegistration(p => !p), [])

  return {
    selectedGame, sets, selectedSetId, cards, selectedCard, usage,
    loadingSets, loadingCards, error,
    search, rarityFilter, setFilterText, sortBy, sortOrder, japaneseOnly,
    pcMatches, pcLoading, showRegistration,
    filteredCards, filteredSets, rarities, stats,
    selectedSet,

    setSelectedGame, selectSet, selectCard,
    setSearch, setRarityFilter, setSetFilterText,
    setSortBy, setSortOrder, setJapaneseOnly,
    handlePcMatch,
    clearError,
    toggleRegistration,
  }
}
