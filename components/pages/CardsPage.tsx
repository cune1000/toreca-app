'use client'

import React, { useState, useEffect } from 'react'
import { Database, Search, RefreshCw, Plus, Cpu, Globe } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import type { CardWithRelations, CategoryLarge, Rarity } from '@/lib/types'

// =============================================================================
// Types
// =============================================================================

interface Props {
  onAddCard: () => void
  onImportCards: () => void
  onAIRecognition: () => void
  onSelectCard: (card: CardWithRelations) => void
}

// =============================================================================
// Component
// =============================================================================

export default function CardsPage({ 
  onAddCard, 
  onImportCards, 
  onAIRecognition, 
  onSelectCard 
}: Props) {
  // State
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState('')
  const [filterRarity, setFilterRarity] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [filteredCards, setFilteredCards] = useState<CardWithRelations[]>([])
  const [categories, setCategories] = useState<CategoryLarge[]>([])
  const [rarities, setRarities] = useState<Rarity[]>([])
  const [cardStatuses, setCardStatuses] = useState<Record<string, any>>({})
  const [isLoading, setIsLoading] = useState(false)
  
  const ITEMS_PER_PAGE = 50

  // =============================================================================
  // Data Fetching
  // =============================================================================

  // カテゴリとレアリティを取得
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
    }
    fetchFilters()
  }, [])

  // カードステータスを取得
  useEffect(() => {
    const fetchStatuses = async () => {
      const { data } = await supabase
        .from('card_sale_urls')
        .select('card_id, check_interval, error_count, last_checked_at')
      
      const statusMap: Record<string, any> = {}
      data?.forEach(url => {
        statusMap[url.card_id] = {
          interval: url.check_interval || 30,
          hasError: url.error_count > 0,
          lastChecked: url.last_checked_at
        }
      })
      setCardStatuses(statusMap)
    }
    fetchStatuses()
  }, [])

  // 検索・フィルタ・ページネーション
  useEffect(() => {
    const fetchFilteredCards = async () => {
      setIsLoading(true)
      
      let query = supabase
        .from('cards')
        .select(`*, category_large:category_large_id(name, icon), rarity:rarity_id(name)`, { count: 'exact' })
      
      // 検索条件
      if (searchQuery.length >= 2) {
        query = query.or(`name.ilike.%${searchQuery}%,card_number.ilike.%${searchQuery}%`)
      }
      if (filterCategory) {
        query = query.eq('category_large_id', filterCategory)
      }
      if (filterRarity) {
        query = query.eq('rarity_id', filterRarity)
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
  }, [searchQuery, filterCategory, filterRarity, currentPage])

  // フィルタ変更時は1ページ目に戻る
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filterCategory, filterRarity])

  // =============================================================================
  // Helpers
  // =============================================================================

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)

  const getStatusBadge = (cardId: string) => {
    const status = cardStatuses[cardId]
    if (!status) return <span className="text-xs text-gray-400">−</span>
    if (status.hasError) return <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded">🔴 エラー</span>
    if (status.interval <= 30) return <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">🟢 30分</span>
    if (status.interval <= 180) return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded">🟡 {status.interval}分</span>
    return <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">⚪ {status.interval >= 1440 ? '24h' : `${status.interval/60}h`}</span>
  }

  // フィルタ用レアリティ（カテゴリで絞り込み）
  const filteredRarities = filterCategory 
    ? rarities.filter(r => r.large_id === filterCategory)
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
              <button 
                onClick={onImportCards} 
                className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 flex items-center gap-2"
              >
                <Globe size={18} /> 公式からインポート
              </button>
              <button 
                onClick={onAIRecognition} 
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 flex items-center gap-2"
              >
                <Cpu size={18} /> AI認識
              </button>
              <button 
                onClick={onAddCard} 
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
              >
                <Plus size={18} /> カード追加
              </button>
            </div>
          </div>
          
          {/* 検索・フィルタ */}
          <div className="flex gap-3 items-center">
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
            <select
              value={filterCategory}
              onChange={(e) => { setFilterCategory(e.target.value); setFilterRarity(''); }}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="">全カテゴリ</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
              ))}
            </select>
            <select
              value={filterRarity}
              onChange={(e) => setFilterRarity(e.target.value)}
              className="px-3 py-2 border rounded-lg"
            >
              <option value="">全レアリティ</option>
              {filteredRarities.map(r => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
            <span className="text-sm text-gray-500">
              {totalCount}件中 {Math.min((currentPage-1)*ITEMS_PER_PAGE+1, totalCount)}-{Math.min(currentPage*ITEMS_PER_PAGE, totalCount)}件
            </span>
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
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">画像</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">カード名</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">カテゴリ</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">レアリティ</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">型番</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">監視</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">登録日</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredCards.map((card) => (
                  <tr 
                    key={card.id} 
                    className="hover:bg-gray-50 cursor-pointer" 
                    onClick={() => onSelectCard(card)}
                  >
                    <td className="px-4 py-2">
                      {card.image_url ? (
                        <img src={card.image_url} alt={card.name} className="w-12 h-16 object-cover rounded" />
                      ) : (
                        <div className="w-12 h-16 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">No Image</div>
                      )}
                    </td>
                    <td className="px-4 py-2 font-medium text-gray-800">{card.name}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {card.category_large?.icon} {card.category_large?.name || '-'}
                    </td>
                    <td className="px-4 py-2">
                      {card.rarities?.name && (
                        <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                          {card.rarities.name}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-600">{card.card_number || '-'}</td>
                    <td className="px-4 py-2 text-center">{getStatusBadge(card.id)}</td>
                    <td className="px-4 py-2 text-right text-sm text-gray-500">
                      {card.created_at ? new Date(card.created_at).toLocaleDateString('ja-JP') : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <Database size={48} className="mx-auto mb-4 text-gray-300" />
            <p>{searchQuery || filterCategory || filterRarity ? '条件に一致するカードがありません' : 'まだカードが登録されていません'}</p>
          </div>
        )}
        
        {/* ページネーション */}
        {totalPages > 1 && (
          <div className="p-4 border-t flex items-center justify-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
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
                  className={`px-3 py-1 rounded ${currentPage === page ? 'bg-blue-500 text-white' : 'border hover:bg-gray-50'}`}
                >
                  {page}
                </button>
              )
            })}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
            >
              次 →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
