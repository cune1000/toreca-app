'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Database, Search, RefreshCw, Plus, Globe, CheckSquare, Square, Settings, Link, Loader2, Check } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { buildKanaSearchFilter } from '@/lib/utils/kana'
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
  const [filterSetCode, setFilterSetCode] = useSessionState('setCode', '')
  const [filterRarity, setFilterRarity] = useSessionState('rarity', '')
  const [filterExpansion, setFilterExpansion] = useSessionState('expansion', '')
  const [filterCardNumber, setFilterCardNumber] = useSessionState('cardNumber', '')
  const [expansions, setExpansions] = useState<string[]>([])
  const [setCodes, setSetCodes] = useState<string[]>([])
  const [currentPage, setCurrentPage] = useSessionState('page', 1)

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
    const sc = restore('setCode'); if (sc !== undefined) setFilterSetCode(sc)
    const r = restore('rarity'); if (r !== undefined) setFilterRarity(r)
    const e = restore('expansion'); if (e !== undefined) setFilterExpansion(e)
    const cn = restore('cardNumber'); if (cn !== undefined) setFilterCardNumber(cn)
    const p = restore('page'); if (p !== undefined) setCurrentPage(p)
    // 旧カテゴリフィルターキーのクリーンアップ
    sessionStorage.removeItem('cards-filter-categoryMedium')
    sessionStorage.removeItem('cards-filter-categorySmall')
    setFiltersHydrated(true)
  }, [])
  const [totalCount, setTotalCount] = useState(0)
  const [filteredCards, setFilteredCards] = useState<CardWithRelations[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // Categories & Rarities
  const [categories, setCategories] = useState<CategoryLarge[]>([])
  const [rarities, setRarities] = useState<Rarity[]>([])

  // Card monitoring statuses
  const [cardStatuses, setCardStatuses] = useState<Record<string, any>>({})

  // Image hover zoom
  const [hoveredImage, setHoveredImage] = useState<{ url: string; x: number; y: number } | null>(null)
  // Page jump input
  const [pageJumpInput, setPageJumpInput] = useState('')

  // Checkbox & batch edit
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [batchUpdates, setBatchUpdates] = useState<Record<string, string | null>>({})
  const [batchLoading, setBatchLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // Batch modal
  const [batchRarities, setBatchRarities] = useState<Rarity[]>([])

  // インラインURL入力
  const [saleSites, setSaleSites] = useState<any[]>([])
  const [cardSaleUrls, setCardSaleUrls] = useState<Record<string, any[]>>({})
  const [inlineUrlInputs, setInlineUrlInputs] = useState<Record<string, string>>({})
  const [inlineUrlSaving, setInlineUrlSaving] = useState<Record<string, boolean>>({})
  const [inlineUrlSuccess, setInlineUrlSuccess] = useState<Record<string, boolean>>({})
  const [inlineUrlError, setInlineUrlError] = useState<Record<string, string>>({})

  // 買取紐付け状態（card_purchase_links）
  const [cardPurchaseLinks, setCardPurchaseLinks] = useState<Record<string, string[]>>({})

  const ITEMS_PER_PAGE = 50

  // =============================================================================
  // Data Fetching
  // =============================================================================

  // サイト・登録URLの取得
  useEffect(() => {
    const fetchSaleSites = async () => {
      const { data } = await supabase.from('sale_sites').select('id, name, icon').order('name')
      setSaleSites(data || [])
    }
    fetchSaleSites()
  }, [])

  // カード一覧が変わったら登録URL情報 + 買取紐付け情報を取得
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

  // URL自動サイト特定
  const detectSiteFromUrl = (url: string) => {
    if (!url || saleSites.length === 0) return null
    const lowerUrl = url.toLowerCase()
    if (lowerUrl.includes('snkrdunk.com')) return saleSites.find(s => s.name.includes('スニーカーダンク') || s.name.includes('スニダン') || s.name.toLowerCase().includes('snkrdunk'))
    if (lowerUrl.includes('cardrush.jp')) return saleSites.find(s => s.name.includes('カードラッシュ') || s.name.toLowerCase().includes('cardrush'))
    if (lowerUrl.includes('torecacamp')) return saleSites.find(s => s.name.includes('トレカキャンプ') || s.name.toLowerCase().includes('torecacamp'))
    if (lowerUrl.includes('mercari.com')) return saleSites.find(s => s.name.includes('メルカリ') || s.name.toLowerCase().includes('mercari'))
    if (lowerUrl.includes('auctions.yahoo')) return saleSites.find(s => s.name.includes('ヤフオク') || s.name.toLowerCase().includes('yahoo'))
    return null
  }

  // PriceCharting URLからproduct IDを抽出
  const extractPricechartingId = (url: string): string | null => {
    const match = url.match(/[?&]product=(\d+)/)
    return match ? match[1] : null
  }

  // インラインURL保存
  const handleInlineUrlSave = async (cardId: string) => {
    const url = inlineUrlInputs[cardId]?.trim()
    if (!url) return

    // PriceCharting URLの場合は専用フロー
    if (url.toLowerCase().includes('pricecharting.com')) {
      const pcId = extractPricechartingId(url)

      setInlineUrlSaving(prev => ({ ...prev, [cardId]: true }))
      setInlineUrlError(prev => { const n = { ...prev }; delete n[cardId]; return n })

      try {
        // PriceCharting紐付け（IDがあればID、なければURLを送信）
        const linkBody = pcId
          ? { card_id: cardId, pricecharting_id: pcId }
          : { card_id: cardId, pricecharting_url: url }
        const linkRes = await fetch('/api/overseas-prices/link', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(linkBody),
        })
        const linkJson = await linkRes.json()
        if (!linkJson.success) throw new Error(linkJson.error)

        // 即時価格取得（バックグラウンド）
        const resolvedId = linkJson.pricecharting_id || pcId
        if (resolvedId) {
          fetch('/api/overseas-prices/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ card_id: cardId, pricecharting_id: resolvedId }),
          }).catch(() => { })
        }

        // PCチェックを即座に反映
        setFilteredCards(prev => prev.map(c => c.id === cardId ? { ...c, pricecharting_id: resolvedId } : c))
        setInlineUrlInputs(prev => ({ ...prev, [cardId]: '' }))
        setInlineUrlSuccess(prev => ({ ...prev, [cardId]: true }))
        setTimeout(() => setInlineUrlSuccess(prev => { const n = { ...prev }; delete n[cardId]; return n }), 2000)
      } catch (err: any) {
        setInlineUrlError(prev => ({ ...prev, [cardId]: err.message }))
        setTimeout(() => setInlineUrlError(prev => { const n = { ...prev }; delete n[cardId]; return n }), 3000)
      } finally {
        setInlineUrlSaving(prev => ({ ...prev, [cardId]: false }))
      }
      return
    }

    // 通常サイトURL
    const site = detectSiteFromUrl(url)
    if (!site) {
      setInlineUrlError(prev => ({ ...prev, [cardId]: 'サイトを特定できません' }))
      setTimeout(() => setInlineUrlError(prev => { const n = { ...prev }; delete n[cardId]; return n }), 3000)
      return
    }

    setInlineUrlSaving(prev => ({ ...prev, [cardId]: true }))
    setInlineUrlError(prev => { const n = { ...prev }; delete n[cardId]; return n })

    try {
      const isSnkrdunk = url.toLowerCase().includes('snkrdunk.com')
      // upsert: 同じcard+siteなら既存URLを上書き
      const { error } = await supabase.from('card_sale_urls').upsert({
        card_id: cardId,
        site_id: site.id,
        product_url: url,
        check_interval: 180,
        ...(isSnkrdunk ? { auto_scrape_mode: 'manual', auto_scrape_interval_minutes: 1440 } : {})
      }, { onConflict: 'card_id,site_id' })
      if (error) throw error

      // 成功: 入力クリア、URL一覧更新
      setInlineUrlInputs(prev => ({ ...prev, [cardId]: '' }))
      setInlineUrlSuccess(prev => ({ ...prev, [cardId]: true }))
      setTimeout(() => setInlineUrlSuccess(prev => { const n = { ...prev }; delete n[cardId]; return n }), 2000)

      // 登録URL一覧をリフレッシュ
      const newUrl = { id: 'temp', card_id: cardId, product_url: url, site_id: site.id, site }
      setCardSaleUrls(prev => ({ ...prev, [cardId]: [...(prev[cardId] || []), newUrl] }))

      // バックグラウンドスクレイピング
      let source = null
      if (isSnkrdunk) source = 'snkrdunk'
      else if (url.includes('cardrush')) source = 'cardrush'
      else if (url.includes('torecacamp')) source = 'torecacamp'
      fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, source }),
      }).catch(() => { })
    } catch (err: any) {
      setInlineUrlError(prev => ({ ...prev, [cardId]: err.message }))
      setTimeout(() => setInlineUrlError(prev => { const n = { ...prev }; delete n[cardId]; return n }), 3000)
    } finally {
      setInlineUrlSaving(prev => ({ ...prev, [cardId]: false }))
    }
  }

  // カテゴリ取得
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

      // 収録弾 + セットコードの一覧を取得（デフォルト1000行を超えるケース対応）
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
      }
    }
    fetchFilters()
  }, [])

  // カードステータスを取得
  useEffect(() => {
    const fetchStatuses = async () => {
      const { data } = await supabase
        .from('card_sale_urls')
        .select('card_id, check_interval, error_count, last_checked_at, auto_scrape_mode, auto_scrape_interval_minutes, last_scraped_at, last_scrape_status, last_scrape_error, product_url')

      const statusMap: Record<string, any> = {}
      data?.forEach(url => {
        const isSnkrdunk = url.product_url?.includes('snkrdunk.com')
        const existing = statusMap[url.card_id]
        // 価格監視情報
        if (!existing || url.error_count > 0) {
          statusMap[url.card_id] = {
            ...existing,
            interval: url.check_interval || 180,
            hasError: url.error_count > 0,
            lastChecked: url.last_checked_at
          }
        }
        // スニダン売買履歴情報
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

  // 検索・フィルタ・ページネーション（復元完了後にのみ実行）
  useEffect(() => {
    if (!filtersHydrated) return

    const fetchFilteredCards = async () => {
      setIsLoading(true)

      let query = supabase
        .from('cards')
        .select(`*, category_large:category_large_id(name, icon), rarities:rarity_id(name)`, { count: 'exact' })

      // 検索条件
      if (searchQuery.length >= 2) {
        query = query.or(buildKanaSearchFilter(searchQuery, ['name', 'card_number']))
      }

      // ゲーム（カテゴリ大）
      if (filterCategoryLarge === UNSET) {
        query = query.is('category_large_id', null)
      } else if (filterCategoryLarge) {
        query = query.eq('category_large_id', filterCategoryLarge)
      }

      // セットコード
      if (filterSetCode === UNSET) {
        query = query.is('set_code', null)
      } else if (filterSetCode) {
        query = query.eq('set_code', filterSetCode)
      }

      // レアリティ
      if (filterRarity === UNSET) {
        query = query.is('rarity_id', null)
      } else if (filterRarity) {
        query = query.eq('rarity_id', filterRarity)
      }

      // 収録弾
      if (filterExpansion === UNSET) {
        query = query.is('expansion', null)
      } else if (filterExpansion) {
        query = query.eq('expansion', filterExpansion)
      }

      // 型番フィルタ
      if (filterCardNumber === UNSET) {
        query = query.or('card_number.is.null,card_number.eq.')
      } else if (filterCardNumber === '__DUPLICATE__') {
        // 重複カード: image_urlが同じカードを取得
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
            // 重複なし
            setFilteredCards([])
            setTotalCount(0)
            setIsLoading(false)
            return
          }
        }
      } else if (filterCardNumber) {
        query = query.ilike('card_number', `%${filterCardNumber}%`)
      }

      // ページネーション
      const from = (currentPage - 1) * ITEMS_PER_PAGE
      const to = from + ITEMS_PER_PAGE - 1

      const { data, count, error } = await query
        .order('created_at', { ascending: false })
        .range(from, to)

      if (!error) {
        setFilteredCards(data || [])
        setTotalCount(count || 0)
      }
      setIsLoading(false)
    }

    const timer = setTimeout(fetchFilteredCards, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, filterCategoryLarge, filterSetCode, filterRarity, filterExpansion, filterCardNumber, currentPage, refreshKey, filtersHydrated])

  // フィルタ変更時は1ページ目に戻る（sessionStorage復元時はスキップ）
  const filterChangeCount = useRef(0)
  useEffect(() => {
    if (!filtersHydrated) return
    // 初回（復元直後）はスキップ
    filterChangeCount.current++
    if (filterChangeCount.current <= 1) return
    setCurrentPage(1)
    setSelectedIds(new Set())
  }, [searchQuery, filterCategoryLarge, filterSetCode, filterRarity, filterExpansion, filterCardNumber, filtersHydrated])

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
    // 値があるフィールドだけ送信
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
        alert(`✅ ${json.updated}件のカードを更新しました`)
        setShowBatchModal(false)
        setShowConfirm(false)
        setSelectedIds(new Set())
        // フィルタを保持したままリフェッチ
        setRefreshKey(k => k + 1)
      } else {
        alert(`❌ エラー: ${json.error}`)
      }
    } catch (err: any) {
      alert(`❌ エラー: ${err.message}`)
    } finally {
      setBatchLoading(false)
    }
  }

  // 変更内容のラベルを取得
  const getBatchChangeLabel = () => {
    const labels: string[] = []
    if (batchUpdates.category_large_id !== undefined) {
      const cat = categories.find(c => c.id === batchUpdates.category_large_id)
      labels.push(`ゲーム → ${cat?.name || '（クリア）'}`)
    }
    if (batchUpdates.rarity_id !== undefined) {
      const r = batchRarities.find(r => r.id === batchUpdates.rarity_id)
      labels.push(`レアリティ → ${r?.name || '（クリア）'}`)
    }
    return labels
  }

  // =============================================================================
  // Helpers
  // =============================================================================

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

  const formatIntervalLabel = (minutes: number) => {
    if (minutes >= 1440) return `${Math.floor(minutes / 1440)}日`
    if (minutes >= 60) return `${Math.floor(minutes / 60)}h`
    return `${minutes}分`
  }

  const formatRelTime = (dateStr: string | null) => {
    if (!dateStr) return null
    const diffMs = Date.now() - new Date(dateStr).getTime()
    const diffMins = Math.floor(diffMs / 60000)
    if (diffMins < 60) return `${diffMins}分前`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}h前`
    return `${Math.floor(diffHours / 24)}日前`
  }

  const getStatusBadge = (cardId: string) => {
    const status = cardStatuses[cardId]
    if (!status) return <span className="text-xs text-gray-400">−</span>

    return (
      <div className="flex flex-col items-center gap-0.5">
        {/* 価格監視 */}
        {status.hasError ? (
          <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded">🔴 エラー</span>
        ) : (
          <span className={`px-2 py-0.5 text-xs rounded ${status.interval <= 180 ? 'bg-green-100 text-green-700' :
            status.interval <= 720 ? 'bg-yellow-100 text-yellow-700' :
              'bg-gray-100 text-gray-600'
            }`}>💰 {formatIntervalLabel(status.interval)}</span>
        )}
        {/* スニダン売買 */}
        {status.snkrdunk && (
          <span className={`px-2 py-0.5 text-xs rounded ${status.snkrdunk.status === 'error' ? 'bg-red-100 text-red-700' :
            status.snkrdunk.mode === 'off' ? 'bg-gray-100 text-gray-400' :
              'bg-blue-100 text-blue-700'
            }`}>
            📊 {status.snkrdunk.mode === 'off' ? '停止' :
              status.snkrdunk.status === 'error' ? 'エラー' :
                formatRelTime(status.snkrdunk.lastScraped) || '未取得'}
          </span>
        )}
      </div>
    )
  }

  // フィルタ用レアリティ（カテゴリで絞り込み）
  const filteredRarities = filterCategoryLarge && filterCategoryLarge !== UNSET
    ? rarities.filter(r => r.large_id === filterCategoryLarge)
    : rarities

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <div className="p-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        {/* ヘッダー */}
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800">カード一覧</h2>
            <div className="flex gap-2">
              {selectedIds.size > 0 && (
                <button
                  onClick={openBatchModal}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center gap-2"
                >
                  <Settings size={18} /> 一括設定 ({selectedIds.size}件)
                </button>
              )}
              <button
                onClick={onImportCards}
                className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 flex items-center gap-2"
              >
                <Globe size={18} /> 公式からインポート
              </button>
              <button
                onClick={onPriceChartingImport}
                className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 flex items-center gap-2"
              >
                <Globe size={18} /> PC Import
              </button>
              <button
                onClick={onAddCard}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
              >
                <Plus size={18} /> カード追加
              </button>
            </div>
          </div>

          {/* 検索 */}
          <div className="flex gap-3 items-center mb-3">
            <div className="relative flex-1 max-w-md">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="カード名・型番で検索（2文字以上）"
                className="w-full pl-10 pr-4 py-2 border rounded-lg"
              />
            </div>
            <span className="text-sm text-gray-500">
              {totalCount}件中 {Math.min((currentPage - 1) * ITEMS_PER_PAGE + 1, totalCount)}-{Math.min(currentPage * ITEMS_PER_PAGE, totalCount)}件
            </span>
          </div>

          {/* フィルタ行 */}
          <div className="flex gap-2 flex-wrap items-center">
            {/* ゲーム */}
            <select
              value={filterCategoryLarge}
              onChange={(e) => setFilterCategoryLarge(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm"
            >
              <option value="">全ゲーム</option>
              <option value={UNSET}>⚠️ 未設定</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
              ))}
            </select>

            {/* セットコード */}
            <select
              value={filterSetCode}
              onChange={(e) => setFilterSetCode(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm"
            >
              <option value="">全セット</option>
              <option value={UNSET}>⚠️ 未設定</option>
              {setCodes.map(code => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>

            {/* レアリティ */}
            <select
              value={filterRarity}
              onChange={(e) => setFilterRarity(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm"
            >
              <option value="">全レアリティ</option>
              <option value={UNSET}>⚠️ 未設定</option>
              {filteredRarities.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>

            {/* 収録弾 */}
            <select
              value={filterExpansion}
              onChange={(e) => setFilterExpansion(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm"
            >
              <option value="">全収録弾</option>
              <option value={UNSET}>⚠️ 未設定</option>
              {expansions.map(exp => (
                <option key={exp} value={exp}>{exp}</option>
              ))}
            </select>

            {/* 型番フィルタ */}
            <select
              value={filterCardNumber}
              onChange={(e) => setFilterCardNumber(e.target.value)}
              className="px-3 py-1.5 border rounded-lg text-sm"
            >
              <option value="">全型番</option>
              <option value={UNSET}>⚠️ 未登録</option>
              <option value="__DUPLICATE__">🔁 重複</option>
            </select>

            {/* 選択数 */}
            {selectedIds.size > 0 && (
              <span className="text-sm font-medium text-orange-600 ml-2">
                ✓ {selectedIds.size}件選択中
              </span>
            )}

            {/* フィルタリセット */}
            {(searchQuery || filterCategoryLarge || filterSetCode || filterRarity || filterExpansion || filterCardNumber) && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setFilterCategoryLarge('')
                  setFilterSetCode('')
                  setFilterRarity('')
                  setFilterExpansion('')
                  setFilterCardNumber('')
                  setCurrentPage(1)
                }}
                className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 border border-red-200 rounded-lg flex items-center gap-1"
              >
                × リセット
              </button>
            )}
          </div>
        </div>

        {/* テーブル */}
        {isLoading ? (
          <div className="p-8 text-center">
            <RefreshCw className="animate-spin mx-auto text-gray-400" size={32} />
          </div>
        ) : filteredCards.length > 0 ? (
          <div className="overflow-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 w-10">
                    <button onClick={toggleSelectAll} className="text-gray-500 hover:text-gray-800">
                      {isAllSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">画像</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">カード名</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">サイト</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 min-w-[220px]">URL追加</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">ゲーム</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">セット</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">収録弾</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">レアリティ</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">型番</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">監視</th>
                  <th className="text-center px-3 py-3 text-xs font-medium text-gray-500">シンソク</th>
                  <th className="text-center px-3 py-3 text-xs font-medium text-gray-500">ラウンジ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredCards.map((card) => (
                  <tr
                    key={card.id}
                    className={`hover:bg-gray-50 cursor-pointer ${selectedIds.has(card.id) ? 'bg-orange-50' : ''}`}
                  >
                    <td className="px-3 py-2" onClick={(e) => { e.stopPropagation(); toggleSelect(card.id) }}>
                      {selectedIds.has(card.id)
                        ? <CheckSquare size={18} className="text-orange-500" />
                        : <Square size={18} className="text-gray-300" />
                      }
                    </td>
                    <td className="px-4 py-2" onClick={() => window.open(`/cards/${card.id}`, '_blank')}>
                      {card.image_url ? (
                        <img
                          src={card.image_url}
                          alt={card.name}
                          className="w-12 h-auto max-h-20 object-contain rounded cursor-pointer"
                          onMouseEnter={e => {
                            const rect = e.currentTarget.getBoundingClientRect()
                            setHoveredImage({ url: card.image_url!, x: rect.right + 8, y: rect.top })
                          }}
                          onMouseLeave={() => setHoveredImage(null)}
                        />
                      ) : (
                        <div className="w-12 h-16 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">No Image</div>
                      )}
                    </td>
                    <td className="px-4 py-2 font-medium text-gray-800" onClick={() => window.open(`/cards/${card.id}`, '_blank')}>{card.name}</td>
                    <td className="px-4 py-2" onClick={() => window.open(`/cards/${card.id}`, '_blank')}>
                      <div className="flex gap-0.5 flex-wrap">
                        {(cardSaleUrls[card.id] || []).map((u: any, i: number) => (
                          <span key={i} title={`${u.site?.name || '不明'}\n${u.product_url}`} className="cursor-default text-base">
                            {u.site?.icon || '🔗'}
                          </span>
                        ))}
                        {card.pricecharting_id && (
                          <span title="PriceCharting" className="cursor-default text-xs font-bold text-blue-600">PC</span>
                        )}
                        {card.justtcg_id && (
                          <span title="JustTCG" className="cursor-default text-xs font-bold text-emerald-600">JT</span>
                        )}
                        {!(cardSaleUrls[card.id]?.length) && !card.pricecharting_id && !card.justtcg_id && <span className="text-gray-300 text-xs">−</span>}
                      </div>
                    </td>
                    <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-1">
                        <input
                          type="url"
                          value={inlineUrlInputs[card.id] || ''}
                          onChange={(e) => setInlineUrlInputs(prev => ({ ...prev, [card.id]: e.target.value }))}
                          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleInlineUrlSave(card.id) } }}
                          placeholder="https://..."
                          className={`w-40 px-2 py-1 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 ${inlineUrlError[card.id] ? 'border-red-300 bg-red-50' : inlineUrlSuccess[card.id] ? 'border-green-300 bg-green-50' : 'border-gray-200'
                            }`}
                        />
                        {inlineUrlSaving[card.id] ? (
                          <Loader2 size={14} className="animate-spin text-blue-400" />
                        ) : inlineUrlSuccess[card.id] ? (
                          <Check size={14} className="text-green-500" />
                        ) : (
                          <button
                            onClick={() => handleInlineUrlSave(card.id)}
                            disabled={!inlineUrlInputs[card.id]?.trim()}
                            className="p-1 text-blue-500 hover:bg-blue-50 rounded disabled:opacity-30"
                            title="保存"
                          >
                            <Link size={14} />
                          </button>
                        )}
                      </div>
                      {inlineUrlError[card.id] && (
                        <p className="text-red-500 text-[10px] mt-0.5">{inlineUrlError[card.id]}</p>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600" onClick={() => window.open(`/cards/${card.id}`, '_blank')}>
                      {card.category_large ? `${card.category_large.icon} ${card.category_large.name}` : <span className="text-gray-300">−</span>}
                    </td>
                    <td className="px-4 py-2" onClick={() => window.open(`/cards/${card.id}`, '_blank')}>
                      {card.set_code ? (
                        <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-mono font-medium">{card.set_code}</span>
                      ) : (
                        <span className="text-gray-300 text-sm">−</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600" onClick={() => window.open(`/cards/${card.id}`, '_blank')}>
                      {card.expansion || <span className="text-gray-300">−</span>}
                    </td>
                    <td className="px-4 py-2" onClick={() => window.open(`/cards/${card.id}`, '_blank')}>
                      {card.rarities?.name ? (
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                          {card.rarities.name}
                        </span>
                      ) : (
                        <span className="text-gray-300 text-sm">−</span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600" onClick={() => window.open(`/cards/${card.id}`, '_blank')}>{card.card_number || '−'}</td>
                    <td className="px-4 py-2 text-center" onClick={() => window.open(`/cards/${card.id}`, '_blank')}>{getStatusBadge(card.id)}</td>
                    <td className="px-3 py-2 text-center" onClick={() => window.open(`/cards/${card.id}`, '_blank')}>
                      {(cardPurchaseLinks[card.id] || []).some(s => s.includes('シンソク')) ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">✅</span>
                      ) : (
                        <span className="text-gray-300 text-sm">−</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center" onClick={() => window.open(`/cards/${card.id}`, '_blank')}>
                      {(cardPurchaseLinks[card.id] || []).some(s => s.includes('ラウンジ')) ? (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700">✅</span>
                      ) : (
                        <span className="text-gray-300 text-sm">−</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <Database size={48} className="mx-auto mb-4 text-gray-300" />
            <p>{searchQuery || filterCategoryLarge || filterSetCode || filterRarity || filterExpansion || filterCardNumber ? '条件に一致するカードがありません' : 'まだカードが登録されていません'}</p>
          </div>
        )}

        {/* ページネーション */}
        {totalPages > 1 && (
          <div className="p-4 border-t flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              className="px-2.5 py-1 border rounded hover:bg-gray-50 disabled:opacity-30 text-sm"
              title="最初のページ"
            >
              ⏮ 最初
            </button>
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-30 text-sm"
            >
              ← 前
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
                  className={`px-3 py-1 rounded text-sm ${currentPage === page ? 'bg-blue-500 text-white' : 'border hover:bg-gray-50'}`}
                >
                  {page}
                </button>
              )
            })}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-30 text-sm"
            >
              次 →
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-2.5 py-1 border rounded hover:bg-gray-50 disabled:opacity-30 text-sm"
              title="最後のページ"
            >
              最後 ⏭
            </button>
            <span className="text-xs text-gray-400 mx-1">|</span>
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
                className="w-20 px-2 py-1 border rounded text-sm text-center focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <button
                onClick={() => {
                  const p = parseInt(pageJumpInput)
                  if (!isNaN(p) && p >= 1 && p <= totalPages) {
                    setCurrentPage(p)
                    setPageJumpInput('')
                  }
                }}
                className="px-2 py-1 bg-blue-500 text-white rounded text-sm hover:bg-blue-600"
              >
                移動
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

      {/* ===================================================================== */}
      {/* 一括設定モーダル */}
      {/* ===================================================================== */}
      {showBatchModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowBatchModal(false)}>
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-bold mb-4">
              🔧 一括設定（{selectedIds.size}件）
            </h3>

            <div className="space-y-4">
              {/* ゲーム */}
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

              {/* レアリティ */}
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

            {/* アクションボタン */}
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

      {/* ===================================================================== */}
      {/* 確認ダイアログ */}
      {/* ===================================================================== */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-3 text-orange-600">
              ⚠️ 変更の確認
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
              ※ この操作は元に戻せません。内容をよく確認してください。
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
