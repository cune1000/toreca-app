'use client'

import { useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { Upload, Camera, Cpu, Check, X, RefreshCw, Zap, AlertTriangle } from 'lucide-react'

export default function ImageRecognition({ onRecognized, onClose }) {
  const [step, setStep] = useState(1) // 1: アップロード, 2: 認識中, 3: 結果確認
  const [image, setImage] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [recognitionResult, setRecognitionResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef(null)

  // 画像選択
  const handleImageSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setImage(file)
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target?.result)
      }
      reader.readAsDataURL(file)
    }
  }

  // AI認識を実行（本物のClaude Vision API）
  const runRecognition = async () => {
    setStep(2)
    setLoading(true)

    try {
      // APIを呼び出し
      const response = await fetch('/api/recognize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imagePreview }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || '認識に失敗しました')
      }

      setRecognitionResult({
        name: result.name || '不明',
        cardNumber: result.cardNumber || '',
        rarity: result.rarity || '',
        cardType: result.cardType || 'ポケモンカード',
        confidence: result.confidence || 0,
      })
      setStep(3)
    } catch (error: any) {
      alert('エラー: ' + error.message)
      setStep(1)
    } finally {
      setLoading(false)
    }
  }

  // 結果を承認してカード登録
  const approveResult = async () => {
    if (!recognitionResult) return
    
    setLoading(true)

    // カテゴリとレアリティを取得
    const { data: categories } = await supabase
      .from('category_large')
      .select('id')
      .eq('name', 'ポケモンカード')
      .single()

    let rarityId = null
    if (categories) {
      const { data: rarities } = await supabase
        .from('rarities')
        .select('id')
        .eq('large_id', categories.id)
        .eq('name', recognitionResult.rarity)
        .single()
      if (rarities) rarityId = rarities.id
    }

    // カード登録
    const { data, error } = await supabase
      .from('cards')
      .insert([{
        name: recognitionResult.name,
        card_number: recognitionResult.cardNumber,
        category_large_id: categories?.id || null,
        rarity_id: rarityId
      }])
      .select()

    setLoading(false)

    if (error) {
      alert('エラー: ' + error.message)
      return
    }

    alert('カードを登録しました！')
    if (onRecognized) onRecognized(data[0])
    if (onClose) onClose()
  }

  // リセット
  const reset = () => {
    setStep(1)
    setImage(null)
    setImagePreview(null)
    setRecognitionResult(null)
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-[600px] max-h-[90vh] overflow-auto">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Cpu size={20} className="text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">AI画像認識</h2>
              <p className="text-sm text-gray-500">カード画像から自動でカード情報を認識</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="p-6">
          {/* ステップインジケーター */}
          <div className="flex items-center justify-center gap-4 mb-8">
            {[
              { num: 1, label: '画像選択' },
              { num: 2, label: 'AI認識' },
              { num: 3, label: '結果確認' },
            ].map((s, i) => (
              <div key={s.num} className="flex items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                  step >= s.num 
                    ? 'bg-purple-500 text-white' 
                    : 'bg-gray-200 text-gray-500'
                }`}>
                  {step > s.num ? <Check size={16} /> : s.num}
                </div>
                <span className={`ml-2 text-sm ${step >= s.num ? 'text-gray-800' : 'text-gray-400'}`}>
                  {s.label}
                </span>
                {i < 2 && <div className={`w-12 h-0.5 mx-3 ${step > s.num ? 'bg-purple-500' : 'bg-gray-200'}`} />}
              </div>
            ))}
          </div>

          {/* Step 1: 画像選択 */}
          {step === 1 && (
            <div className="space-y-4">
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors"
              >
                {imagePreview ? (
                  <div className="space-y-4">
                    <img src={imagePreview} alt="Preview" className="max-h-64 mx-auto rounded-lg" />
                    <p className="text-sm text-gray-500">クリックして別の画像を選択</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto">
                      <Upload size={32} className="text-gray-400" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-700">画像をアップロード</p>
                      <p className="text-sm text-gray-500 mt-1">PNG, JPG, GIF（最大10MB）</p>
                    </div>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />

              <div className="flex justify-end gap-3">
                <button
                  onClick={onClose}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button
                  onClick={runRecognition}
                  disabled={!image}
                  className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 flex items-center gap-2"
                >
                  <Zap size={18} />
                  認識開始
                </button>
              </div>
            </div>
          )}

          {/* Step 2: 認識中 */}
          {step === 2 && (
            <div className="text-center py-12">
              <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <RefreshCw size={40} className="text-purple-500 animate-spin" />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">AI認識中...</h3>
              <p className="text-gray-500">カード情報を解析しています</p>
              <div className="mt-6 flex justify-center gap-2">
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          {/* Step 3: 結果確認 */}
          {step === 3 && recognitionResult && (
            <div className="space-y-6">
              <div className="flex gap-6">
                {/* 画像 */}
                <div className="w-1/3">
                  <img src={imagePreview} alt="Card" className="w-full rounded-lg border border-gray-200" />
                </div>

                {/* 認識結果 */}
                <div className="flex-1 space-y-4">
                  <div className="flex items-center gap-2">
                    <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                      recognitionResult.confidence >= 90 
                        ? 'bg-green-100 text-green-700' 
                        : recognitionResult.confidence >= 70
                        ? 'bg-yellow-100 text-yellow-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      信頼度 {recognitionResult.confidence}%
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-gray-500 mb-1">カード名</label>
                    <input
                      type="text"
                      value={recognitionResult.name}
                      onChange={(e) => setRecognitionResult({ ...recognitionResult, name: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg font-medium text-lg"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">カード番号</label>
                      <input
                        type="text"
                        value={recognitionResult.cardNumber}
                        onChange={(e) => setRecognitionResult({ ...recognitionResult, cardNumber: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500 mb-1">レアリティ</label>
                      <input
                        type="text"
                        value={recognitionResult.rarity}
                        onChange={(e) => setRecognitionResult({ ...recognitionResult, rarity: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                      />
                    </div>
                  </div>

                  {recognitionResult.confidence < 80 && (
                    <div className="flex items-start gap-2 p-3 bg-yellow-50 rounded-lg">
                      <AlertTriangle size={18} className="text-yellow-600 mt-0.5" />
                      <div className="text-sm text-yellow-700">
                        信頼度が低いため、認識結果を確認してください。
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-between">
                <button
                  onClick={reset}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  やり直す
                </button>
                <div className="flex gap-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={approveResult}
                    disabled={loading}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
                  >
                    {loading ? (
                      <>
                        <RefreshCw size={18} className="animate-spin" />
                        登録中...
                      </>
                    ) : (
                      <>
                        <Check size={18} />
                        この内容で登録
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Claude Vision API */}
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-100 text-center">
          <p className="text-xs text-gray-500">
            🤖 Claude Vision APIで画像認識しています
          </p>
        </div>
      </div>
    </div>
  )
}
