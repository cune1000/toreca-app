'use client'

import { useState, useRef } from 'react'
import { Loader2, CheckCircle, XCircle, Database, Upload, Search, Image, BarChart3 } from 'lucide-react'

export default function ClipTestPage() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const executeAction = async (action: string, params: any = {}) => {
    setLoading(true)
    setResult(null)
    setError(null)
    setSearchResults([])

    try {
      const response = await fetch('/api/clip-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...params }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'APIエラー')
      }

      setResult(data)
      
      // 検索結果があれば表示用に保存
      if (data.results) {
        setSearchResults(data.results)
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // 画像ファイルを選択して検索
  const handleImageSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // プレビュー表示
    const reader = new FileReader()
    reader.onload = async (event) => {
      const base64 = event.target?.result as string
      setPreviewImage(base64)
      
      // 検索実行
      await executeAction('search', { image: base64, topK: 10 })
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          🔍 CLIP 画像検索テスト
        </h1>
        <p className="text-gray-600 mb-8">
          CLIP埋め込みによるカード類似検索の動作確認
        </p>

        {/* アクションボタン */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* 状況確認 */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <BarChart3 className="text-blue-600" size={24} />
              </div>
              <div>
                <h2 className="font-bold text-gray-800">埋め込み状況</h2>
                <p className="text-sm text-gray-500">DBの状態を確認</p>
              </div>
            </div>
            <button
              onClick={() => executeAction('status')}
              disabled={loading}
              className="w-full py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <BarChart3 size={20} />}
              状況を確認
            </button>
          </div>

          {/* 埋め込み生成 */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Database className="text-green-600" size={24} />
              </div>
              <div>
                <h2 className="font-bold text-gray-800">埋め込み生成</h2>
                <p className="text-sm text-gray-500">全カードの埋め込みを生成</p>
              </div>
            </div>
            <button
              onClick={() => executeAction('generateAllEmbeddings', { limit: 100 })}
              disabled={loading}
              className="w-full py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Database size={20} />}
              埋め込みを生成
            </button>
          </div>

          {/* 画像検索 */}
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <Search className="text-purple-600" size={24} />
              </div>
              <div>
                <h2 className="font-bold text-gray-800">画像で検索</h2>
                <p className="text-sm text-gray-500">類似カードを検索</p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSearch}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="w-full py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
              画像を選択して検索
            </button>
          </div>
        </div>

        {/* 検索結果表示 */}
        {searchResults.length > 0 && (
          <div className="bg-white rounded-xl p-6 shadow-sm mb-8">
            <h3 className="font-bold text-gray-800 mb-4">検索結果 Top 10</h3>
            <div className="flex gap-6">
              {/* 検索画像 */}
              {previewImage && (
                <div className="flex-shrink-0">
                  <p className="text-sm text-gray-500 mb-2">検索画像</p>
                  <img 
                    src={previewImage} 
                    alt="検索画像" 
                    className="w-32 h-44 object-cover rounded-lg border-4 border-purple-500"
                  />
                </div>
              )}
              
              {/* 結果一覧 */}
              <div className="flex-1 overflow-auto">
                <div className="flex gap-3">
                  {searchResults.map((card, index) => (
                    <div key={card.id} className="flex-shrink-0 text-center">
                      <div className="relative">
                        <img 
                          src={card.imageUrl} 
                          alt={card.name}
                          className={`w-24 h-32 object-cover rounded-lg ${
                            index === 0 ? 'border-4 border-green-500' : 'border border-gray-200'
                          }`}
                        />
                        <span className={`absolute -top-2 -left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                          index === 0 ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-600'
                        }`}>
                          {index + 1}
                        </span>
                      </div>
                      <p className="text-xs mt-1 w-24 truncate" title={card.name}>
                        {card.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {(card.similarity * 100).toFixed(1)}%
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 結果/エラー表示 */}
        {(result || error) && !searchResults.length && (
          <div className="bg-white rounded-xl p-6 shadow-sm mb-8">
            <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
              {error ? (
                <>
                  <XCircle className="text-red-500" size={20} />
                  エラー
                </>
              ) : (
                <>
                  <CheckCircle className="text-green-500" size={20} />
                  成功
                </>
              )}
            </h3>
            
            {error ? (
              <div className="p-4 bg-red-50 text-red-700 rounded-lg">
                {error}
              </div>
            ) : (
              <pre className="p-4 bg-gray-50 rounded-lg overflow-auto text-sm">
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </div>
        )}

        {/* 使い方 */}
        <div className="p-4 bg-blue-50 rounded-xl">
          <h3 className="font-bold text-blue-800 mb-2">📖 使い方</h3>
          <ol className="text-blue-700 text-sm space-y-1 list-decimal list-inside">
            <li>まず「状況を確認」で現在のDB状態を確認</li>
            <li>「埋め込みを生成」でカード画像をベクトル化（初回のみ・数分かかる）</li>
            <li>「画像を選択して検索」で類似カードを検索</li>
          </ol>
        </div>

        {/* 注意事項 */}
        <div className="mt-4 p-4 bg-yellow-50 rounded-xl">
          <h3 className="font-bold text-yellow-800 mb-2">⚠️ 注意事項</h3>
          <ul className="text-yellow-700 text-sm space-y-1">
            <li>• 初回の埋め込み生成は時間がかかります（1枚あたり数秒）</li>
            <li>• 埋め込み生成中はブラウザを閉じないでください</li>
            <li>• モデルの初回読み込みに少し時間がかかります</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
