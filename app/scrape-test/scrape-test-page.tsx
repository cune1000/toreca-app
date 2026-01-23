'use client'

import { useState } from 'react'
import { Loader2, Search, ExternalLink } from 'lucide-react'

export default function ScrapeTestPage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleScrape = async () => {
    if (!url) return
    
    setLoading(true)
    setError(null)
    setResult(null)
    
    try {
      const response = await fetch('/api/scrape-price', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'スクレイピング失敗')
      }
      
      setResult(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const testUrls = [
    {
      name: 'スニダン',
      url: 'https://snkrdunk.com/apparels/743533'
    },
    {
      name: 'トレカキャンプ 1',
      url: 'https://torecacamp-pokemon.com/products/rc_itjrkcrie622_xu81'
    },
    {
      name: 'トレカキャンプ 2',
      url: 'https://torecacamp-pokemon.com/products/rc_it3mz0aq49j0_wjsf'
    }
  ]

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          🕷️ 価格スクレイピングテスト
        </h1>
        <p className="text-gray-600 mb-8">
          スニダン・トレカキャンプから価格情報を取得
        </p>

        {/* URL入力 */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
          <div className="flex gap-4">
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://snkrdunk.com/... または https://torecacamp-pokemon.com/..."
              className="flex-1 px-4 py-3 border rounded-lg"
            />
            <button
              onClick={handleScrape}
              disabled={loading || !url}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <Search size={20} />
              )}
              取得
            </button>
          </div>
        </div>

        {/* テスト用URL */}
        <div className="bg-white rounded-xl p-6 shadow-sm mb-6">
          <h3 className="font-bold text-gray-700 mb-3">テスト用URL</h3>
          <div className="flex flex-wrap gap-2">
            {testUrls.map((item, i) => (
              <button
                key={i}
                onClick={() => setUrl(item.url)}
                className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-sm flex items-center gap-2"
              >
                {item.name}
                <ExternalLink size={14} />
              </button>
            ))}
          </div>
        </div>

        {/* エラー */}
        {error && (
          <div className="bg-red-100 text-red-700 p-4 rounded-xl mb-6">
            {error}
          </div>
        )}

        {/* 結果 */}
        {result && (
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <h3 className="font-bold text-gray-700 mb-4">取得結果</h3>
            
            {/* 基本情報 */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <div className="text-sm text-gray-500">ソース</div>
                <div className="font-medium">{result.source}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">商品名</div>
                <div className="font-medium">{result.name || '取得できず'}</div>
              </div>
            </div>

            {/* 画像 */}
            {result.imageUrl && (
              <div className="mb-6">
                <div className="text-sm text-gray-500 mb-2">画像</div>
                <img 
                  src={result.imageUrl} 
                  alt={result.name}
                  className="w-32 h-32 object-contain rounded border"
                />
              </div>
            )}

            {/* 価格（スニダン） */}
            {result.source === 'snkrdunk' && (
              <div className="mb-6">
                <div className="text-sm text-gray-500 mb-2">販売価格</div>
                <div className="text-2xl font-bold text-blue-600">
                  {result.price ? `¥${result.price.toLocaleString()}` : '取得できず'}
                </div>
              </div>
            )}

            {/* 価格（トレカキャンプ） */}
            {result.source === 'torecacamp' && (
              <>
                {result.mainPrice && (
                  <div className="mb-4">
                    <div className="text-sm text-gray-500 mb-2">メイン価格</div>
                    <div className="text-2xl font-bold text-blue-600">
                      ¥{result.mainPrice.toLocaleString()}
                    </div>
                  </div>
                )}
                
                {result.conditions && result.conditions.length > 0 && (
                  <div className="mb-4">
                    <div className="text-sm text-gray-500 mb-2">状態別価格</div>
                    <div className="space-y-2">
                      {result.conditions.map((c: any, i: number) => (
                        <div key={i} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                          <span className="font-medium w-20">{c.condition}</span>
                          <span className="text-blue-600 font-bold">
                            {c.price ? `¥${c.price.toLocaleString()}` : '-'}
                          </span>
                          {c.stock !== null && (
                            <span className="text-gray-500">
                              在庫: {c.stock}点
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 生データ */}
            <details className="mt-6">
              <summary className="cursor-pointer text-sm text-gray-500">生データを見る</summary>
              <pre className="mt-2 p-4 bg-gray-50 rounded-lg overflow-auto text-xs">
                {JSON.stringify(result, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </div>
    </div>
  )
}
