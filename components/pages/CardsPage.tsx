'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Database, Search, RefreshCw, Plus, Globe, CheckSquare, Square, Settings, X } from 'lucide-react'
import { supabase, fetchAllPaginated } from '@/lib/supabase'
import { buildKanaSearchFilter } from '@/lib/utils/kana'
import { escapeIlike, formatRelativeTime } from '@/lib/utils'
import { getRarityDisplayName } from '@/lib/rarity-mapping'
import { getSeriesFromSetCode } from '@/lib/justtcg-set-names'
import { useSessionState } from '@/lib/hooks/useSessionState'
import Pagination from '@/components/ui/Pagination'
import ImageHoverZoom from '@/components/ui/ImageHoverZoom'
import CardsBatchEditModal from '@/components/pages/CardsBatchEditModal'
import type { CardWithRelations, CategoryLarge } from '@/lib/types'

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
  const [filtersHydrated, setFiltersHydrated] = useState(false)

  // State（sessionStorageに永続化）
  const [searchQuery, setSearchQuery] = useSessionState('searchQuery', '', filtersHydrated)
  const [filterCategoryLarge, setFilterCategoryLarge] = useSessionState('categoryLarge', '', filtersHydrated)
  const [filterSeries, setFilterSeries] = useSessionState('series', '', filtersHydrated)
  const [filterSetCode, setFilterSetCode] = useSessionState('setCode', '', filtersHydrated)
  const [filterRarity, setFilterRarity] = useSessionState('rarity', '', filtersHydrated)
  const [filterExpansion, setFilterExpansion] = useSessionState('expansion', '', filtersHydrated)
  const [filterCardNumber, setFilterCardNumber] = useSessionState('cardNumber', '', filtersHydrated)
  const [expansions, setExpansions] = useState<string[]>([])
  const [setCodes, setSetCodes] = useState<string[]>([])
  const [seriesList, setSeriesList] = useState<string[]>([])
  const [codeToSeries, setCodeToSeries] = useState<Record<string, string>>({})
  const [codeToExpansions, setCodeToExpansions] = useState<Record<string, Set<string>>>({})
  const [currentPage, setCurrentPage] = useSessionState('page', 1, filtersHydrated)
  const [sortField, setSortField] = useSessionState<string>('sortField', 'created_at', filtersHydrated)
  const [sortAsc, setSortAsc] = useSessionState<boolean>('sortAsc', false, filtersHydrated)

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
  const [rarityTexts, setRarityTexts] = useState<string[]>([])
  const [cardStatuses, setCardStatuses] = useState<Record<string, any>>({})
  const [hoveredImage, setHoveredImage] = useState<{ url: string; x: number; y: number } | null>(null)

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [batchUpdates, setBatchUpdates] = useState<Record<string, string | null>>({})
  const [batchLoading, setBatchLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

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
    Promise.all([fetchCardSaleUrls(), fetchPurchaseLinks()])
  }, [filteredCards, refreshKey])

  useEffect(() => {
    const fetchFilters = async () => {
      const { data: catData } = await supabase
        .from('category_large')
        .select('id, name, icon')
        .order('sort_order')
      setCategories(catData || [])

      // Supabaseのmax_rows=1000制限を回避するためページネーションで全行取得
      // rarity, expansion, set_code を1回のページネーションで取得
      const allData = await fetchAllPaginated<Record<string, any>>(
        () => supabase.from('cards').select('rarity, expansion, set_code')
      )
      if (allData.length > 0) {
        const uniqueRarities = [...new Set(allData.map(d => d.rarity).filter(Boolean))] as string[]
        uniqueRarities.sort()
        setRarityTexts(uniqueRarities)

        const uniqueExps = [...new Set(allData.map(d => d.expansion).filter(Boolean))] as string[]
        setExpansions(uniqueExps)
        const uniqueCodes = [...new Set(allData.map(d => d.set_code).filter(Boolean))] as string[]
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
        for (const d of allData) {
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
        .select(`*, category_large:category_large_id(name, icon)`, { count: 'exact' })

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
        query = query.is('rarity', null)
      } else if (filterRarity) {
        query = query.eq('rarity', filterRarity)
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
        query = query.ilike('card_number', `%${escapeIlike(filterCardNumber)}%`)
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
    setShowBatchModal(true)
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
    if (batchUpdates.rarity !== undefined) {
      labels.push(`レアリティ: ${batchUpdates.rarity ? getRarityDisplayName(batchUpdates.rarity) : '（クリア）'}`)
    }
    return labels
  }

  // =============================================================================
  // Helpers
  // =============================================================================

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

  const formatRelTime = (dateStr: string | null) => {
    if (!dateStr) return null
    return formatRelativeTime(dateStr)
  }

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
              {rarityTexts.map(r => (
                <option key={r} value={r}>{getRarityDisplayName(r)}</option>
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
                        {card.rarity ? (
                          <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-[10px] font-medium">
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
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
        />
      </div>

      {/* 画像ホバーズーム */}
      <ImageHoverZoom hoveredImage={hoveredImage} />

      {/* 一括設定モーダル */}
      {showBatchModal && (
        <CardsBatchEditModal
          selectedCount={selectedIds.size}
          categories={categories}
          rarityTexts={rarityTexts}
          batchUpdates={batchUpdates}
          setBatchUpdates={setBatchUpdates}
          batchLoading={batchLoading}
          showConfirm={showConfirm}
          setShowConfirm={setShowConfirm}
          onClose={() => setShowBatchModal(false)}
          onExecute={executeBatchUpdate}
          getBatchChangeLabel={getBatchChangeLabel}
        />
      )}
    </div>
  )
}
