'use client'

import { useState, useEffect, useMemo, useCallback, useRef, useDeferredValue, startTransition } from 'react'
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
  tcgplayerId?: string | null
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
  // R13-FE09: JST タイムゾーンを明示
  return d.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

// カード名の括弧内パターン名 → 日本語マッピング
const PATTERN_NAME_JA: Record<string, string> = {
  'Master Ball Pattern': 'マスターボールミラー',
  'Poke Ball Pattern': 'モンスターボールミラー',
  'Energy Symbol Pattern': 'エネルギーシンボルミラー',
  'Friend Ball Pattern': 'フレンドボールミラー',
  'Team Rocket Pattern': 'ロケット団ミラー',
  'Nest Ball Pattern': 'ネストボールミラー',
  'Premier Ball Pattern': 'プレミアボールミラー',
  'Luxury Ball Pattern': 'ゴージャスボールミラー',
  'Timer Ball Pattern': 'タイマーボールミラー',
  'Dusk Ball Pattern': 'ダークボールミラー',
  'Heal Ball Pattern': 'ヒールボールミラー',
  'Quick Ball Pattern': 'クイックボールミラー',
  'Dive Ball Pattern': 'ダイブボールミラー',
  'Ultra Ball Pattern': 'ハイパーボールミラー',
  'Great Ball Pattern': 'スーパーボールミラー',
}

/** 英語カード名に (Pattern) がある場合、日本語名にパターンサフィックスを付与 */
function appendVariantSuffix(englishName: string, jaName: string): string {
  const m = englishName.match(/\(([^)]+)\)/)
  if (!m) return jaName
  const patternEn = m[1].trim()
  const patternJa = PATTERN_NAME_JA[patternEn] || patternEn
  return `${jaName}（${patternJa}）`
}

// === フック ===

export function useJustTcgState() {
  // ゲーム・セット（localStorageで永続化）
  const [selectedGame, setSelectedGameRaw] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('jtcg-selectedGame') || 'pokemon-japan'
    }
    return 'pokemon-japan'
  })
  const setSelectedGame = useCallback((game: string) => {
    setSelectedGameRaw(game)
    try { localStorage.setItem('jtcg-selectedGame', game) } catch {}
  }, [])
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
  const [rarityFilter, setRarityFilter] = useState<Set<string>>(new Set())
  const [setFilterText, setSetFilterText] = useState('')
  const [sortBy, setSortBy] = useState<SortKey>('price')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [japaneseOnly, setJapaneseOnly] = useState(false)

  // PC検索
  const [pcMatches, setPcMatches] = useState<Record<string, PCMatch | null>>({})
  const [pcLoading, setPcLoading] = useState<Record<string, boolean>>({})
  const pcLoadingRef = useRef(pcLoading)
  pcLoadingRef.current = pcLoading
  const pcMatchesRef = useRef(pcMatches)
  pcMatchesRef.current = pcMatches

  // 一括PC検索
  const [bulkPcProgress, setBulkPcProgress] = useState<{
    current: number; total: number; succeeded: number; failed: number
  } | null>(null)
  const cancelBulkPcRef = useRef(false)
  const bulkPcRunningRef = useRef(false)

  // Gemini日本語名連携用（useRegistrationのsetJaNameを注入）
  const setJaNameRef = useRef<((cardId: string, name: string) => void) | null>(null)
  // R14-05: checkedCards注入用（useRegistrationのcheckedCardsをref経由で参照）
  const checkedCardsExtRef = useRef<Set<string>>(new Set())

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
    setSearch('') // R12-20: ゲーム切替時に検索テキストもクリア
    setRarityFilter(prev => prev.size === 0 ? prev : new Set()) // R12-20
    setError('')
    setPcMatches({})
    setPcLoading({}) // R14-01: ゲーム切替時にpcLoadingもリセット
    setBulkPcProgress(null)
    cancelBulkPcRef.current = true

    fetch(`/api/justtcg/sets?game=${encodeURIComponent(selectedGame)}`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(res => {
        if (controller.signal.aborted) return // R12-09: レースコンディション防止
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
    if (!selectedSetId) { setCards([]); setLoadingCards(false); return } // R13-INT10: loadingCards確実にリセット
    const controller = new AbortController()
    setLoadingCards(true)
    setSearch('')
    setRarityFilter(prev => prev.size === 0 ? prev : new Set())
    setSelectedCard(null)
    setError('') // R12-06: 前セットのエラーをクリア
    setPcMatches({})
    setPcLoading({})
    setBulkPcProgress(null)
    cancelBulkPcRef.current = true

    fetch(`/api/justtcg/cards?set=${encodeURIComponent(selectedSetId)}&game=${encodeURIComponent(selectedGame)}`, { signal: controller.signal })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json() })
      .then(res => {
        if (controller.signal.aborted) return // R12-09: レースコンディション防止
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
    if (rarityFilter.size > 0) {
      list = list.filter(c => rarityFilter.has(c.rarity))
    }
    if (japaneseOnly) {
      list = list.filter(c => Array.isArray(c.variants) && c.variants.some(v => v.language === 'Japanese'))
    }

    // ソート（price含む全モード）
    // R14-17: 昇順時は価格なしを末尾、降順時は価格なしを末尾にする
    const noValueFallback = sortOrder === 'asc' ? Infinity : -Infinity
    list = [...list].sort((a, b) => {
      let va: number | string = 0, vb: number | string = 0

      if (sortBy === 'price') {
        va = getNmVariant(a)?.price ?? noValueFallback
        vb = getNmVariant(b)?.price ?? noValueFallback
      } else if (sortBy === 'number') {
        va = a.number; vb = b.number
        return sortOrder === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va))
      } else if (sortBy === 'name') {
        va = a.name; vb = b.name
        return sortOrder === 'asc' ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va))
      } else if (sortBy === 'change7d') {
        va = getNmVariant(a)?.priceChange7d ?? noValueFallback
        vb = getNmVariant(b)?.priceChange7d ?? noValueFallback
      } else if (sortBy === 'change30d') {
        va = getNmVariant(a)?.priceChange30d ?? noValueFallback
        vb = getNmVariant(b)?.priceChange30d ?? noValueFallback
      }

      return sortOrder === 'asc' ? (va as number) - (vb as number) : (vb as number) - (va as number)
    })

    return list
  }, [cards, deferredSearch, rarityFilter, japaneseOnly, sortBy, sortOrder])

  // R12-01: フィルタ変更で selectedCard がリストから消えたらクリア
  useEffect(() => {
    if (selectedCard && !filteredCards.some(c => c.id === selectedCard.id)) {
      setSelectedCard(null)
    }
  }, [filteredCards, selectedCard])

  // セットフィルタ + 発売日ソート（新しい順、日付なしは末尾）
  const filteredSets = useMemo(() => {
    let list = sets
    if (setFilterText) {
      const q = setFilterText.toLowerCase()
      list = list.filter(s =>
        getSetNameJa(s.id, s.name).toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.id.toLowerCase().includes(q)
      )
    }
    return [...list].sort((a, b) => {
      if (a.release_date && b.release_date) return b.release_date.localeCompare(a.release_date)
      if (a.release_date && !b.release_date) return -1
      if (!a.release_date && b.release_date) return 1
      return 0
    })
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

  /** Gemini で画像から日本語名を抽出 */
  const extractJaName = useCallback(async (imageUrl: string): Promise<string | null> => {
    try {
      const res = await fetch('/api/justtcg/extract-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl }),
      })
      if (!res.ok) return null
      const json = await res.json()
      return json.success ? json.name : null
    } catch {
      return null
    }
  }, [])

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
      // R13-INT12: 429レート制限をユーザーフレンドリーに処理
      if (res.status === 429) {
        if (selectedSetIdRef.current === capturedSetId) {
          setPcMatches(prev => ({ ...prev, [card.id]: null }))
        }
        return
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      // セット切替後のstale writeを防止
      if (selectedSetIdRef.current === capturedSetId) {
        setPcMatches(prev => ({ ...prev, [card.id]: json.success ? json.data : null }))
      }
      // Gemini で日本語名を自動抽出（fire-and-forget、startTransitionで低優先度バッチ化）
      if (json.success && json.data?.imageUrl && setJaNameRef.current) {
        const cardId = card.id
        const cardName = card.name
        extractJaName(json.data.imageUrl).then(name => {
          if (name && setJaNameRef.current && selectedSetIdRef.current === capturedSetId) {
            const finalName = appendVariantSuffix(cardName, name)
            startTransition(() => { setJaNameRef.current!(cardId, finalName) })
          }
        })
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
  }, [extractJaName])

  // setJaName 注入（page.tsxから呼ばれる）
  const injectSetJaName = useCallback((fn: (cardId: string, name: string) => void) => {
    setJaNameRef.current = fn
  }, [])

  // 一括PC検索 — refs
  const cardsRef = useRef(cards)
  cardsRef.current = cards
  const filteredCardsRef = useRef(filteredCards)
  filteredCardsRef.current = filteredCards

  const handleBulkPcSearch = useCallback(async (mode: 'checked' | 'filtered') => {
    if (bulkPcRunningRef.current) return
    bulkPcRunningRef.current = true
    const capturedSetId = selectedSetIdRef.current

    try {
      // 対象カード決定（R14-05: checkedCardsはref経由で参照、deps不要）
      let targets: JTCard[]
      if (mode === 'checked') {
        const checked = checkedCardsExtRef.current
        targets = cardsRef.current.filter(c => checked.has(c.id))
      } else {
        targets = filteredCardsRef.current
      }

      // 既にpcMatchesに結果があるカードをスキップ
      const snap = pcMatchesRef.current
      targets = targets.filter(c => snap[c.id] === undefined)

      if (targets.length === 0) {
        bulkPcRunningRef.current = false
        return
      }

      cancelBulkPcRef.current = false
      let succeeded = 0
      let failed = 0
      setBulkPcProgress({ current: 0, total: targets.length, succeeded: 0, failed: 0 })

      for (let i = 0; i < targets.length; i++) {
        if (cancelBulkPcRef.current || selectedSetIdRef.current !== capturedSetId) break

        // 2件目以降は3.5秒待機（サーバー側3秒レート制限 + マージン）
        if (i > 0) await new Promise(r => setTimeout(r, 3500))
        if (cancelBulkPcRef.current || selectedSetIdRef.current !== capturedSetId) break

        const card = targets[i]
        try {
          setPcLoading(prev => ({ ...prev, [card.id]: true }))
          const res = await fetch('/api/justtcg/match', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: card.name, number: card.number, game: selectedGameRef.current }),
          })

          if (res.status === 429) {
            if (selectedSetIdRef.current === capturedSetId) {
              setPcMatches(prev => ({ ...prev, [card.id]: null }))
            }
            failed++
          } else if (!res.ok) {
            throw new Error(`HTTP ${res.status}`)
          } else {
            const json = await res.json()
            const match: PCMatch | null = json.success ? json.data : null
            if (selectedSetIdRef.current === capturedSetId) {
              setPcMatches(prev => ({ ...prev, [card.id]: match }))
            }

            if (match) {
              succeeded++
              // Gemini で日本語名抽出（fire-and-forget、startTransitionで低優先度バッチ化）
              if (match.imageUrl && setJaNameRef.current) {
                const cardId = card.id
                const cardName = card.name
                extractJaName(match.imageUrl).then(name => {
                  if (name && setJaNameRef.current && selectedSetIdRef.current === capturedSetId) {
                    const finalName = appendVariantSuffix(cardName, name)
                    startTransition(() => { setJaNameRef.current!(cardId, finalName) })
                  }
                })
              }
            } else {
              failed++
            }
          }
        } catch {
          if (selectedSetIdRef.current === capturedSetId) {
            setPcMatches(prev => ({ ...prev, [card.id]: null }))
          }
          failed++
        } finally {
          if (selectedSetIdRef.current === capturedSetId) {
            setPcLoading(prev => ({ ...prev, [card.id]: false }))
          }
        }

        if (selectedSetIdRef.current === capturedSetId) {
          setBulkPcProgress({ current: i + 1, total: targets.length, succeeded, failed })
        }
      }

      // 完了後クリア
      if (selectedSetIdRef.current === capturedSetId) {
        setBulkPcProgress(null)
      }
    } finally {
      bulkPcRunningRef.current = false
    }
  }, [extractJaName])

  const cancelBulkPcSearch = useCallback(() => {
    cancelBulkPcRef.current = true
  }, [])

  // アクション
  const setsRef = useRef(sets)
  setsRef.current = sets
  const selectSet = useCallback((setId: string) => {
    setSelectedSetId(setId)
    // R13-INT02: セット選択時にフィルタテキストをクリア（上書きするとfilteredSetsが1件になり使いにくい）
    if (setId) setSetFilterText('')
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

  // レアリティフィルタ操作（memo安定なコールバック）
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
    selectedGame, sets, selectedSetId, cards, selectedCard, usage,
    loadingSets, loadingCards, error,
    search, rarityFilter, setFilterText, sortBy, sortOrder, japaneseOnly,
    pcMatches, pcLoading, showRegistration,
    filteredCards, filteredSets, rarities, stats,
    selectedSet,
    bulkPcProgress,

    setSelectedGame, selectSet, selectCard,
    setSearch, toggleRarity, clearRarityFilter, setSetFilterText,
    setSortBy, setSortOrder, setJapaneseOnly,
    handlePcMatch, handleBulkPcSearch, cancelBulkPcSearch,
    injectSetJaName,
    injectCheckedCards: checkedCardsExtRef,
    clearError,
    toggleRegistration,
  }
}
