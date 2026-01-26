'use client'

import React from 'react'
import { Store, Plus, Edit2 } from 'lucide-react'
import type { Shop } from '@/lib/types'

// =============================================================================
// Types
// =============================================================================

interface Props {
  shops: Shop[]
  onAddShop: () => void
  onEditShop: (shop: Shop, e: React.MouseEvent) => void
  onSelectShop: (shop: Shop) => void
}

// =============================================================================
// Component
// =============================================================================

export default function ShopsPage({ 
  shops, 
  onAddShop, 
  onEditShop, 
  onSelectShop 
}: Props) {
  return (
    <div className="p-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-800">買取店舗一覧</h2>
          <button
            onClick={onAddShop}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2"
          >
            <Plus size={18} />
            店舗追加
          </button>
        </div>
        
        {shops.length > 0 ? (
          <div className="divide-y divide-gray-50">
            {shops.map((shop) => (
              <div 
                key={shop.id} 
                className="p-4 flex items-center justify-between hover:bg-gray-50"
              >
                <div 
                  className="flex items-center gap-3 flex-1 cursor-pointer"
                  onClick={() => onSelectShop(shop)}
                >
                  {/* Xアイコン or デフォルトアイコン */}
                  {shop.icon ? (
                    <img 
                      src={shop.icon} 
                      alt={shop.name}
                      className="w-12 h-12 rounded-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://unavatar.io/twitter/${shop.x_account}`
                      }}
                    />
                  ) : shop.x_account ? (
                    <img 
                      src={`https://unavatar.io/twitter/${shop.x_account}`}
                      alt={shop.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                      <Store size={24} className="text-gray-400" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium text-gray-800">{shop.name}</p>
                    {shop.x_account && (
                      <p className="text-sm text-blue-500">@{shop.x_account}</p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  {shop.x_account && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                      X連携
                    </span>
                  )}
                  {/* 編集ボタン */}
                  <button
                    onClick={(e) => onEditShop(shop, e)}
                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <Edit2 size={16} className="text-gray-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <Store size={48} className="mx-auto mb-4 text-gray-300" />
            <p>まだ買取店舗が登録されていません</p>
            <button
              onClick={onAddShop}
              className="mt-4 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              最初の店舗を追加
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
