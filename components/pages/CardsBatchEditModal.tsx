'use client'

import React from 'react'
import { getRarityDisplayName } from '@/lib/rarity-mapping'
import type { CategoryLarge } from '@/lib/types'

interface CardsBatchEditModalProps {
  selectedCount: number
  categories: CategoryLarge[]
  rarityTexts: string[]
  batchUpdates: Record<string, string | null>
  setBatchUpdates: React.Dispatch<React.SetStateAction<Record<string, string | null>>>
  batchLoading: boolean
  showConfirm: boolean
  setShowConfirm: (show: boolean) => void
  onClose: () => void
  onExecute: () => void
  getBatchChangeLabel: () => string[]
}

export default function CardsBatchEditModal({
  selectedCount,
  categories,
  rarityTexts,
  batchUpdates,
  setBatchUpdates,
  batchLoading,
  showConfirm,
  setShowConfirm,
  onClose,
  onExecute,
  getBatchChangeLabel,
}: CardsBatchEditModalProps) {
  const handleBatchLargeChange = (value: string) => {
    setBatchUpdates({ category_large_id: value || null })
  }

  return (
    <>
      {/* 一括設定モーダル */}
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
          <h3 className="text-lg font-bold mb-4">
            一括設定（{selectedCount}件）
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">レアリティ</label>
              <select
                value={batchUpdates.rarity ?? ''}
                onChange={(e) => setBatchUpdates(prev => ({ ...prev, rarity: e.target.value || null }))}
                className="w-full border rounded-lg px-3 py-2"
              >
                <option value="">（変更しない）</option>
                {rarityTexts.map(r => (
                  <option key={r} value={r}>{getRarityDisplayName(r)}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button
              onClick={onClose}
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

      {/* 確認ダイアログ */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-3 text-orange-600">
              変更の確認
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              以下の変更を <strong>{selectedCount}件</strong> のカードに適用します：
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
                onClick={onExecute}
                disabled={batchLoading}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50"
              >
                {batchLoading ? '更新中...' : '実行する'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
