'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, X, Edit, Trash2, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react'

export default function CategoryManager() {
  const [largeCategories, setLargeCategories] = useState([])
  const [expandedLarge, setExpandedLarge] = useState(null)
  const [expandedMedium, setExpandedMedium] = useState(null)
  const [mediumCategories, setMediumCategories] = useState({})
  const [smallCategories, setSmallCategories] = useState({})
  const [rarities, setRarities] = useState({})
  const [loading, setLoading] = useState(true)
  
  // 編集モーダル
  const [showModal, setShowModal] = useState(false)
  const [modalType, setModalType] = useState('') // 'large', 'medium', 'small', 'rarity'
  const [editingItem, setEditingItem] = useState(null)
  const [parentId, setParentId] = useState(null)
  const [largeIdForRarity, setLargeIdForRarity] = useState(null)
  const [formData, setFormData] = useState({ name: '', icon: '', sort_order: 0 })

  // 大カテゴリ取得
  useEffect(() => {
    fetchLargeCategories()
  }, [])

  const fetchLargeCategories = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('category_large')
      .select('*')
      .order('sort_order')
    setLargeCategories(data || [])
    setLoading(false)
  }

  // 中カテゴリとレアリティを取得
  const fetchMediumAndRarities = async (largeId) => {
    const { data: mediumData } = await supabase
      .from('category_medium')
      .select('*')
      .eq('large_id', largeId)
      .order('sort_order')
    setMediumCategories(prev => ({ ...prev, [largeId]: mediumData || [] }))

    const { data: rarityData } = await supabase
      .from('rarities')
      .select('*')
      .eq('large_id', largeId)
      .order('sort_order')
    setRarities(prev => ({ ...prev, [largeId]: rarityData || [] }))
  }

  // 小カテゴリを取得
  const fetchSmallCategories = async (mediumId) => {
    const { data } = await supabase
      .from('category_small')
      .select('*')
      .eq('medium_id', mediumId)
      .order('sort_order')
    setSmallCategories(prev => ({ ...prev, [mediumId]: data || [] }))
  }

  // 大カテゴリを展開/閉じる
  const toggleLarge = (largeId) => {
    if (expandedLarge === largeId) {
      setExpandedLarge(null)
      setExpandedMedium(null)
    } else {
      setExpandedLarge(largeId)
      setExpandedMedium(null)
      if (!mediumCategories[largeId]) {
        fetchMediumAndRarities(largeId)
      }
    }
  }

  // 中カテゴリを展開/閉じる
  const toggleMedium = (mediumId) => {
    if (expandedMedium === mediumId) {
      setExpandedMedium(null)
    } else {
      setExpandedMedium(mediumId)
      if (!smallCategories[mediumId]) {
        fetchSmallCategories(mediumId)
      }
    }
  }

  // モーダルを開く
  const openModal = (type, item = null, pId = null, lId = null) => {
    setModalType(type)
    setEditingItem(item)
    setParentId(pId)
    setLargeIdForRarity(lId)
    setFormData(item ? { name: item.name, icon: item.icon || '', sort_order: item.sort_order || 0 } : { name: '', icon: '', sort_order: 0 })
    setShowModal(true)
  }

  // 保存
  const handleSave = async () => {
    let table = ''
    let insertData = { ...formData }

    switch (modalType) {
      case 'large':
        table = 'category_large'
        break
      case 'medium':
        table = 'category_medium'
        insertData.large_id = parentId
        break
      case 'small':
        table = 'category_small'
        insertData.medium_id = parentId
        break
      case 'rarity':
        table = 'rarities'
        insertData.large_id = parentId
        break
    }

    if (editingItem) {
      await supabase.from(table).update({ name: formData.name, icon: formData.icon, sort_order: formData.sort_order }).eq('id', editingItem.id)
    } else {
      await supabase.from(table).insert([insertData])
    }

    setShowModal(false)
    
    // データ再取得
    if (modalType === 'large') {
      fetchLargeCategories()
    } else if (modalType === 'medium' || modalType === 'rarity') {
      fetchMediumAndRarities(parentId)
    } else if (modalType === 'small') {
      fetchSmallCategories(parentId)
    }
  }

  // 削除
  const handleDelete = async (type, id, parentId = null) => {
    if (!confirm('削除しますか？')) return

    const table = type === 'large' ? 'category_large' : type === 'medium' ? 'category_medium' : type === 'small' ? 'category_small' : 'rarities'
    await supabase.from(table).delete().eq('id', id)

    if (type === 'large') {
      fetchLargeCategories()
    } else if (type === 'medium' || type === 'rarity') {
      fetchMediumAndRarities(parentId)
    } else if (type === 'small') {
      fetchSmallCategories(parentId)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">カテゴリ管理</h1>
        <button
          onClick={() => openModal('large')}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
        >
          <Plus size={18} />
          大カテゴリ追加
        </button>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <RefreshCw className="animate-spin mx-auto text-gray-400" size={32} />
        </div>
      ) : (
        <div className="space-y-4">
          {largeCategories.map((large: any) => (
            <div key={large.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {/* 大カテゴリヘッダー */}
              <div
                onClick={() => toggleLarge(large.id)}
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  {expandedLarge === large.id ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  <span className="text-2xl">{large.icon}</span>
                  <span className="font-bold text-gray-800">{large.name}</span>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => openModal('large', large)} className="p-2 hover:bg-blue-100 rounded-lg text-blue-600">
                    <Edit size={16} />
                  </button>
                  <button onClick={() => handleDelete('large', large.id)} className="p-2 hover:bg-red-100 rounded-lg text-red-600">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* 展開時のコンテンツ */}
              {expandedLarge === large.id && (
                <div className="border-t border-gray-100 bg-gray-50">
                  {/* レアリティセクション */}
                  <div className="p-4 border-b border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-gray-700">レアリティ</h3>
                      <button
                        onClick={() => openModal('rarity', null, large.id)}
                        className="px-2 py-1 bg-purple-500 text-white rounded text-sm hover:bg-purple-600 flex items-center gap-1"
                      >
                        <Plus size={14} />
                        追加
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(rarities[large.id] || []).map((rarity: any) => (
                        <div key={rarity.id} className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-lg text-sm">
                          <span>{rarity.name}</span>
                          <button onClick={() => openModal('rarity', rarity, large.id)} className="p-0.5 hover:bg-purple-200 rounded">
                            <Edit size={12} />
                          </button>
                          <button onClick={() => handleDelete('rarity', rarity.id, large.id)} className="p-0.5 hover:bg-red-200 rounded text-red-600">
                            <Trash2 size={12} />
                          </button>
                        </div>
                      ))}
                      {(rarities[large.id] || []).length === 0 && <p className="text-sm text-gray-400">なし</p>}
                    </div>
                  </div>

                  {/* 中カテゴリセクション */}
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-medium text-gray-700">中カテゴリ（シリーズ）</h3>
                      <button
                        onClick={() => openModal('medium', null, large.id)}
                        className="px-2 py-1 bg-green-500 text-white rounded text-sm hover:bg-green-600 flex items-center gap-1"
                      >
                        <Plus size={14} />
                        追加
                      </button>
                    </div>
                    <div className="space-y-2">
                      {(mediumCategories[large.id] || []).map((medium: any) => (
                        <div key={medium.id} className="bg-white rounded-lg border border-gray-200">
                          {/* 中カテゴリヘッダー */}
                          <div
                            onClick={() => toggleMedium(medium.id)}
                            className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50"
                          >
                            <div className="flex items-center gap-2">
                              {expandedMedium === medium.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              <span className="text-gray-800">{medium.name}</span>
                            </div>
                            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <button onClick={() => openModal('medium', medium, large.id)} className="p-1 hover:bg-blue-100 rounded text-blue-600">
                                <Edit size={14} />
                              </button>
                              <button onClick={() => handleDelete('medium', medium.id, large.id)} className="p-1 hover:bg-red-100 rounded text-red-600">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          {/* 小カテゴリ（展開時） */}
                          {expandedMedium === medium.id && (
                            <div className="border-t border-gray-100 p-3 bg-gray-50">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium text-gray-600">小カテゴリ（拡張パック）</span>
                                <button
                                  onClick={() => openModal('small', null, medium.id)}
                                  className="px-2 py-0.5 bg-orange-500 text-white rounded text-xs hover:bg-orange-600 flex items-center gap-1"
                                >
                                  <Plus size={12} />
                                  追加
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {(smallCategories[medium.id] || []).map((small: any) => (
                                  <div key={small.id} className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs">
                                    <span>{small.name}</span>
                                    <button onClick={() => openModal('small', small, medium.id)} className="p-0.5 hover:bg-orange-200 rounded">
                                      <Edit size={10} />
                                    </button>
                                    <button onClick={() => handleDelete('small', small.id, medium.id)} className="p-0.5 hover:bg-red-200 rounded text-red-600">
                                      <Trash2 size={10} />
                                    </button>
                                  </div>
                                ))}
                                {(smallCategories[medium.id] || []).length === 0 && (
                                  <p className="text-xs text-gray-400">なし</p>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      {(mediumCategories[large.id] || []).length === 0 && (
                        <p className="text-sm text-gray-400 text-center py-2">中カテゴリがありません</p>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 編集モーダル */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl w-[400px] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-800">
                {editingItem ? '編集' : '追加'} - {
                  modalType === 'large' ? '大カテゴリ' : 
                  modalType === 'medium' ? '中カテゴリ' : 
                  modalType === 'small' ? '小カテゴリ' : 'レアリティ'
                }
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">名前</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {modalType === 'large' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">アイコン（絵文字）</label>
                  <input
                    type="text"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    placeholder="⚡"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">並び順</label>
                <input
                  type="number"
                  value={formData.sort_order}
                  onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                キャンセル
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.name}
                className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
