'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Plus, X, Edit, Trash2, RefreshCw, ChevronDown, ChevronRight, GripVertical } from 'lucide-react'

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
  const [modalType, setModalType] = useState('')
  const [editingItem, setEditingItem] = useState(null)
  const [parentId, setParentId] = useState(null)
  const [formData, setFormData] = useState({ name: '', icon: '' })

  // ドラッグ状態
  const [draggedItem, setDraggedItem] = useState(null)
  const [draggedType, setDraggedType] = useState('')

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

  const fetchSmallCategories = async (mediumId) => {
    const { data } = await supabase
      .from('category_small')
      .select('*')
      .eq('medium_id', mediumId)
      .order('sort_order')
    setSmallCategories(prev => ({ ...prev, [mediumId]: data || [] }))
  }

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

  const openModal = (type, item = null, pId = null) => {
    setModalType(type)
    setEditingItem(item)
    setParentId(pId)
    setFormData(item ? { name: item.name, icon: item.icon || '' } : { name: '', icon: '' })
    setShowModal(true)
  }

  // 保存
  const handleSave = async () => {
    let table = ''
    let insertData: any = { name: formData.name }

    switch (modalType) {
      case 'large':
        table = 'category_large'
        insertData.icon = formData.icon
        // 新規追加時は最後に追加
        if (!editingItem) {
          insertData.sort_order = largeCategories.length
        }
        break
      case 'medium':
        table = 'category_medium'
        insertData.large_id = parentId
        if (!editingItem) {
          insertData.sort_order = (mediumCategories[parentId] || []).length
        }
        break
      case 'small':
        table = 'category_small'
        insertData.medium_id = parentId
        if (!editingItem) {
          insertData.sort_order = (smallCategories[parentId] || []).length
        }
        break
      case 'rarity':
        table = 'rarities'
        insertData.large_id = parentId
        if (!editingItem) {
          insertData.sort_order = (rarities[parentId] || []).length
        }
        break
    }

    try {
      if (editingItem) {
        const updateData: any = { name: formData.name }
        if (modalType === 'large') updateData.icon = formData.icon
        
        const { error } = await supabase.from(table).update(updateData).eq('id', editingItem.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from(table).insert([insertData])
        if (error) throw error
      }

      setShowModal(false)
      
      if (modalType === 'large') {
        fetchLargeCategories()
      } else if (modalType === 'medium' || modalType === 'rarity') {
        fetchMediumAndRarities(parentId)
      } else if (modalType === 'small') {
        fetchSmallCategories(parentId)
      }
    } catch (err: any) {
      console.error('Save error:', err)
      alert('保存に失敗しました: ' + err.message)
    }
  }

  // 削除
  const handleDelete = async (type, id, parentIdVal = null) => {
    if (!confirm('削除しますか？関連するデータも削除される可能性があります。')) return

    const table = type === 'large' ? 'category_large' : type === 'medium' ? 'category_medium' : type === 'small' ? 'category_small' : 'rarities'
    
    try {
      const { error } = await supabase.from(table).delete().eq('id', id)
      if (error) throw error

      if (type === 'large') {
        fetchLargeCategories()
      } else if (type === 'medium' || type === 'rarity') {
        fetchMediumAndRarities(parentIdVal)
      } else if (type === 'small') {
        fetchSmallCategories(parentIdVal)
      }
    } catch (err: any) {
      console.error('Delete error:', err)
      alert('削除に失敗しました: ' + err.message)
    }
  }

  // ドラッグ&ドロップで並び替え
  const handleDragStart = (e, item, type, parentIdVal = null) => {
    setDraggedItem({ ...item, parentId: parentIdVal })
    setDraggedType(type)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = async (e, targetItem, type, parentIdVal = null) => {
    e.preventDefault()
    
    if (!draggedItem || draggedType !== type) return
    if (draggedItem.id === targetItem.id) return
    if (draggedItem.parentId !== parentIdVal) return // 同じ親内でのみ移動可能

    let items = []
    let table = ''
    
    switch (type) {
      case 'large':
        items = [...largeCategories]
        table = 'category_large'
        break
      case 'medium':
        items = [...(mediumCategories[parentIdVal] || [])]
        table = 'category_medium'
        break
      case 'small':
        items = [...(smallCategories[parentIdVal] || [])]
        table = 'category_small'
        break
      case 'rarity':
        items = [...(rarities[parentIdVal] || [])]
        table = 'rarities'
        break
    }

    const draggedIndex = items.findIndex(i => i.id === draggedItem.id)
    const targetIndex = items.findIndex(i => i.id === targetItem.id)
    
    // 並び替え
    const [removed] = items.splice(draggedIndex, 1)
    items.splice(targetIndex, 0, removed)

    // 即座にUIを更新
    if (type === 'large') {
      setLargeCategories(items)
    } else if (type === 'medium') {
      setMediumCategories(prev => ({ ...prev, [parentIdVal]: items }))
    } else if (type === 'small') {
      setSmallCategories(prev => ({ ...prev, [parentIdVal]: items }))
    } else if (type === 'rarity') {
      setRarities(prev => ({ ...prev, [parentIdVal]: items }))
    }

    // DBを更新
    try {
      for (let i = 0; i < items.length; i++) {
        await supabase.from(table).update({ sort_order: i }).eq('id', items[i].id)
      }
    } catch (err) {
      console.error('Sort update error:', err)
    }

    setDraggedItem(null)
    setDraggedType('')
  }

  const handleDragEnd = () => {
    setDraggedItem(null)
    setDraggedType('')
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

      <p className="text-sm text-gray-500 mb-4">💡 ドラッグ&ドロップで並び順を変更できます</p>

      {loading ? (
        <div className="text-center py-12">
          <RefreshCw className="animate-spin mx-auto text-gray-400" size={32} />
        </div>
      ) : (
        <div className="space-y-4">
          {largeCategories.map((large: any) => (
            <div 
              key={large.id} 
              className={`bg-white rounded-xl shadow-sm border overflow-hidden ${
                draggedItem?.id === large.id && draggedType === 'large' ? 'opacity-50' : ''
              }`}
              draggable
              onDragStart={(e) => handleDragStart(e, large, 'large')}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, large, 'large')}
              onDragEnd={handleDragEnd}
            >
              {/* 大カテゴリヘッダー */}
              <div className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => toggleLarge(large.id)}>
                  <GripVertical size={18} className="text-gray-400 cursor-grab" />
                  {expandedLarge === large.id ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                  <span className="text-2xl">{large.icon}</span>
                  <span className="font-bold text-gray-800">{large.name}</span>
                </div>
                <div className="flex items-center gap-2">
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
                        <div 
                          key={rarity.id} 
                          className={`flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-lg text-sm cursor-grab ${
                            draggedItem?.id === rarity.id && draggedType === 'rarity' ? 'opacity-50' : ''
                          }`}
                          draggable
                          onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, rarity, 'rarity', large.id); }}
                          onDragOver={handleDragOver}
                          onDrop={(e) => { e.stopPropagation(); handleDrop(e, rarity, 'rarity', large.id); }}
                          onDragEnd={handleDragEnd}
                        >
                          <GripVertical size={12} className="text-purple-400" />
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
                        <div 
                          key={medium.id} 
                          className={`bg-white rounded-lg border border-gray-200 ${
                            draggedItem?.id === medium.id && draggedType === 'medium' ? 'opacity-50' : ''
                          }`}
                          draggable
                          onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, medium, 'medium', large.id); }}
                          onDragOver={handleDragOver}
                          onDrop={(e) => { e.stopPropagation(); handleDrop(e, medium, 'medium', large.id); }}
                          onDragEnd={handleDragEnd}
                        >
                          <div className="p-3 flex items-center justify-between cursor-pointer hover:bg-gray-50">
                            <div className="flex items-center gap-2 flex-1" onClick={() => toggleMedium(medium.id)}>
                              <GripVertical size={16} className="text-gray-400 cursor-grab" />
                              {expandedMedium === medium.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                              <span className="text-gray-800">{medium.name}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <button onClick={() => openModal('medium', medium, large.id)} className="p-1 hover:bg-blue-100 rounded text-blue-600">
                                <Edit size={14} />
                              </button>
                              <button onClick={() => handleDelete('medium', medium.id, large.id)} className="p-1 hover:bg-red-100 rounded text-red-600">
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>

                          {/* 小カテゴリ */}
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
                                  <div 
                                    key={small.id} 
                                    className={`flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs cursor-grab ${
                                      draggedItem?.id === small.id && draggedType === 'small' ? 'opacity-50' : ''
                                    }`}
                                    draggable
                                    onDragStart={(e) => { e.stopPropagation(); handleDragStart(e, small, 'small', medium.id); }}
                                    onDragOver={handleDragOver}
                                    onDrop={(e) => { e.stopPropagation(); handleDrop(e, small, 'small', medium.id); }}
                                    onDragEnd={handleDragEnd}
                                  >
                                    <GripVertical size={10} className="text-orange-400" />
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
                  autoFocus
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
