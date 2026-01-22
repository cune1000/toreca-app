'use client'

import { useState } from 'react'

export default function TestPage() {
  const [url, setUrl] = useState('https://www.cardrush-pokemon.jp/product/76315')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)

  const testScrape = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await res.json()
      setResult(data)
    } catch (err: any) {
      setResult({ error: err.message })
    }
    setLoading(false)
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">スクレイピングテスト</h1>
      
      <div className="mb-4">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="w-full p-2 border rounded"
          placeholder="URLを入力"
        />
      </div>
      
      <button
        onClick={testScrape}
        disabled={loading}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {loading ? 'スクレイピング中...' : 'スクレイピング実行'}
      </button>
      
      {result && (
        <pre className="mt-4 p-4 bg-gray-100 rounded overflow-auto">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  )
}