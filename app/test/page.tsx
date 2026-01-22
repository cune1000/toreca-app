'use client'

import { useState } from 'react'
import DashboardContent from '@/components/DashboardContent'
import CardForm from '@/components/CardForm'
import { Plus } from 'lucide-react'

export default function TestPage() {
  const [showForm, setShowForm] = useState(false)
  const [refresh, setRefresh] = useState(0)

  return (
    <div style={{ backgroundColor: '#f5f5f5', minHeight: '100vh' }}>
      <div className="p-4 bg-white border-b flex justify-between items-center">
        <h1 className="text-xl font-bold">DB接続テスト</h1>
        <button
          onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
        >
          <Plus size={18} />
          カード追加
        </button>
      </div>
      
      <DashboardContent key={refresh} />
      
      {showForm && (
        <CardForm
          onClose={() => setShowForm(false)}
          onSaved={() => setRefresh(r => r + 1)}
        />
      )}
    </div>
  )
}