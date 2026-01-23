'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { X, Trash2, Save, Loader2 } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Shop {
  id?: string
  name: string
  x_account: string
  icon?: string
  status?: string
}

interface Props {
  shop?: Shop | null  // 編集時は既存データ、新規時はnull
  onClose: () => void
  onSaved: () => void
}

export default function ShopForm({ shop, onClose, onSaved }: Props) {
  const [name, setName] = useState(shop?.name || '')
  const [xAccount, setXAccount] = useState(shop?.x_account || '')
  const [iconUrl, setIconUrl] = useState(shop?.icon || '')
  const [status, setStatus] = useState(shop?.status || 'active')
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [fetchingIcon, setFetchingIcon] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isEdit = !!shop?.id

  // Xアカウント変更時にアイコンを取得（unavatar.io使用）
  const fetchTwitterIcon = async (username: string) => {
    if (!username) {
      setIconUrl('')
      return
    }

    // @を除去
    const cleanUsername = username.replace('@', '')
    setFetchingIcon(true)

    // unavatar.io を使用（Twitter APIなしで取得可能）
    setIconUrl(`https://unavatar.io/twitter/${cleanUsername}`)
    setFetchingIcon(false)
  }

  // Xアカウント入力時にアイコン取得
  useEffect(() => {
    const timer = setTimeout(() => {
      if (xAccount && xAccount.length > 2) {
        fetchTwitterIcon(xAccount)
      }
    }, 500) // 500msのデバウンス

    return () => clearTimeout(timer)
  }, [xAccount])

  // 保存
  const handleSave = async () => {
    if (!name.trim()) {
      setError('店舗名を入力してください')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const cleanXAccount = xAccount.replace('@', '')
      
      const shopData = {
        name: name.trim(),
        x_account: cleanXAccount || null,
        icon: iconUrl || null,
        status,
      }

      if (isEdit) {
        // 更新
        const { error: updateError } = await supabase
          .from('purchase_shops')
          .update(shopData)
          .eq('id', shop.id)

        if (updateError) throw updateError
      } else {
        // 新規作成
        const { error: insertError } = await supabase
          .from('purchase_shops')
          .insert([shopData])

        if (insertError) throw insertError
      }

      onSaved()
      onClose()
    } catch (err: any) {
      setError(err.message || '保存に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  // 削除
  const handleDelete = async () => {
    if (!shop?.id) return
    
    const confirmed = window.confirm(`「${shop.name}」を削除しますか？\n関連する買取価格データも削除されます。`)
    if (!confirmed) return

    setDeleting(true)
    setError(null)

    try {
      // 関連する買取価格を先に削除
      await supabase
        .from('purchase_prices')
        .delete()
        .eq('shop_id', shop.id)

      // 店舗を削除
      const { error: deleteError } = await supabase
        .from('purchase_shops')
        .delete()
        .eq('id', shop.id)

      if (deleteError) throw deleteError

      onSaved()
      onClose()
    } catch (err: any) {
      setError(err.message || '削除に失敗しました')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-[500px] max-h-[90vh] overflow-auto">
        {/* ヘッダー */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">
            {isEdit ? '買取店舗を編集' : '買取店舗を追加'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* フォーム */}
        <div className="p-6 space-y-6">
          {/* アイコンプレビュー */}
          <div className="flex justify-center">
            <div className="relative">
              {iconUrl ? (
                <img
                  src={iconUrl}
                  alt="Shop icon"
                  className="w-24 h-24 rounded-full object-cover border-4 border-gray-100"
                  onError={() => setIconUrl('')}
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-gray-200 flex items-center justify-center text-gray-400">
                  <span className="text-3xl">🏪</span>
                </div>
              )}
              {fetchingIcon && (
                <div className="absolute inset-0 bg-white/80 rounded-full flex items-center justify-center">
                  <Loader2 size={24} className="animate-spin text-blue-500" />
                </div>
              )}
            </div>
          </div>

          {/* 店舗名 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              店舗名 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: Blue Rocket 秋葉原店"
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Xアカウント */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              X（Twitter）アカウント
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">@</span>
              <input
                type="text"
                value={xAccount.replace('@', '')}
                onChange={(e) => setXAccount(e.target.value.replace('@', ''))}
                placeholder="username"
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              アカウントを入力するとアイコンが自動取得されます
            </p>
          </div>

          {/* ステータス */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ステータス
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="active">アクティブ（監視中）</option>
              <option value="inactive">停止中</option>
            </select>
          </div>

          {/* エラー */}
          {error && (
            <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm">
              {error}
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="p-6 border-t border-gray-100 flex items-center justify-between">
          {isEdit ? (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2 disabled:opacity-50"
            >
              {deleting ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Trash2 size={18} />
              )}
              削除
            </button>
          ) : (
            <div />
          )}
          
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50"
            >
              キャンセル
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="px-6 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Save size={18} />
              )}
              {isEdit ? '更新' : '追加'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
