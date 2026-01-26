'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Eye, Clock, Inbox, X, Search } from 'lucide-react'
import { 
  getPendingImages, 
  getPendingCards, 
  updatePendingImageStatus,
  deletePendingImage,
  deletePendingCard,
  matchPendingCard,
  updatePendingCardPrice,
  savePendingCardsToPurchasePrices
} from '@/lib/api'
import { searchCards } from '@/lib/api/cards'
import type { PendingImage, PendingCard, Shop } from '@/lib/types'

// =============================================================================
// Types
// =============================================================================

interface Props {
  shops: Shop[]
  pendingImages: PendingImage[]
  onRefresh: () => void
  onProcessImage: (pending: PendingImage) => void
}

// =============================================================================
// Component
// =============================================================================

export default function PendingPage({ 
  shops, 
  pendingImages, 
  onRefresh,
  onProcessImage 
}: Props) {
  // State
  const [pendingCards, setPendingCards] = useState<PendingCard[]>([])
  const [activeTab, setActiveTab] = useState<'images' | 'cards'>('images')
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [editingCardId, setEditingCardId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // =============================================================================
  // Data Fetching
  // =============================================================================

  const fetchPendingCards = useCallback(async () => {
    const data = await getPendingCards('pending')
    // matchedも含める
    const matchedData = await getPendingCards('matched')
    setPendingCards([...data, ...matchedData])
  }, [])

  useEffect(() => {
    fetchPendingCards()
  }, [fetchPendingCards])

  // =============================================================================
  // Image Handlers
  // =============================================================================

  const handleProcessImage = async (pending: PendingImage) => {
    await updatePendingImageStatus(pending.id, 'processing')
    onProcessImage(pending)
  }

  const handleDeletePending = async (id: string) => {
    if (!confirm('この保留画像を削除しますか？')) return
    const success = await deletePendingImage(id)
    if (success) {
      onRefresh()
    }
  }

  // =============================================================================
  // Card Handlers
  // =============================================================================

  const handleSearch = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    const results = await searchCards(query, 10)
    setSearchResults(results.map(r => ({
      id: r.id,
      name: r.name,
      image_url: r.imageUrl
    })))
  }

  const handleMatchCard = async (pendingCardId: string, cardId: string) => {
    const success = await matchPendingCard(pendingCardId, cardId)
    if (success) {
      fetchPendingCards()
      setEditingCardId(null)
      setSearchQuery('')
      setSearchResults([])
    }
  }

  const handleDeletePendingCard = async (id: string) => {
    if (!confirm('この保留カードを削除しますか？')) return
    const success = await deletePendingCard(id)
    if (success) {
      fetchPendingCards()
    }
  }

  const handleSaveMatchedCards = async () => {
    const matchedCards = pendingCards.filter(c => c.status === 'matched' && c.matched_card_id && c.price)
    
    if (matchedCards.length === 0) {
      alert('保存できるカードがありません（価格が必要です）')
      return
    }

    setIsLoading(true)
    try {
      const { success, failed } = await savePendingCardsToPurchasePrices(matchedCards.map(c => c.id))
      
      if (success > 0) {
        alert(`${success}件を保存しました`)
        fetchPendingCards()
      } else if (failed > 0) {
        alert('保存に失敗しました')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleUpdatePrice = async (id: string, price: number) => {
    await updatePendingCardPrice(id, price)
    fetchPendingCards()
  }

  // =============================================================================
  // Helpers
  // =============================================================================

  const getShopName = (shopId: string) => {
    return shops.find(s => s.id === shopId)?.name || '不明な店舗'
  }

  const matchedCount = pendingCards.filter(c => c.status === 'matched').length

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <div className="p-6">
      {/* タブ */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setActiveTab('images')}
          className={`px-4 py-2 rounded-lg font-medium ${
            activeTab === 'images' 
              ? 'bg-purple-500 text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          📷 画像 ({pendingImages.length})
        </button>
        <button
          onClick={() => setActiveTab('cards')}
          className={`px-4 py-2 rounded-lg font-medium ${
            activeTab === 'cards' 
              ? 'bg-orange-500 text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          🃏 カード ({pendingCards.length})
        </button>
      </div>
      
      {/* 画像タブ */}
      {activeTab === 'images' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-800">保留画像一覧</h2>
            <span className="text-sm text-gray-500">{pendingImages.length}件</span>
          </div>
          
          {pendingImages.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {pendingImages.map((pending) => (
                <div key={pending.id} className="p-4 flex items-center gap-4 hover:bg-gray-50">
                  <div className="flex-shrink-0">
                    {pending.image_url ? (
                      <img
                        src={pending.image_url}
                        alt="保留画像"
                        className="w-24 h-24 object-cover rounded-lg border"
                      />
                    ) : pending.image_base64 ? (
                      <img
                        src={pending.image_base64}
                        alt="保留画像"
                        className="w-24 h-24 object-cover rounded-lg border"
                      />
                    ) : (
                      <div className="w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center">
                        <Inbox size={32} className="text-gray-400" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-800">
                        {pending.shop?.name || getShopName(pending.shop_id)}
                      </span>
                    </div>
                    
                    {pending.tweet_time && (
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Clock size={14} />
                        {new Date(pending.tweet_time).toLocaleString('ja-JP')}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleProcessImage(pending)}
                      className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 flex items-center gap-2"
                    >
                      <Eye size={18} />
                      認識
                    </button>
                    <button
                      onClick={() => handleDeletePending(pending.id)}
                      className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg"
                    >
                      削除
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-gray-500">
              <Inbox size={48} className="mx-auto mb-4 text-gray-300" />
              <p>保留中の画像はありません</p>
            </div>
          )}
        </div>
      )}
      
      {/* カードタブ */}
      {activeTab === 'cards' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-800">保留カード一覧</h2>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">{pendingCards.length}件</span>
              {matchedCount > 0 && (
                <button
                  onClick={handleSaveMatchedCards}
                  disabled={isLoading}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm disabled:opacity-50"
                >
                  {isLoading ? '保存中...' : 'マッチ済みを保存'}
                </button>
              )}
            </div>
          </div>
          
          {pendingCards.length > 0 ? (
            <div className="divide-y divide-gray-50">
              {pendingCards.map((card) => (
                <div 
                  key={card.id} 
                  className={`p-4 flex items-center gap-4 ${
                    card.status === 'matched' ? 'bg-green-50' : 'bg-orange-50'
                  }`}
                >
                  {/* カード画像 */}
                  <div className="flex-shrink-0">
                    {card.card_image ? (
                      <img
                        src={card.card_image}
                        alt="カード"
                        className="w-20 h-28 object-cover rounded border"
                      />
                    ) : (
                      <div className="w-20 h-28 bg-gray-200 rounded flex items-center justify-center">
                        <span className="text-gray-400">?</span>
                      </div>
                    )}
                    {card.ocr_text && (
                      <p className="text-xs text-gray-500 mt-1 truncate w-20">{card.ocr_text}</p>
                    )}
                  </div>
                  
                  {/* 情報 */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm text-gray-600">{getShopName(card.shop_id)}</span>
                      <span className={`px-2 py-0.5 text-xs rounded ${
                        card.status === 'matched' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-orange-100 text-orange-700'
                      }`}>
                        {card.status === 'matched' ? 'マッチ済み' : '未マッチ'}
                      </span>
                    </div>
                    
                    {/* マッチしたカード名を表示 */}
                    {card.matched_card && (
                      <p className="text-sm font-medium text-green-700 mb-2">
                        {card.matched_card.name}
                      </p>
                    )}
                    
                    {/* 検索・マッチング */}
                    {editingCardId === card.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => {
                            setSearchQuery(e.target.value)
                            handleSearch(e.target.value)
                          }}
                          placeholder="カード名を検索..."
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                          autoFocus
                        />
                        {searchResults.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {searchResults.map(result => (
                              <button
                                key={result.id}
                                onClick={() => handleMatchCard(card.id, result.id)}
                                className="flex items-center gap-2 px-2 py-1 border rounded hover:bg-blue-50"
                              >
                                {result.image_url && (
                                  <img src={result.image_url} alt="" className="w-8 h-10 object-cover rounded" />
                                )}
                                <span className="text-xs">{result.name}</span>
                              </button>
                            ))}
                          </div>
                        )}
                        <button
                          onClick={() => {
                            setEditingCardId(null)
                            setSearchQuery('')
                            setSearchResults([])
                          }}
                          className="text-xs text-gray-500 hover:underline"
                        >
                          キャンセル
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingCardId(card.id)}
                        className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                      >
                        <Search size={14} className="inline mr-1" />
                        カード検索
                      </button>
                    )}
                    
                    {/* 価格 */}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-sm">¥</span>
                      <input
                        type="number"
                        value={card.price || ''}
                        onChange={(e) => handleUpdatePrice(card.id, parseInt(e.target.value) || 0)}
                        className="w-28 px-2 py-1 border rounded text-right text-sm"
                      />
                    </div>
                  </div>
                  
                  {/* 削除 */}
                  <button
                    onClick={() => handleDeletePendingCard(card.id)}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                  >
                    <X size={18} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-12 text-center text-gray-500">
              <Inbox size={48} className="mx-auto mb-4 text-gray-300" />
              <p>保留中のカードはありません</p>
              <p className="text-sm mt-2">認識画面で「保留に追加」すると追加されます</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
