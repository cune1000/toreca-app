'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { Upload, Plus, Trash2, Save, FolderOpen, Grid, Move, MousePointer, Play, X, RefreshCw } from 'lucide-react'

type CellType = 'card' | 'price' | 'exclude' | 'empty'

interface GridTemplate {
  name: string
  verticalLines: number[]   // % positions
  horizontalLines: number[] // % positions
  cells: CellType[][]       // [row][col]
}

export default function GridEditorPage() {
  // 画像
  const [image, setImage] = useState<string | null>(null)
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  
  // グリッド線（%で保存）
  const [verticalLines, setVerticalLines] = useState<number[]>([0, 100])
  const [horizontalLines, setHorizontalLines] = useState<number[]>([0, 100])
  
  // セルタイプ
  const [cells, setCells] = useState<CellType[][]>([])
  
  // 編集モード
  const [mode, setMode] = useState<'select' | 'move' | 'delete'>('select')
  const [cellType, setCellType] = useState<CellType>('card')
  
  // ドラッグ中の線
  const [dragging, setDragging] = useState<{ type: 'v' | 'h', index: number } | null>(null)
  
  // テンプレート名
  const [templateName, setTemplateName] = useState('新規テンプレート')
  
  // 画像読み込み
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        setImageSize({ width: img.width, height: img.height })
      }
      img.src = e.target?.result as string
      setImage(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }
  
  // 縦線追加
  const addVerticalLine = () => {
    const newLines = [...verticalLines]
    // 最後から2番目の位置に追加
    const lastLine = newLines[newLines.length - 1]
    const secondLastLine = newLines[newLines.length - 2]
    const newPos = (lastLine + secondLastLine) / 2
    newLines.splice(newLines.length - 1, 0, newPos)
    newLines.sort((a, b) => a - b)
    setVerticalLines(newLines)
    updateCells(newLines, horizontalLines)
  }
  
  // 横線追加
  const addHorizontalLine = () => {
    const newLines = [...horizontalLines]
    const lastLine = newLines[newLines.length - 1]
    const secondLastLine = newLines[newLines.length - 2]
    const newPos = (lastLine + secondLastLine) / 2
    newLines.splice(newLines.length - 1, 0, newPos)
    newLines.sort((a, b) => a - b)
    setHorizontalLines(newLines)
    updateCells(verticalLines, newLines)
  }
  
  // セル配列を更新
  const updateCells = (vLines: number[], hLines: number[]) => {
    const numRows = hLines.length - 1
    const numCols = vLines.length - 1
    
    const newCells: CellType[][] = []
    for (let r = 0; r < numRows; r++) {
      newCells[r] = []
      for (let c = 0; c < numCols; c++) {
        // 既存の値を保持、なければempty
        newCells[r][c] = cells[r]?.[c] || 'empty'
      }
    }
    setCells(newCells)
  }
  
  // 線のドラッグ開始
  const handleLineMouseDown = (type: 'v' | 'h', index: number, e: React.MouseEvent) => {
    if (mode !== 'move') return
    // 端の線は動かせない
    if (type === 'v' && (index === 0 || index === verticalLines.length - 1)) return
    if (type === 'h' && (index === 0 || index === horizontalLines.length - 1)) return
    
    e.preventDefault()
    setDragging({ type, index })
  }
  
  // 線のドラッグ
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!dragging || !containerRef.current) return
    
    const rect = containerRef.current.getBoundingClientRect()
    
    if (dragging.type === 'v') {
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const clamped = Math.max(1, Math.min(99, x))
      const newLines = [...verticalLines]
      newLines[dragging.index] = clamped
      newLines.sort((a, b) => a - b)
      // indexが変わる可能性があるので再検索
      const newIndex = newLines.indexOf(clamped)
      setDragging({ ...dragging, index: newIndex })
      setVerticalLines(newLines)
    } else {
      const y = ((e.clientY - rect.top) / rect.height) * 100
      const clamped = Math.max(1, Math.min(99, y))
      const newLines = [...horizontalLines]
      newLines[dragging.index] = clamped
      newLines.sort((a, b) => a - b)
      const newIndex = newLines.indexOf(clamped)
      setDragging({ ...dragging, index: newIndex })
      setHorizontalLines(newLines)
    }
  }, [dragging, verticalLines, horizontalLines])
  
  // ドラッグ終了
  const handleMouseUp = useCallback(() => {
    if (dragging) {
      setDragging(null)
      updateCells(verticalLines, horizontalLines)
    }
  }, [dragging, verticalLines, horizontalLines])
  
  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [dragging, handleMouseMove, handleMouseUp])
  
  // 線の削除
  const handleLineClick = (type: 'v' | 'h', index: number) => {
    if (mode !== 'delete') return
    // 端の線は削除できない
    if (type === 'v' && (index === 0 || index === verticalLines.length - 1)) return
    if (type === 'h' && (index === 0 || index === horizontalLines.length - 1)) return
    
    if (type === 'v') {
      const newLines = verticalLines.filter((_, i) => i !== index)
      setVerticalLines(newLines)
      updateCells(newLines, horizontalLines)
    } else {
      const newLines = horizontalLines.filter((_, i) => i !== index)
      setHorizontalLines(newLines)
      updateCells(verticalLines, newLines)
    }
  }
  
  // セルクリック
  const handleCellClick = (row: number, col: number) => {
    if (mode !== 'select') return
    
    const newCells = [...cells]
    if (!newCells[row]) newCells[row] = []
    newCells[row][col] = cellType
    setCells(newCells)
  }
  
  // 行全体を設定
  const setRowType = (row: number, type: CellType) => {
    const newCells = [...cells]
    if (!newCells[row]) newCells[row] = []
    for (let c = 0; c < verticalLines.length - 1; c++) {
      newCells[row][c] = type
    }
    setCells(newCells)
  }
  
  // 列全体を設定
  const setColType = (col: number, type: CellType) => {
    const newCells = [...cells]
    for (let r = 0; r < horizontalLines.length - 1; r++) {
      if (!newCells[r]) newCells[r] = []
      newCells[r][col] = type
    }
    setCells(newCells)
  }
  
  // テンプレート保存
  const [saving, setSaving] = useState(false)
  const [templates, setTemplates] = useState<any[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  
  // テンプレート一覧を取得
  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/grid-templates')
      const data = await response.json()
      if (Array.isArray(data)) {
        setTemplates(data)
      }
    } catch (error) {
      console.error('Failed to load templates:', error)
    }
  }
  
  // 初回読み込み
  useEffect(() => {
    loadTemplates()
  }, [])
  
  // テンプレート読み込み
  const loadTemplate = async (id: string) => {
    try {
      const response = await fetch(`/api/grid-templates?id=${id}`)
      const data = await response.json()
      
      if (data) {
        setTemplateName(data.name)
        setVerticalLines(data.vertical_lines)
        setHorizontalLines(data.horizontal_lines)
        setCells(data.cells)
        setSelectedTemplateId(id)
      }
    } catch (error) {
      console.error('Failed to load template:', error)
      alert('テンプレートの読み込みに失敗しました')
    }
  }
  
  // テンプレート保存
  const saveTemplate = async () => {
    if (!templateName.trim()) {
      alert('テンプレート名を入力してください')
      return
    }
    
    setSaving(true)
    
    try {
      const body = {
        name: templateName,
        verticalLines,
        horizontalLines,
        cells
      }
      
      // 更新 or 新規作成
      const method = selectedTemplateId ? 'PUT' : 'POST'
      const requestBody = selectedTemplateId ? { ...body, id: selectedTemplateId } : body
      
      const response = await fetch('/api/grid-templates', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      })
      
      const data = await response.json()
      
      if (data.success) {
        alert('テンプレートを保存しました！')
        setSelectedTemplateId(data.template.id)
        loadTemplates() // 一覧を更新
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      console.error('Failed to save template:', error)
      alert('保存に失敗しました: ' + error.message)
    } finally {
      setSaving(false)
    }
  }
  
  // 新規作成
  const createNew = () => {
    setSelectedTemplateId(null)
    setTemplateName('新規テンプレート')
    setVerticalLines([0, 100])
    setHorizontalLines([0, 100])
    setCells([])
  }
  
  // テンプレート削除
  const deleteTemplate = async (id: string, name: string) => {
    if (!confirm(`「${name}」を削除しますか？`)) return
    
    try {
      const response = await fetch(`/api/grid-templates?id=${id}`, {
        method: 'DELETE'
      })
      
      const data = await response.json()
      
      if (data.success) {
        // 削除したテンプレートが選択中なら解除
        if (selectedTemplateId === id) {
          createNew()
        }
        loadTemplates() // 一覧を更新
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      console.error('Failed to delete template:', error)
      alert('削除に失敗しました: ' + error.message)
    }
  }
  
  // テスト実行
  const [testing, setTesting] = useState(false)
  const [testResults, setTestResults] = useState<any[] | null>(null)
  const [showTestModal, setShowTestModal] = useState(false)
  
  const runTest = async () => {
    if (!image) {
      alert('画像をアップロードしてください')
      return
    }
    
    if (!selectedTemplateId) {
      alert('テンプレートを保存してから実行してください')
      return
    }
    
    setTesting(true)
    setTestResults(null)
    
    try {
      const response = await fetch('/api/recognize-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image,
          templateId: selectedTemplateId,
          autoMatchThreshold: 70
        })
      })
      
      const data = await response.json()
      
      if (data.success) {
        setTestResults(data.cards)
        setShowTestModal(true)
      } else {
        throw new Error(data.error)
      }
    } catch (error: any) {
      console.error('Test failed:', error)
      alert('テスト実行に失敗しました: ' + error.message)
    } finally {
      setTesting(false)
    }
  }
  
  // セルの色を取得
  const getCellColor = (type: CellType): string => {
    switch (type) {
      case 'card': return 'rgba(251, 191, 36, 0.5)'    // オレンジ
      case 'price': return 'rgba(59, 130, 246, 0.5)'   // 青
      case 'exclude': return 'rgba(239, 68, 68, 0.5)'  // 赤
      default: return 'transparent'
    }
  }
  
  const getCellEmoji = (type: CellType): string => {
    switch (type) {
      case 'card': return '🃏'
      case 'price': return '💰'
      case 'exclude': return '❌'
      default: return ''
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Grid size={28} />
          グリッドテンプレートエディタ
        </h1>
        
        {/* コントロールパネル */}
        <div className="bg-white rounded-xl p-4 shadow mb-4">
          <div className="flex flex-wrap gap-4 items-center">
            {/* 画像アップロード */}
            <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg cursor-pointer hover:bg-gray-200">
              <Upload size={18} />
              画像選択
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </label>
            
            <div className="h-8 border-l border-gray-300" />
            
            {/* 線の追加 */}
            <button
              onClick={addVerticalLine}
              className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
            >
              <Plus size={18} />
              縦線追加
            </button>
            
            <button
              onClick={addHorizontalLine}
              className="flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
            >
              <Plus size={18} />
              横線追加
            </button>
            
            <div className="h-8 border-l border-gray-300" />
            
            {/* モード選択 */}
            <div className="flex gap-1">
              <button
                onClick={() => setMode('select')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                  mode === 'select' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                <MousePointer size={18} />
                塗る
              </button>
              <button
                onClick={() => setMode('move')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                  mode === 'move' ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                <Move size={18} />
                移動
              </button>
              <button
                onClick={() => setMode('delete')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg ${
                  mode === 'delete' ? 'bg-red-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
                }`}
              >
                <Trash2 size={18} />
                削除
              </button>
            </div>
            
            <div className="h-8 border-l border-gray-300" />
            
            {/* テスト実行 */}
            <button
              onClick={runTest}
              disabled={testing || !selectedTemplateId || !image}
              className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testing ? <RefreshCw size={18} className="animate-spin" /> : <Play size={18} />}
              {testing ? '実行中...' : '切り抜きテスト'}
            </button>
          </div>
          
          {/* セルタイプ選択（塗るモード時） */}
          {mode === 'select' && (
            <div className="flex gap-2 mt-3 pt-3 border-t">
              <span className="text-sm text-gray-500 self-center mr-2">塗る色:</span>
              <button
                onClick={() => setCellType('card')}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                  cellType === 'card' ? 'bg-amber-400 text-white' : 'bg-amber-100 text-amber-700'
                }`}
              >
                🃏 カード
              </button>
              <button
                onClick={() => setCellType('price')}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                  cellType === 'price' ? 'bg-blue-500 text-white' : 'bg-blue-100 text-blue-700'
                }`}
              >
                💰 価格
              </button>
              <button
                onClick={() => setCellType('exclude')}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                  cellType === 'exclude' ? 'bg-red-500 text-white' : 'bg-red-100 text-red-700'
                }`}
              >
                ❌ 除外
              </button>
              <button
                onClick={() => setCellType('empty')}
                className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                  cellType === 'empty' ? 'bg-gray-500 text-white' : 'bg-gray-100 text-gray-700'
                }`}
              >
                ⬜ 空白
              </button>
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-4 gap-4">
          {/* メインエディタ */}
          <div className="col-span-3 bg-white rounded-xl p-4 shadow">
            <div
              ref={containerRef}
              className="relative border-2 border-gray-300 overflow-hidden"
              style={{ 
                aspectRatio: imageSize.width && imageSize.height 
                  ? `${imageSize.width} / ${imageSize.height}` 
                  : '4 / 5',
                cursor: mode === 'move' ? 'move' : mode === 'delete' ? 'pointer' : 'crosshair'
              }}
            >
              {/* 背景画像 */}
              {image ? (
                <img
                  src={image}
                  alt="買取表"
                  className="absolute inset-0 w-full h-full object-cover"
                  draggable={false}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-50 text-gray-400">
                  画像をアップロードしてください
                </div>
              )}
              
              {/* セル（クリック用） */}
              {horizontalLines.slice(0, -1).map((hLine, rowIndex) => (
                verticalLines.slice(0, -1).map((vLine, colIndex) => {
                  const nextH = horizontalLines[rowIndex + 1]
                  const nextV = verticalLines[colIndex + 1]
                  const cellTypeValue = cells[rowIndex]?.[colIndex] || 'empty'
                  
                  return (
                    <div
                      key={`cell-${rowIndex}-${colIndex}`}
                      className="absolute border border-transparent hover:border-white hover:border-2 transition-all"
                      style={{
                        left: `${vLine}%`,
                        top: `${hLine}%`,
                        width: `${nextV - vLine}%`,
                        height: `${nextH - hLine}%`,
                        backgroundColor: getCellColor(cellTypeValue),
                      }}
                      onClick={() => handleCellClick(rowIndex, colIndex)}
                    >
                      <span className="absolute inset-0 flex items-center justify-center text-2xl opacity-70">
                        {getCellEmoji(cellTypeValue)}
                      </span>
                    </div>
                  )
                })
              ))}
              
              {/* 縦線 */}
              {verticalLines.map((pos, index) => (
                <div
                  key={`v-${index}`}
                  className={`absolute top-0 bottom-0 w-1 -ml-0.5 ${
                    index === 0 || index === verticalLines.length - 1
                      ? 'bg-gray-400'
                      : mode === 'delete'
                        ? 'bg-red-500 cursor-pointer hover:bg-red-600'
                        : mode === 'move'
                          ? 'bg-purple-500 cursor-ew-resize hover:bg-purple-600'
                          : 'bg-purple-500'
                  }`}
                  style={{ left: `${pos}%` }}
                  onMouseDown={(e) => handleLineMouseDown('v', index, e)}
                  onClick={() => handleLineClick('v', index)}
                />
              ))}
              
              {/* 横線 */}
              {horizontalLines.map((pos, index) => (
                <div
                  key={`h-${index}`}
                  className={`absolute left-0 right-0 h-1 -mt-0.5 ${
                    index === 0 || index === horizontalLines.length - 1
                      ? 'bg-gray-400'
                      : mode === 'delete'
                        ? 'bg-red-500 cursor-pointer hover:bg-red-600'
                        : mode === 'move'
                          ? 'bg-purple-500 cursor-ns-resize hover:bg-purple-600'
                          : 'bg-purple-500'
                  }`}
                  style={{ top: `${pos}%` }}
                  onMouseDown={(e) => handleLineMouseDown('h', index, e)}
                  onClick={() => handleLineClick('h', index)}
                />
              ))}
            </div>
            
            {/* グリッド情報 */}
            <div className="mt-2 text-sm text-gray-500">
              {verticalLines.length - 1} 列 × {horizontalLines.length - 1} 行
              {image && ` | 画像サイズ: ${imageSize.width} × ${imageSize.height}`}
            </div>
          </div>
          
          {/* サイドパネル */}
          <div className="space-y-4">
            {/* 行・列の一括設定 */}
            <div className="bg-white rounded-xl p-4 shadow">
              <h3 className="font-bold mb-3">一括設定</h3>
              
              <div className="space-y-2">
                <div>
                  <label className="text-sm text-gray-600">行を選択:</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {horizontalLines.slice(0, -1).map((_, i) => (
                      <button
                        key={`row-btn-${i}`}
                        onClick={() => setRowType(i, cellType)}
                        className="w-8 h-8 text-xs bg-gray-100 rounded hover:bg-gray-200"
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div>
                  <label className="text-sm text-gray-600">列を選択:</label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {verticalLines.slice(0, -1).map((_, i) => (
                      <button
                        key={`col-btn-${i}`}
                        onClick={() => setColType(i, cellType)}
                        className="w-8 h-8 text-xs bg-gray-100 rounded hover:bg-gray-200"
                      >
                        {String.fromCharCode(65 + i)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            {/* テンプレート一覧 */}
            <div className="bg-white rounded-xl p-4 shadow">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold">テンプレート一覧</h3>
                <button
                  onClick={createNew}
                  className="text-sm text-blue-500 hover:underline"
                >
                  + 新規
                </button>
              </div>
              
              {templates.length > 0 ? (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {templates.map((t) => (
                    <div
                      key={t.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                        selectedTemplateId === t.id
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-50 hover:bg-gray-100'
                      }`}
                    >
                      <button
                        onClick={() => loadTemplate(t.id)}
                        className="flex-1 text-left truncate"
                      >
                        {t.name}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteTemplate(t.id, t.name);
                        }}
                        className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                        title="削除"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">まだテンプレートがありません</p>
              )}
            </div>
            
            {/* 保存 */}
            <div className="bg-white rounded-xl p-4 shadow">
              <h3 className="font-bold mb-3">
                {selectedTemplateId ? 'テンプレート更新' : 'テンプレート保存'}
              </h3>
              
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="テンプレート名"
                className="w-full px-3 py-2 border rounded-lg mb-3"
              />
              
              <button
                onClick={saveTemplate}
                disabled={saving}
                className="w-full py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Save size={18} />
                {saving ? '保存中...' : selectedTemplateId ? '更新' : '保存'}
              </button>
            </div>
            
            {/* 使い方 */}
            <div className="bg-blue-50 rounded-xl p-4 text-sm">
              <h3 className="font-bold text-blue-700 mb-2">使い方</h3>
              <ol className="list-decimal list-inside space-y-1 text-blue-600">
                <li>画像をアップロード</li>
                <li>縦線・横線を追加</li>
                <li>「移動」モードで線をドラッグ</li>
                <li>「塗る」モードでセルの種類を設定</li>
                <li>テンプレートを保存</li>
                <li>「切り抜きテスト」で確認</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
      
      {/* テスト結果モーダル */}
      {showTestModal && testResults && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* ヘッダー */}
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-xl font-bold">
                切り抜き結果 ({testResults.length}枚)
              </h2>
              <button
                onClick={() => setShowTestModal(false)}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <X size={24} />
              </button>
            </div>
            
            {/* 結果一覧 */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="grid grid-cols-4 gap-4">
                {testResults.map((result, i) => (
                  <div
                    key={i}
                    className={`border rounded-lg p-2 ${
                      result.matchedCard 
                        ? 'border-green-300 bg-green-50' 
                        : result.needsReview 
                          ? 'border-yellow-300 bg-yellow-50'
                          : 'border-red-300 bg-red-50'
                    }`}
                  >
                    {/* 切り抜き画像 */}
                    {result.cardImage ? (
                      <img
                        src={result.cardImage}
                        alt={`Card ${i + 1}`}
                        className="w-full h-32 object-contain bg-gray-100 rounded mb-2"
                      />
                    ) : (
                      <div className="w-full h-32 bg-gray-200 rounded mb-2 flex items-center justify-center text-gray-400">
                        エラー
                      </div>
                    )}
                    
                    {/* 情報 */}
                    <div className="text-xs space-y-1">
                      <div className="font-bold truncate">
                        {result.ocrText || '(読み取り失敗)'}
                      </div>
                      
                      {result.price && (
                        <div className="text-blue-600">
                          ¥{result.price.toLocaleString()}
                        </div>
                      )}
                      
                      {result.matchedCard && (
                        <div className="text-green-600 truncate">
                          → {result.matchedCard.name} ({result.matchedCard.similarity}%)
                        </div>
                      )}
                      
                      {result.needsReview && result.candidates?.[0] && (
                        <div className="text-yellow-600 truncate">
                          候補: {result.candidates[0].name} ({result.candidates[0].similarity}%)
                        </div>
                      )}
                      
                      {!result.matchedCard && !result.needsReview && (
                        <div className="text-red-600">マッチなし</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            {/* フッター */}
            <div className="p-4 border-t bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">
                  <span className="inline-block px-2 py-1 bg-green-100 text-green-700 rounded mr-2">
                    マッチ: {testResults.filter(r => r.matchedCard).length}
                  </span>
                  <span className="inline-block px-2 py-1 bg-yellow-100 text-yellow-700 rounded mr-2">
                    要確認: {testResults.filter(r => r.needsReview).length}
                  </span>
                  <span className="inline-block px-2 py-1 bg-red-100 text-red-700 rounded">
                    なし: {testResults.filter(r => !r.matchedCard && !r.needsReview).length}
                  </span>
                </div>
                <button
                  onClick={() => setShowTestModal(false)}
                  className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                >
                  閉じる
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
