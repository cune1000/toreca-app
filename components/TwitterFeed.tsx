'use client'

import { useState } from 'react'
import { RefreshCw, Image, Cpu, Check, X, Clock, Inbox } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { addPendingImage } from '@/lib/api/pending'
import BulkRecognition from './BulkRecognition'

interface SelectedImage {
  url: string
  tweetTime: string
  tweetUrl: string
  tweetId: string
}

interface Shop {
  id: string
  name: string
  x_account?: string
  icon?: string
}

interface Props {
  shop: Shop
  onImageSelect?: (url: string) => void
  onClose: () => void
}

export default function TwitterFeed({ shop, onImageSelect, onClose }: Props) {
  const [loading, setLoading] = useState(false)
  const [tweets, setTweets] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<SelectedImage | null>(null)
  const [showBulkRecognition, setShowBulkRecognition] = useState(false)
  const [savingToPending, setSavingToPending] = useState(false)

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

  // 画像を選択
  const selectImage = (imageUrl: string, tweet: any) => {
    setSelectedImage({
      url: imageUrl,
      tweetTime: tweet.created_at,
      tweetUrl: `https://x.com/${shop.x_account}/status/${tweet.id}`,
      tweetId: tweet.id
    })
  }

  // 一括認識を開く
  const openBulkRecognition = () => {
    if (selectedImage) {
      setShowBulkRecognition(true)
    }
  }

  // 保留リストに追加（lib/api使用）
  const addToPending = async () => {
    if (!selectedImage) return
    
    if (!shop?.id) {
      alert('店舗IDが見つかりません')
      return
    }

    setSavingToPending(true)
    try {
      const { data, error } = await addPendingImage({
        shop_id: shop.id,
        image_url: selectedImage.url,
        tweet_url: selectedImage.tweetUrl,
        tweet_time: selectedImage.tweetTime,
      })

      if (error) {
        throw new Error(error)
      }

      alert('保留リストに追加しました')
      setSelectedImage(null)
    } catch (err: any) {
      console.error('Failed to add to pending:', err)
      alert('保存に失敗しました: ' + (err.message || JSON.stringify(err)))
    } finally {
      setSavingToPending(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl w-[800px] max-h-[90vh] overflow-auto">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {shop?.icon ? (
                <img 
                  src={shop.icon} 
                  alt={shop.name}
                  className="w-10 h-10 rounded-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = `https://unavatar.io/twitter/${shop.x_account}`
                  }}
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                  <span className="text-xl">🪪</span>
                </div>
              )}
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
                      <div className="p-3 text-xs text-gray-500 bg-gray-50 flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(tweet.created_at).toLocaleString('ja-JP')}
                      </div>
                      <div className="grid grid-cols-2 gap-1 p-1">
                        {tweet.images.map((imageUrl: string, idx: number) => (
                          <div
                            key={idx}
                            onClick={() => selectImage(imageUrl, tweet)}
                            className={`relative cursor-pointer rounded overflow-hidden ${
                              selectedImage?.url === imageUrl ? 'ring-4 ring-purple-500' : ''
                            }`}
                          >
                            <img
                              src={imageUrl}
                              alt={`Tweet image ${idx + 1}`}
                              className="w-full h-32 object-cover"
                              referrerPolicy="no-referrer"
                            />
                            {selectedImage?.url === imageUrl && (
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
                <img 
                  src={selectedImage.url} 
                  alt="Selected" 
                  className="w-16 h-16 object-cover rounded"
                  referrerPolicy="no-referrer"
                />
                <div>
                  <p className="text-sm text-gray-700">この画像を処理しますか？</p>
                  <p className="text-xs text-gray-500 flex items-center gap-1">
                    <Clock size={12} />
                    {new Date(selectedImage.tweetTime).toLocaleString('ja-JP')}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={addToPending}
                  disabled={savingToPending}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center gap-2 disabled:opacity-50"
                >
                  <Inbox size={18} />
                  保留に追加
                </button>
                <button
                  onClick={openBulkRecognition}
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 flex items-center gap-2"
                >
                  <Cpu size={18} />
                  今すぐ認識
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 一括認識モーダル */}
      {showBulkRecognition && selectedImage && (
        <BulkRecognition
          imageUrl={selectedImage.url}
          shop={shop}
          tweetTime={selectedImage.tweetTime}
          tweetUrl={selectedImage.tweetUrl}
          onClose={() => setShowBulkRecognition(false)}
          onCompleted={() => {
            setShowBulkRecognition(false)
            onClose()
          }}
        />
      )}
    </>
  )
}
