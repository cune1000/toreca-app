'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Database, Search, RefreshCw, Plus, Globe, CheckSquare, Square, Settings, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { buildKanaSearchFilter } from '@/lib/utils/kana'
import { getRarityDisplayName } from '@/lib/rarity-mapping'
import { getSeriesFromSetCode } from '@/lib/justtcg-set-names'
import type { CardWithRelations, CategoryLarge, Rarity } from '@/lib/types'

// =============================================================================
// Types
// =============================================================================

interface Props {
  onAddCard: () => void
  onImportCards: () => void
  onPriceChartingImport: () => void
}

const UNSET = '__UNSET__'

// =============================================================================
// Component
// =============================================================================

export default function CardsPage({
  onAddCard,
  onImportCards,
  onPriceChartingImport,
}: Props) {
  // sessionStorage永続化ヘルパー（保存のみ、復元は一括で行う）
  const useSessionState = <T,>(key: string, defaultValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
    const [value, setValue] = useState<T>(defaultValue)
    useEffect(() => {
      if (filtersHydrated) {
        sessionStorage.setItem(`cards-filter-${key}`, JSON.stringify(value))
      }
    }, [key, value])
    return [value, setValue]
  }

  const [filtersHydrated, setFiltersHydrated] = useState(false)

  // State（sessionStorageに永続化）
  const [searchQuery, setSearchQuery] = useSessionState('searchQuery', '')
  const [filterCategoryLarge, setFilterCategoryLarge] = useSessionState('categoryLarge', '')
  const [filterSeries, setFilterSeries] = useSessionState('series', '')
  const [filterSetCode, setFilterSetCode] = useSessionState('setCode', '')
  const [filterRarity, setFilterRarity] = useSessionState('rarity', '')
  const [filterExpansion, setFilterExpansion] = useSessionState('expansion', '')
  const [filterCardNumber, setFilterCardNumber] = useSessionState('cardNumber', '')
  const [expansions, setExpansions] = useState<string[]>([])
  const [setCodes, setSetCodes] = useState<string[]>([])
  const [seriesList, setSeriesList] = useState<string[]>([])
  const [codeToSeries, setCodeToSeries] = useState<Record<string, string>>({})
  const [codeToExpansions, setCodeToExpansions] = useState<Record<string, Set<string>>>({})
  const [currentPage, setCurrentPage] = useSessionState('page', 1)
  const [sortField, setSortField] = useSessionState<string>('sortField', 'created_at')
  const [sortAsc, setSortAsc] = useSessionState<boolean>('sortAsc', false)

  // マウント後にsessionStorageから全フィルタを一括復元
  useEffect(() => {
    const restore = (key: string) => {
      const saved = sessionStorage.getItem(`cards-filter-${key}`)
      if (saved !== null) {
        try { return JSON.parse(saved) } catch { return undefined }
      }
      return undefined
    }
    const sq = restore('searchQuery'); if (sq !== undefined) setSearchQuery(sq)
    const cl = restore('categoryLarge'); if (cl !== undefined) setFilterCategoryLarge(cl)
    const sr = restore('series'); if (sr !== undefined) setFilterSeries(sr)
    const sc = restore('setCode'); if (sc !== undefined) setFilterSetCode(sc)
    const r = restore('rarity'); if (r !== undefined) setFilterRarity(r)
    const e = restore('expansion'); if (e !== undefined) setFilterExpansion(e)
    const cn = restore('cardNumber'); if (cn !== undefined) setFilterCardNumber(cn)
    const p = restore('page'); if (p !== undefined) setCurrentPage(p)
    const sf = restore('sortField'); if (sf !== undefined) setSortField(sf)
    const sa = restore('sortAsc'); if (sa !== undefined) setSortAsc(sa)
    sessionStorage.removeItem('cards-filter-categoryMedium')
    sessionStorage.removeItem('cards-filter-categorySmall')
    setFiltersHydrated(true)
  }, [])
  const [totalCount, setTotalCount] = useState(0)
  const [filteredCards, setFilteredCards] = useState<CardWithRelations[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const [categories, setCategories] = useState<CategoryLarge[]>([])
  const [rarities, setRarities] = useState<Rarity[]>([])
  const [cardStatuses, setCardStatuses] = useState<Record<string, any>>({})
  const [hoveredImage, setHoveredImage] = useState<{ url: string; x: number; y: number } | null>(null)
  const [pageJumpInput, setPageJumpInput] = useState('')

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [batchUpdates, setBatchUpdates] = useState<Record<string, string | null>>({})
  const [batchLoading, setBatchLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [batchRarities, setBatchRarities] = useState<Rarity[]>([])

  const [cardSaleUrls, setCardSaleUrls] = useState<Record<string, any[]>>({})
  const [cardPurchaseLinks, setCardPurchaseLinks] = useState<Record<string, string[]>>({})

  const ITEMS_PER_PAGE = 50

  // =============================================================================
  // Data Fetching
  // =============================================================================

  useEffect(() => {
    const fetchCardSaleUrls = async () => {
      if (filteredCards.length === 0) return
      const cardIds = filteredCards.map(c => c.id)
      const { data } = await supabase
        .from('card_sale_urls')
        .select('id, card_id, product_url, site_id, site:site_id(id, name, icon)')
        .in('card_id', cardIds)
      if (data) {
        const map: Record<string, any[]> = {}
        data.forEach(url => {
          if (!map[url.card_id]) map[url.card_id] = []
          map[url.card_id].push(url)
        })
        setCardSaleUrls(map)
      }
    }
    const fetchPurchaseLinks = async () => {
      if (filteredCards.length === 0) return
      const cardIds = filteredCards.map(c => c.id)
      const { data } = await supabase
        .from('card_purchase_links')
        .select('card_id, shop:shop_id(name)')
        .in('card_id', cardIds)
      if (data) {
        const map: Record<string, string[]> = {}
        data.forEach((link: any) => {
          const shopName = link.shop?.name || ''
          if (!map[link.card_id]) map[link.card_id] = []
          if (!map[link.card_id].includes(shopName)) {
            map[link.card_id].push(shopName)
          }
        })
        setCardPurchaseLinks(map)
      }
    }
    fetchCardSaleUrls()
    fetchPurchaseLinks()
  }, [filteredCards, refreshKey])

  useEffect(() => {
    const fetchFilters = async () => {
      const { data: catData } = await supabase
        .from('category_large')
        .select('id, name, icon')
        .order('sort_order')
      setCategories(catData || [])

      const { data: rarData } = await supabase
        .from('rarities')
        .select('id, name, large_id')
        .order('sort_order')
      setRarities(rarData || [])

      const { data: expData } = await supabase
        .from('cards')
        .select('expansion, set_code')
        .order('expansion')
        .limit(10000)
      if (expData) {
        const uniqueExps = [...new Set(expData.map(d => d.expansion).filter(Boolean))] as string[]
        setExpansions(uniqueExps)
        const uniqueCodes = [...new Set(expData.map(d => d.set_code).filter(Boolean))] as string[]
        uniqueCodes.sort()
        setSetCodes(uniqueCodes)

        const c2s: Record<string, string> = {}
        const c2e: Record<string, Set<string>> = {}
        const seriesSet = new Set<string>()
        for (const code of uniqueCodes) {
          const series = getSeriesFromSetCode(code)
          if (series) {
            c2s[code] = series
            seriesSet.add(series)
          }
        }
        for (const d of expData) {
          if (d.set_code && d.expansion) {
            if (!c2e[d.set_code]) c2e[d.set_code] = new Set()
            c2e[d.set_code].add(d.expansion)
          }
        }
        const seriesOrder = ['M', 'SV', 'S', 'SM', 'XY', 'CP', 'BW', 'L', 'PT', 'DP', 'OP', 'WCS']
        const sorted = [...seriesSet].sort((a, b) => {
          const ia = seriesOrder.indexOf(a)
          const ib = seriesOrder.indexOf(b)
          return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
        })
        setSeriesList(sorted)
        setCodeToSeries(c2s)
        setCodeToExpansions(c2e)
      }
    }
    fetchFilters()
  }, [])

  useEffect(() => {
    const fetchStatuses = async () => {
      const { data } = await supabase
        .from('card_sale_urls')
        .select('card_id, check_interval, error_count, last_checked_at, auto_scrape_mode, auto_scrape_interval_minutes, last_scraped_at, last_scrape_status, last_scrape_error, product_url')

      const statusMap: Record<string, any> = {}
      data?.forEach(url => {
        const isSnkrdunk = url.product_url?.includes('snkrdunk.com')
        const existing = statusMap[url.card_id]
        if (!existing || url.error_count > 0) {
          statusMap[url.card_id] = {
            ...existing,
            interval: url.check_interval || 180,
            hasError: url.error_count > 0,
            lastChecked: url.last_checked_at
          }
        }
        if (isSnkrdunk) {
          statusMap[url.card_id] = {
            ...statusMap[url.card_id],
            snkrdunk: {
              mode: url.auto_scrape_mode,
              intervalMin: url.auto_scrape_interval_minutes,
              lastScraped: url.last_scraped_at,
              status: url.last_scrape_status,
              error: url.last_scrape_error
            }
          }
        }
      })
      setCardStatuses(statusMap)
    }
    fetchStatuses()
  }, [])

  // 検索・フィルタ・ページネーション
  useEffect(() => {
    if (!filtersHydrated) return

    const fetchFilteredCards = async () => {
      setIsLoading(true)

      let query = supabase
        .from('cards')
        .select(`*, category_large:category_large_id(name, icon), rarities:rarity_id(name)`, { count: 'exact' })

      // 検索条件（1文字から有効）
      if (searchQuery.length >= 1) {
        query = query.or(buildKanaSearchFilter(searchQuery, ['name', 'name_en', 'card_number', 'expansion']))
      }

      if (filterCategoryLarge === UNSET) {
        query = query.is('category_large_id', null)
      } else if (filterCategoryLarge) {
        query = query.eq('category_large_id', filterCategoryLarge)
      }

      if (filterSeries && !filterSetCode) {
        const seriesCodes = setCodes.filter(code => codeToSeries[code] === filterSeries)
        if (seriesCodes.length > 0) {
          query = query.in('set_code', seriesCodes)
        }
      }

      if (filterSetCode === UNSET) {
        query = query.is('set_code', null)
      } else if (filterSetCode) {
        query = query.eq('set_code', filterSetCode)
      }

      if (filterRarity === UNSET) {
        query = query.is('rarity_id', null)
      } else if (filterRarity) {
        query = query.eq('rarity_id', filterRarity)
      }

      if (filterExpansion === UNSET) {
        query = query.is('expansion', null)
      } else if (filterExpansion) {
        query = query.eq('expansion', filterExpansion)
      }

      if (filterCardNumber === UNSET) {
        query = query.or('card_number.is.null,card_number.eq.')
      } else if (filterCardNumber === '__DUPLICATE__') {
        const { data: allCards } = await supabase.from('cards').select('id, image_url')
        if (allCards) {
          const urlCount = new Map<string, string[]>()
          for (const c of allCards) {
            if (!c.image_url) continue
            const ids = urlCount.get(c.image_url) || []
            ids.push(c.id)
            urlCount.set(c.image_url, ids)
          }
          const dupIds = Array.from(urlCount.values()).filter(ids => ids.length > 1).flat()
          if (dupIds.length > 0) {
            query = query.in('id', dupIds)
          } else {
            setFilteredCards([])
            setTotalCount(0)
            setIsLoading(false)
            return
          }
        }
      } else if (filterCardNumber) {
        query = query.ilike('card_number', `%${filterCardNumber}%`)
      }

      const from = (currentPage - 1) * ITEMS_PER_PAGE
      const to = from + ITEMS_PER_PAGE - 1

      const { data, count, error } = await query
        .order(sortField, { ascending: sortAsc })
        .range(from, to)

      if (!error) {
        setFilteredCards(data || [])
        setTotalCount(count || 0)
      }
      setIsLoading(false)
    }

    const timer = setTimeout(fetchFilteredCards, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, filterCategoryLarge, filterSeries, filterSetCode, filterRarity, filterExpansion, filterCardNumber, currentPage, sortField, sortAsc, refreshKey, filtersHydrated])

  const filterChangeCount = useRef(0)
  useEffect(() => {
    if (!filtersHydrated) return
    filterChangeCount.current++
    if (filterChangeCount.current <= 1) return
    setCurrentPage(1)
    setSelectedIds(new Set())
  }, [searchQuery, filterCategoryLarge, filterSeries, filterSetCode, filterRarity, filterExpansion, filterCardNumber, filtersHydrated])

  // =============================================================================
  // Checkbox Logic
  // =============================================================================

  const isAllSelected = filteredCards.length > 0 && filteredCards.every(c => selectedIds.has(c.id))

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredCards.map(c => c.id)))
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // =============================================================================
  // Batch Edit Logic
  // =============================================================================

  const openBatchModal = () => {
    setBatchUpdates({})
    setBatchRarities([])
    setShowBatchModal(true)
  }

  const handleBatchLargeChange = async (value: string) => {
    setBatchRarities([])
    setBatchUpdates({ category_large_id: value || null })

    if (value) {
      const { data: rarData } = await supabase
        .from('rarities')
        .select('id, name, large_id')
        .eq('large_id', value)
        .order('sort_order')
      setBatchRarities(rarData || [])
    }
  }

  const executeBatchUpdate = async () => {
    const updates: Record<string, string | null> = {}
    for (const [key, value] of Object.entries(batchUpdates)) {
      if (value !== undefined) {
        updates[key] = value || null
      }
    }

    if (Object.keys(updates).length === 0) return

    setBatchLoading(true)
    try {
      const res = await fetch('/api/cards/batch-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardIds: Array.from(selectedIds),
          updates
        })
      })

      const json = await res.json()
      if (json.success) {
        alert(`${json.updated}件のカードを更新しました`)
        setShowBatchModal(false)
        setShowConfirm(false)
        setSelectedIds(new Set())
        setRefreshKey(k => k + 1)
      } else {
        alert(`エラー: ${json.error}`)
      }
    } catch (err: any) {
      alert(`エラー: ${err.message}`)
    } finally {
      setBatchLoading(false)
    }
  }

  const getBatchChangeLabel = () => {
    const labels: string[] = []
    if (batchUpdates.category_large_id !== undefined) {
      const cat = categories.find(c => c.id === batchUpdates.category_large_id)
      labels.push(`ゲーム: ${cat?.name || '（クリア）'}`)
    }
    if (batchUpdates.rarity_id !== undefined) {
      const r = batchRarities.find(r => r.id === batchUpdates.rarity_id)
      labels.push(`レアリティ: ${r?.name || '（クリア）'}`)
    }
    return labels
  }

  // =============================================================================
  // Helpers
  // =============================================================================

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

  const formatRelTime = (dateStr: string | null) => {
    if (!dateStr) return null
    const diffMs = Date.now() - new Date(dateStr).getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 60) return `${diffMins}分前`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h前`
    return `${Math.floor(diffHours / 24)}日前`
  }

  const filteredRarities = filterCategoryLarge && filterCategoryLarge !== UNSET
    ? rarities.filter(r => r.large_id === filterCategoryLarge)
    : rarities

  const filteredSetCodes = filterSeries
    ? setCodes.filter(code => codeToSeries[code] === filterSeries)
    : setCodes

  const filteredExpansions = (() => {
    if (filterSetCode && filterSetCode !== UNSET) {
      return [...(codeToExpansions[filterSetCode] || [])].sort()
    }
    if (filterSeries) {
      const exps = new Set<string>()
      for (const code of filteredSetCodes) {
        const e = codeToExpansions[code]
        if (e) e.forEach(exp => exps.add(exp))
      }
      return [...exps].sort()
    }
    return expansions
  })()

  const hasActiveFilter = !!(searchQuery || filterCategoryLarge || filterSeries || filterSetCode || filterRarity || filterExpansion || filterCardNumber)

  const resetFilters = () => {
    setSearchQuery('')
    setFilterCategoryLarge('')
    setFilterSeries('')
    setFilterSetCode('')
    setFilterRarity('')
    setFilterExpansion('')
    setFilterCardNumber('')
    setCurrentPage(1)
  }

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortAsc(!sortAsc)
    } else {
      setSortField(field)
      setSortAsc(field === 'name') // 名前は昇順デフォルト、他は降順
    }
  }

  const SortHeader = ({ field, children, className = '' }: { field: string; children: React.ReactNode; className?: string }) => (
    <th
      className={`px-3 py-2.5 text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-800 select-none ${className}`}
      onClick={() => handleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {children}
        {sortField === field && (
          <span className="text-blue-500">{sortAsc ? '↑' : '↓'}</span>
        )}
      </span>
    </th>
  )

  // 連携バッジ
  const getLinkBadges = (card: CardWithRelations) => {
    const badges: React.ReactNode[] = []
    const urls = cardSaleUrls[card.id] || []
    const purchases = cardPurchaseLinks[card.id] || []

    urls.forEach((u: any, i: number) => {
      badges.push(
        <span key={`url-${i}`} title={`${u.site?.name || '不明'}\n${u.product_url}`} className="text-sm leading-none">
          {u.site?.icon || '🔗'}
        </span>
      )
    })
    if (card.pricecharting_id) {
      badges.push(<span key="pc" title="PriceCharting" className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1 rounded">PC</span>)
    }
    if (card.justtcg_id) {
      badges.push(<span key="jt" title="JustTCG" className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1 rounded">JT</span>)
    }
    if (purchases.some(s => s.includes('シンソク'))) {
      badges.push(<span key="ss" title="シンソク" className="text-[10px] font-bold text-green-700 bg-green-50 px-1 rounded">SS</span>)
    }
    if (purchases.some(s => s.includes('ラウンジ'))) {
      badges.push(<span key="lg" title="ラウンジ" className="text-[10px] font-bold text-orange-700 bg-orange-50 px-1 rounded">LG</span>)
    }
    return badges.length > 0 ? badges : <span className="text-gray-300 text-xs">-</span>
  }

  // 監視バッジ
  const getStatusBadge = (cardId: string) => {
    const status = cardStatuses[cardId]
    if (!status) return null
    const badges: React.ReactNode[] = []

    if (status.hasError) {
      badges.push(<span key="err" className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] rounded font-medium">ERR</span>)
    }
    if (status.snkrdunk) {
      const sn = status.snkrdunk
      if (sn.status === 'error') {
        badges.push(<span key="sn" className="px-1.5 py-0.5 bg-red-100 text-red-700 text-[10px] rounded font-medium">SN:ERR</span>)
      } else if (sn.mode !== 'off') {
        const rel = formatRelTime(sn.lastScraped)
        badges.push(<span key="sn" className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-[10px] rounded font-medium">SN:{rel || '-'}</span>)
      }
    }

    return badges.length > 0 ? <div className="flex gap-0.5 flex-wrap">{badges}</div> : null
  }

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <div className="p-4">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {/* ヘッダー */}
        <div className="px-4 pt-3 pb-3 border-b border-gray-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h2 className="font-bold text-gray-800">カード管理</h2>
              <span className="text-xs text-gray-400 tabular-nums">{totalCount}件</span>
            </div>
            <div className="flex gap-1.5">
              {selectedIds.size > 0 && (
                <button
                  onClick={openBatchModal}
                  className="px-3 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 text-xs font-medium flex items-center gap-1.5"
                >
                  <Settings size={14} /> 一括設定 ({selectedIds.size})
                </button>
              )}
              <button
                onClick={onImportCards}
                className="px-3 py-1.5 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 text-xs font-medium"
              >
                公式インポート
              </button>
              <button
                onClick={onPriceChartingImport}
                className="px-3 py-1.5 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 text-xs font-medium"
              >
                PC Import
              </button>
              <button
                onClick={onAddCard}
                className="px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-xs font-medium flex items-center gap-1"
              >
                <Plus size={14} /> 追加
              </button>
            </div>
          </div>

          {/* 検索 + フィルタ */}
          <div className="flex gap-2 items-center flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="カード名・英語名・型番で検索..."
                className="w-full pl-8 pr-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>

            <select
              value={filterCategoryLarge}
              onChange={(e) => setFilterCategoryLarge(e.target.value)}
              className="px-2 py-1.5 border rounded-lg text-xs"
            >
              <option value="">全ゲーム</option>
              <option value={UNSET}>未設定</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
              ))}
            </select>

            <select
              value={filterSeries}
              onChange={(e) => {
                setFilterSeries(e.target.value)
                setFilterSetCode('')
                setFilterExpansion('')
              }}
              className="px-2 py-1.5 border rounded-lg text-xs"
            >
              <option value="">全シリーズ</option>
              {seriesList.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <select
              value={filterExpansion}
              onChange={(e) => setFilterExpansion(e.target.value)}
              className="px-2 py-1.5 border rounded-lg text-xs max-w-[180px]"
            >
              <option value="">全収録弾</option>
              <option value={UNSET}>未設定</option>
              {filteredExpansions.map(exp => (
                <option key={exp} value={exp}>{exp}</option>
              ))}
            </select>

            <select
              value={filterRarity}
              onChange={(e) => setFilterRarity(e.target.value)}
              className="px-2 py-1.5 border rounded-lg text-xs"
            >
              <option value="">全レアリティ</option>
              <option value={UNSET}>未設定</option>
              {filteredRarities.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>

            <select
              value={filterCardNumber}
              onChange={(e) => setFilterCardNumber(e.target.value)}
              className="px-2 py-1.5 border rounded-lg text-xs"
            >
              <option value="">型番</option>
              <option value={UNSET}>未登録</option>
              <option value="__DUPLICATE__">重複</option>
            </select>

            {hasActiveFilter && (
              <button
                onClick={resetFilters}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg"
                title="フィルタリセット"
              >
                <X size={16} />
              </button>
            )}
          </div>
        </div>

        {/* テーブル */}
        {isLoading ? (
          <div className="p-8 text-center">
            <RefreshCw className="animate-spin mx-auto text-gray-400" size={28} />
          </div>
        ) : filteredCards.length > 0 ? (
          <div className="overflow-auto">
            <table className="w-full">
              <thead className="bg-gray-50/80 sticky top-0">
                <tr>
                  <th className="px-2 py-2.5 w-8">
                    <button onClick={toggleSelectAll} className="text-gray-400 hover:text-gray-700">
                      {isAllSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                    </button>
                  </th>
                  <th className="text-left px-2 py-2.5 text-xs font-medium text-gray-500 w-14"></th>
                  <SortHeader field="name" className="text-left">カード名</SortHeader>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">収録弾</th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-gray-500">レアリティ</th>
                  <th className="text-center px-2 py-2.5 text-xs font-medium text-gray-500">連携</th>
                  <th className="text-center px-2 py-2.5 text-xs font-medium text-gray-500">状態</th>
                  <SortHeader field="created_at" className="text-right">登録日</SortHeader>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredCards.map((card) => {
                  const series = card.set_code ? getSeriesFromSetCode(card.set_code) : null
                  return (
                    <tr
                      key={card.id}
                      className={`hover:bg-gray-50/80 cursor-pointer transition-colors ${selectedIds.has(card.id) ? 'bg-orange-50/60' : ''}`}
                    >
                      <td className="px-2 py-1.5" onClick={(e) => { e.stopPropagation(); toggleSelect(card.id) }}>
                        {selectedIds.has(card.id)
                          ? <CheckSquare size={16} className="text-orange-500" />
                          : <Square size={16} className="text-gray-300" />
                        }
                      </td>
                      <td className="px-2 py-1.5" onClick={() => window.open(`/cards/${card.id}`, '_blank')}>
                        {card.image_url ? (
                          <img
                            src={card.image_url}
                            alt={card.name}
                            className="w-10 h-14 object-contain rounded"
                            onMouseEnter={e => {
                              const rect = e.currentTarget.getBoundingClientRect()
                              setHoveredImage({ url: card.image_url!, x: rect.right + 8, y: rect.top })
                            }}
                            onMouseLeave={() => setHoveredImage(null)}
                          />
                        ) : (
                          <div className="w-10 h-14 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-[10px]">-</div>
                        )}
                      </td>
                      <td className="px-3 py-1.5" onClick={() => window.open(`/cards/${card.id}`, '_blank')}>
                        <p className="text-sm font-medium text-gray-800 leading-tight truncate max-w-[280px]">{card.name}</p>
                        {card.name_en && (
                          <p className="text-[11px] text-gray-400 leading-tight truncate max-w-[280px]">{card.name_en}</p>
                        )}
                        {card.card_number && (
                          <span className="text-[10px] text-gray-400 font-mono">#{card.card_number}</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5" onClick={() => window.open(`/cards/${card.id}`, '_blank')}>
                        <div className="flex items-center gap-1.5">
                          {series && (
                            <span className="px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-mono font-bold shrink-0">{series}</span>
                          )}
                          <span className="text-xs text-gray-600 truncate max-w-[140px]">{card.expansion || <span className="text-gray-300">-</span>}</span>
                        </div>
                      </td>
                      <td className="px-3 py-1.5" onClick={() => window.open(`/cards/${card.id}`, '_blank')}>
                        {card.rarities?.name ? (
                          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-medium">
                            {card.rarities.name}
                          </span>
                        ) : card.rarity ? (
                          <span className="px-1.5 py-0.5 bg-purple-50 text-purple-500 rounded text-[10px] font-medium">
                            {getRarityDisplayName(card.rarity)}
                          </span>
                        ) : (
                          <span className="text-gray-300 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5" onClick={() => window.open(`/cards/${card.id}`, '_blank')}>
                        <div className="flex gap-0.5 flex-wrap justify-center">{getLinkBadges(card)}</div>
                      </td>
                      <td className="px-2 py-1.5 text-center" onClick={() => window.open(`/cards/${card.id}`, '_blank')}>
                        {getStatusBadge(card.id) || <span className="text-gray-300 text-xs">-</span>}
                      </td>
                      <td className="px-3 py-1.5 text-right" onClick={() => window.open(`/cards/${card.id}`, '_blank')}>
                        <span className="text-[10px] text-gray-400 tabular-nums">
                          {card.created_at ? new Date(card.created_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' }) : '-'}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <Database size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm">{hasActiveFilter ? '条件に一致するカードがありません' : 'まだカードが登録されていません'}</p>
          </div>
        )}

        {/* ページネーション */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t flex flex-wrap items-center justify-center gap-1.5">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-2 py-1 border rounded text-xs hover:bg-gray-50 disabled:opacity-30"
            >
              最初
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-2.5 py-1 border rounded text-xs hover:bg-gray-50 disabled:opacity-30"
            >
              ←
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let page = i + 1
              if (totalPages > 5) {
                if (currentPage > 3) page = currentPage - 2 + i
                if (currentPage > totalPages - 2) page = totalPages - 4 + i
              }
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-2.5 py-1 rounded text-xs ${currentPage === page ? 'bg-blue-500 text-white' : 'border hover:bg-gray-50'}`}
                >
                  {page}
                </button>
              )
            })}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1 border rounded text-xs hover:bg-gray-50 disabled:opacity-30"
            >
              →
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-2 py-1 border rounded text-xs hover:bg-gray-50 disabled:opacity-30"
            >
              最後
            </button>
            <span className="text-[10px] text-gray-400 mx-1">|</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={1}
                max={totalPages}
                value={pageJumpInput}
                onChange={e => setPageJumpInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const p = parseInt(pageJumpInput)
                    if (!isNaN(p) && p >= 1 && p <= totalPages) {
                      setCurrentPage(p)
                      setPageJumpInput('')
                    }
                  }
                }}
                placeholder={`${currentPage}/${totalPages}`}
                className="w-16 px-1.5 py-1 border rounded text-xs text-center focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <button
                onClick={() => {
                  const p = parseInt(pageJumpInput)
                  if (!isNaN(p) && p >= 1 && p <= totalPages) {
                    setCurrentPage(p)
                    setPageJumpInput('')
                  }
                }}
                className="px-2 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600"
              >
                Go
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 画像ホバーズーム */}
      {hoveredImage && (
        <div
          className="fixed z-[100] pointer-events-none"
          style={{
            left: Math.min(hoveredImage.x, window.innerWidth - 320),
            top: Math.max(8, Math.min(hoveredImage.y, window.innerHeight - 440)),
          }}
        >
          <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-2">
            <img
              src={hoveredImage.url}
              alt=""
              className="w-72 h-auto max-h-[420px] object-contain rounded-lg"
            />
          </div>
        </div>
      )}

      {/* 一括設定モーダル */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowBatchModal(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">
              一括設定（{selectedIds.size}件）
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ゲーム</label>
                <select
                  value={batchUpdates.category_large_id || ''}
                  onChange={(e) => handleBatchLargeChange(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                >
                  <option value="">（変更しない）</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                  ))}
                </select>
              </div>

              {batchRarities.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">レアリティ</label>
                  <select
                    value={batchUpdates.rarity_id || ''}
                    onChange={(e) => setBatchUpdates(prev => ({ ...prev, rarity_id: e.target.value || null }))}
                    className="w-full border rounded-lg px-3 py-2"
                  >
                    <option value="">（変更しない）</option>
                    {batchRarities.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowBatchModal(false)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={() => setShowConfirm(true)}
                disabled={Object.keys(batchUpdates).length === 0}
                className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
              >
                変更を確認
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 確認ダイアログ */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-3 text-orange-600">
              変更の確認
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              以下の変更を <strong>{selectedIds.size}件</strong> のカードに適用します：
            </p>
            <ul className="list-disc list-inside text-sm space-y-1 mb-4 bg-orange-50 p-3 rounded-lg">
              {getBatchChangeLabel().map((label, i) => (
                <li key={i} className="font-medium">{label}</li>
              ))}
            </ul>
            <p className="text-xs text-red-500 mb-4">
              ※ この操作は元に戻せません
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 px-4 py-2 border rounded-lg hover:bg-gray-50"
              >
                戻る
              </button>
              <button
                onClick={executeBatchUpdate}
                disabled={batchLoading}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
              >
                {batchLoading ? '更新中...' : '実行する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
