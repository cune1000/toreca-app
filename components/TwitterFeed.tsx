'use client'

import { useState } from 'react'
import { RefreshCw, ExternalLink, Image, Cpu, Check, X } from 'lucide-react'

export default function TwitterFeed({ shop, onImageSelect, onClose }) {
  const [loading, setLoading] = useState(false)
  const [tweets, setTweets] = useState([])
  const [error, setError] = useState(null)
  const [selectedImage, setSelectedImage] = useState(null)

  // ツイートを取得
  const fetchTweets = async () => {
    if (!shop?.x_account) {
      setError('Xアカウントが設定されていません')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/twitter?username=${shop.x_account}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'ツイートの取得に失敗しました')
      }

      setTweets(data.tweets || [])
      if (data.tweets?.length === 0) {
        setError('画像付きのツイートが見つかりませんでした')
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // 画像を選択してAI認識に送る
  const selectImage = (imageUrl: string) => {
    setSelectedImage(imageUrl)
  }

  // 選択した画像でAI認識
  const processImage = () => {
    if (selectedImage && onImageSelect) {
      onImageSelect(selectedImage)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-[800px] max-h-[90vh] overflow-auto">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{shop?.icon}</span>
            <div>
              <h2 className="text-xl font-bold text-gray-800">{shop?.name}</h2>
              <p className="text-sm text-gray-500">@{shop?.x_account}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="p-6">
          {/* 取得ボタン */}
          {tweets.length === 0 && !loading && (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Image size={32} className="text-blue-500" />
              </div>
              <p className="text-gray-600 mb-4">買取表の画像を取得します</p>
              <button
                onClick={fetchTweets}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2 mx-auto"
              >
                <RefreshCw size={18} />
                最新ツイートを取得
              </button>
            </div>
          )}

          {/* ローディング */}
          {loading && (
            <div className="text-center py-8">
              <RefreshCw size={40} className="text-blue-500 animate-spin mx-auto mb-4" />
              <p className="text-gray-600">ツイートを取得中...</p>
            </div>
          )}

          {/* エラー */}
          {error && (
            <div className="text-center py-8">
              <p className="text-red-500 mb-4">{error}</p>
              <button
                onClick={fetchTweets}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                再試行
              </button>
            </div>
          )}

          {/* ツイート一覧 */}
          {tweets.length > 0 && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-500">{tweets.length}件の画像付きツイート</p>
                <button
                  onClick={fetchTweets}
                  className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-1"
                >
                  <RefreshCw size={14} />
                  更新
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {tweets.map((tweet: any) => (
                  <div key={tweet.id} className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="p-3 text-xs text-gray-500 bg-gray-50">
                      {new Date(tweet.created_at).toLocaleString('ja-JP')}
                    </div>
                    <div className="grid grid-cols-2 gap-1 p-1">
                      {tweet.images.map((imageUrl: string, idx: number) => (
                        <div
                          key={idx}
                          onClick={() => selectImage(imageUrl)}
                          className={`relative cursor-pointer rounded overflow-hidden ${
                            selectedImage === imageUrl ? 'ring-4 ring-purple-500' : ''
                          }`}
                        >
                          <img
                            src={imageUrl}
                            alt={`Tweet image ${idx + 1}`}
                            className="w-full h-32 object-cover"
                          />
                          {selectedImage === imageUrl && (
                            <div className="absolute inset-0 bg-purple-500/30 flex items-center justify-center">
                              <Check size={32} className="text-white" />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <div className="p-3 text-sm text-gray-700 line-clamp-2">
                      {tweet.text}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        {selectedImage && (
          <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-purple-50">
            <div className="flex items-center gap-3">
              <img src={selectedImage} alt="Selected" className="w-16 h-16 object-cover rounded" />
              <p className="text-sm text-gray-700">この画像をAI認識しますか？</p>
            </div>
            <button
              onClick={processImage}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 flex items-center gap-2"
            >
              <Cpu size={18} />
              AI認識を実行
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
