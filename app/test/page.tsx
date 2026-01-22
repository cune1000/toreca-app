'use client'

import { useState } from 'react'
import DashboardContent from '@/components/DashboardContent'
import CardForm from '@/components/CardForm'
import ShopForm from '@/components/ShopForm'
import { Plus, Database, Store } from 'lucide-react'

export default function TestPage() {
  const [showCardForm, setShowCardForm] = useState(false)
  const [showShopForm, setShowShopForm] = useState(false)
  const [refresh, setRefresh] = useState(0)

  return (
    <div style={{ backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      <div className="p-4 bg-white border-b flex justify-between items-center">
        <h1 className="text-xl font-bold">DB接続テスト</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowCardForm(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
          >
            <Database size={18} />
            カード追加
          </button>
          <button
            onClick={() => setShowShopForm(true)}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2"
          >
            <Store size={18} />
            店舗追加
          </button>
        </div>
      </div>
      
      <DashboardContent key={refresh} />
      
      {showCardForm && (
        <CardForm
          onClose={() => setShowCardForm(false)}
          onSaved={() => setRefresh(r => r + 1)}
        />
      )}
      
      {showShopForm && (
        <ShopForm
          onClose={() => setShowShopForm(false)}
          onSaved={() => setRefresh(r => r + 1)}
        />
      )}
    </div>
  )
}