'use client'

import { useState, useEffect, useRef } from 'react'
import { Upload, Search, RefreshCw, Settings, Database, Sliders, Scissors, ChevronLeft, ChevronRight, Image } from 'lucide-react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default function OcrTestPage() {
  // 切り抜きモード
  const [mode, setMode] = useState<'single' | 'bulk'>('single')
  const [bulkImage, setBulkImage] = useState<string | null>(null)
  const [cutting, setCutting] = useState(false)
  const [cutCards, setCutCards] = useState<{ image: string; price: number; row: number; col: number; ocrText?: string; ocrFullText?: string }[]>([])
  const [selectedCardIndex, setSelectedCardIndex] = useState(0)

  // 単体テスト用
  const [image, setImage] = useState<string | null>(null)
  const [processedImage, setProcessedImage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  
  // 画像前処理パラメータ
  const [imageSettings, setImageSettings] = useState({
    contrast: 0,      // -100 ~ 100
    brightness: 0,    // -100 ~ 100
    sharpness: 0,     // 0 ~ 100
    grayscale: false,
    invert: false,
  })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  
  // 調整パラメータ
  const [settings, setSettings] = useState({
    maxLines: 5,
    minLength: 2,
    excludeExact: 'HP,10,GEM,MT,MINT',  // 完全一致で除外
    excludeContains: '進化,たね,鑑定,買取,価格,円,枚,在庫,サポ',  // 含むで除外
  })
  
  // 切り抜きパラメータ（%で指定）
  const [cutSettings, setCutSettings] = useState({
    headerRatio: 8,      // ヘッダー部分（上部）
    footerRatio: 12,     // フッター部分（下部）
    priceRowRatio: 10,   // 各カード下部の価格表示部分
    sidePadding: 0,      // 左右のパディング
  })
  
  // 手動修正
  const [editedCardName, setEditedCardName] = useState('')
  
  // あいまい検索
  const [matchThreshold, setMatchThreshold] = useState(30)
  const [dbCards, setDbCards] = useState<any[]>([])
  const [matchResults, setMatchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  
  // リアルタイム検索用
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null)

  // DBカード一覧を取得
  useEffect(() => {
    const fetchCards = async () => {
      const { data } = await supabase
        .from('cards')
        .select('id, name, image_url, card_number')
      setDbCards(data || [])
    }
    fetchCards()
  }, [])

  // 画像が変わったら前処理を適用
  useEffect(() => {
    if (image) {
      applyImageProcessing(image)
    }
  }, [image, imageSettings])

  // 画像前処理を適用
  const applyImageProcessing = (srcImage: string) => {
    const img = new window.Image()
    img.onload = () => {
      const canvas = canvasRef.current
      if (!canvas) return
      
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      
      // 元画像を描画
      ctx.drawImage(img, 0, 0)
      
      // ImageDataを取得
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imageData.data
      
      // グレースケール変換
      if (imageSettings.grayscale) {
        for (let i = 0; i < data.length; i += 4) {
          const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
          data[i] = gray
          data[i + 1] = gray
          data[i + 2] = gray
        }
      }
      
      // コントラスト調整
      if (imageSettings.contrast !== 0) {
        const factor = (259 * (imageSettings.contrast + 255)) / (255 * (259 - imageSettings.contrast))
        for (let i = 0; i < data.length; i += 4) {
          data[i] = clamp(factor * (data[i] - 128) + 128)
          data[i + 1] = clamp(factor * (data[i + 1] - 128) + 128)
          data[i + 2] = clamp(factor * (data[i + 2] - 128) + 128)
        }
      }
      
      // 明るさ調整
      if (imageSettings.brightness !== 0) {
        const adjustment = imageSettings.brightness * 2.55
        for (let i = 0; i < data.length; i += 4) {
          data[i] = clamp(data[i] + adjustment)
          data[i + 1] = clamp(data[i + 1] + adjustment)
          data[i + 2] = clamp(data[i + 2] + adjustment)
        }
      }
      
      // 反転
      if (imageSettings.invert) {
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 255 - data[i]
          data[i + 1] = 255 - data[i + 1]
          data[i + 2] = 255 - data[i + 2]
        }
      }
      
      // シャープネス（簡易版）
      if (imageSettings.sharpness > 0) {
        const strength = imageSettings.sharpness / 100
        const tempData = new Uint8ClampedArray(data)
        const w = canvas.width
        const h = canvas.height
        
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            for (let c = 0; c < 3; c++) {
              const idx = (y * w + x) * 4 + c
              const center = tempData[idx] * (1 + 4 * strength)
              const neighbors = (
                tempData[((y - 1) * w + x) * 4 + c] +
                tempData[((y + 1) * w + x) * 4 + c] +
                tempData[(y * w + x - 1) * 4 + c] +
                tempData[(y * w + x + 1) * 4 + c]
              ) * strength
              data[idx] = clamp(center - neighbors)
            }
          }
        }
      }
      
      ctx.putImageData(imageData, 0, 0)
      setProcessedImage(canvas.toDataURL('image/jpeg', 0.9))
    }
    img.src = srcImage
  }
  
  const clamp = (value: number) => Math.max(0, Math.min(255, value))

  // 画像設定変更
  const handleImageSettingsChange = (key: string, value: any) => {
    setImageSettings(prev => ({ ...prev, [key]: value }))
  }
  
  // 画像設定リセット
  const resetImageSettings = () => {
    setImageSettings({
      contrast: 0,
      brightness: 0,
      sharpness: 0,
      grayscale: false,
      invert: false,
    })
  }

  // カード名が変わったらリアルタイム検索
  useEffect(() => {
    if (searchTimeout) clearTimeout(searchTimeout)
    
    if (editedCardName.trim().length >= 2) {
      const timeout = setTimeout(() => {
        handleSearch()
      }, 300) // 300ms後に検索
      setSearchTimeout(timeout)
    } else {
      setMatchResults([])
    }
    
    return () => {
      if (searchTimeout) clearTimeout(searchTimeout)
    }
  }, [editedCardName, matchThreshold])

  // カード名抽出（除外ワード対応・改善版）
  const extractCardNameClient = (fullText: string, currentSettings: any): string | null => {
    if (!fullText) return null
    
    const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean)
    
    // 完全一致除外リスト
    const excludeExactList = (currentSettings.excludeExact || '')
      .split(',')
      .map((w: string) => w.trim())
      .filter((w: string) => w.length > 0)
    
    // 含む除外リスト
    const excludeContainsList = (currentSettings.excludeContains || '')
      .split(',')
      .map((w: string) => w.trim())
      .filter((w: string) => w.length > 0)
    
    console.log('完全一致除外:', excludeExactList)
    console.log('含む除外:', excludeContainsList)
    
    for (const line of lines.slice(0, currentSettings.maxLines)) {
      // 数字だけの行はスキップ
      if (/^[\d\s]+$/.test(line)) continue
      // HP行はスキップ
      if (/^HP\s*\d+/i.test(line)) continue
      // 短すぎる行はスキップ
      if (line.length < currentSettings.minLength) continue
      
      // まずカード名っぽい部分だけ抽出（PSA, 10, スペースなどを除去）
      let cardName = line
        .replace(/\s+/g, '')           // スペース除去
        .replace(/[「」『』【】\[\]]/g, '') // 括弧除去
        .replace(/PSA\d*/gi, '')       // PSA10など除去
        .replace(/\d+$/g, '')          // 末尾の数字除去
        .replace(/^[\d]+/g, '')        // 先頭の数字除去
        .trim()
      
      // 完全一致チェック（元の行に対して）
      const isExactMatch = excludeExactList.some((excludeWord: string) => {
        const result = line === excludeWord || cardName === excludeWord
        if (result) console.log(`"${line}" は "${excludeWord}" と完全一致で除外`)
        return result
      })
      if (isExactMatch) continue
      
      // 含むチェック（抽出後のカード名に対して）
      const containsExclude = excludeContainsList.some((excludeWord: string) => {
        const result = cardName.includes(excludeWord)
        if (result) console.log(`"${cardName}" は "${excludeWord}" を含むので除外`)
        return result
      })
      if (containsExclude) continue
      
      if (cardName.length >= currentSettings.minLength) {
        console.log('抽出されたカード名:', cardName)
        return cardName
      }
    }
    
    // 見つからなければ最初の行を整形して返す
    const firstLine = lines[0] || ''
    return firstLine
      .replace(/\s+/g, '')
      .replace(/PSA\d*/gi, '')
      .replace(/\d+$/g, '')
      .trim() || null
  }

  // 買取表画像を選択
  const handleBulkImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      setBulkImage(e.target?.result as string)
      setCutCards([])
      setSelectedCardIndex(0)
    }
    reader.readAsDataURL(file)
  }

  // 切り抜き実行
  const handleCutCards = async () => {
    if (!bulkImage) return

    setCutting(true)
    setError(null)

    try {
      const response = await fetch('/api/recognize-ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          image: bulkImage,
          autoMatchThreshold: 0, // マッチングはしない、切り抜きだけ
          // 切り抜きパラメータを送信
          headerRatio: cutSettings.headerRatio,
          footerRatio: cutSettings.footerRatio,
          priceRowRatio: cutSettings.priceRowRatio,
          sidePadding: cutSettings.sidePadding,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || '切り抜きに失敗しました')
      }

      // 切り抜き画像を保存
      const cards = data.cards.map((c: any, idx: number) => ({
        image: c.cardImage,
        price: c.price,
        row: c.row,
        col: c.col,
        ocrText: c.ocrText,
        ocrFullText: c.ocrFullText
      }))
      
      setCutCards(cards)
      setSelectedCardIndex(0)
      
      // 最初のカードを選択（クライアント側の設定で再抽出）
      if (cards.length > 0) {
        setImage(cards[0].image)
        const fullText = cards[0].ocrFullText || ''
        setResult({ text: fullText, cardName: cards[0].ocrText })
        // クライアント側の除外設定で再抽出
        const extracted = extractCardNameClient(fullText, settings)
        setEditedCardName(extracted || '')
      }

    } catch (err: any) {
      setError(err.message)
    } finally {
      setCutting(false)
    }
  }

  // 切り抜きカードを選択
  const selectCutCard = (index: number) => {
    if (index < 0 || index >= cutCards.length) return
    
    setSelectedCardIndex(index)
    const card = cutCards[index]
    setImage(card.image)
    const fullText = card.ocrFullText || ''
    setResult({ text: fullText, cardName: card.ocrText })
    // クライアント側の除外設定で再抽出
    const extracted = extractCardNameClient(fullText, settings)
    setEditedCardName(extracted || '')
    setMatchResults([])
  }

  // 単体画像を選択
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      setImage(e.target?.result as string)
      setResult(null)
      setError(null)
      setEditedCardName('')
      setMatchResults([])
    }
    reader.readAsDataURL(file)
  }

  // OCR実行（処理済み画像を使用）
  const handleOcr = async () => {
    const imageToUse = processedImage || image
    if (!imageToUse) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/google-ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: imageToUse, mode: 'card' }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'OCRに失敗しました')
      }

      setResult(data)
      const extracted = extractCardNameClient(data.text, settings)
      setEditedCardName(extracted || '')
      
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // 設定変更
  const handleSettingsChange = (key: string, value: any) => {
    const newSettings = { ...settings, [key]: value }
    setSettings(newSettings)
    
    if (result?.text) {
      const extracted = extractCardNameClient(result.text, newSettings)
      setEditedCardName(extracted || '')
    }
  }

  // あいまい検索
  const handleSearch = () => {
    if (!editedCardName.trim()) {
      setMatchResults([])
      return
    }
    
    const results = findSimilarCards(editedCardName, dbCards, matchThreshold, 10)
    setMatchResults(results)
  }

  // ひらがな→カタカナ変換
  const hiraganaToKatakana = (str: string): string => {
    return str.replace(/[\u3041-\u3096]/g, match =>
      String.fromCharCode(match.charCodeAt(0) + 0x60)
    )
  }

  // カタカナ→ひらがな変換
  const katakanaToHiragana = (str: string): string => {
    return str.replace(/[\u30A1-\u30F6]/g, match =>
      String.fromCharCode(match.charCodeAt(0) - 0x60)
    )
  }

  // あいまい検索ロジック（ひらがな・カタカナ対応）
  const findSimilarCards = (searchName: string, cards: any[], threshold: number, maxResults: number) => {
    const normalizedSearch = normalizeCardName(searchName)
    const searchKatakana = hiraganaToKatakana(normalizedSearch)
    const searchHiragana = katakanaToHiragana(normalizedSearch)
    
    return cards
      .map(card => {
        const normalizedDb = normalizeCardName(card.name)
        const dbKatakana = hiraganaToKatakana(normalizedDb)
        
        // 複数パターンで類似度計算、最大を採用
        const similarities = [
          calculateSimilarity(normalizedSearch, normalizedDb),
          calculateSimilarity(searchKatakana, dbKatakana),
          calculateSimilarity(searchHiragana, katakanaToHiragana(normalizedDb)),
        ]
        const similarity = Math.max(...similarities)
        
        return { ...card, similarity }
      })
      .filter(card => card.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxResults)
  }

  const normalizeCardName = (name: string): string => {
    return name
      .toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[ー−]/g, '-')
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => 
        String.fromCharCode(c.charCodeAt(0) - 0xFEE0)
      )
  }

  const calculateSimilarity = (str1: string, str2: string): number => {
    if (str1 === str2) return 100
    if (str1.includes(str2) || str2.includes(str1)) {
      const longer = str1.length > str2.length ? str1 : str2
      const shorter = str1.length > str2.length ? str2 : str1
      return Math.round((shorter.length / longer.length) * 90)
    }
    const distance = levenshteinDistance(str1, str2)
    const maxLen = Math.max(str1.length, str2.length)
    return Math.max(0, Math.round((1 - distance / maxLen) * 100))
  }

  const levenshteinDistance = (str1: string, str2: string): number => {
    const m = str1.length, n = str2.length
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))
    for (let i = 0; i <= m; i++) dp[i][0] = i
    for (let j = 0; j <= n; j++) dp[0][j] = j
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        dp[i][j] = str1[i-1] === str2[j-1] 
          ? dp[i-1][j-1]
          : Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]) + 1
      }
    }
    return dp[m][n]
  }

  const getSimilarityColor = (sim: number) => {
    if (sim >= 90) return 'bg-green-100 text-green-800 border-green-300'
    if (sim >= 70) return 'bg-yellow-100 text-yellow-800 border-yellow-300'
    return 'bg-red-100 text-red-800 border-red-300'
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <Settings size={28} />
          OCR調整テスト
        </h1>

        {/* モード切替 */}
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setMode('single')}
            className={`px-4 py-2 rounded-lg ${mode === 'single' ? 'bg-blue-500 text-white' : 'bg-white'}`}
          >
            単体テスト
          </button>
          <button
            onClick={() => setMode('bulk')}
            className={`px-4 py-2 rounded-lg ${mode === 'bulk' ? 'bg-blue-500 text-white' : 'bg-white'}`}
          >
            買取表から切り抜き
          </button>
        </div>

        {/* 買取表切り抜きモード */}
        {mode === 'bulk' && (
          <div className="mb-4 bg-white rounded-xl p-4 shadow">
            <h2 className="font-bold mb-3 flex items-center gap-2">
              <Scissors size={18} />
              買取表から切り抜き
            </h2>
            
            <div className="flex gap-4">
              {/* 買取表アップロード */}
              <div className="w-1/3">
                <label className="block border-2 border-dashed border-gray-300 rounded-xl p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50">
                  {bulkImage ? (
                    <img src={bulkImage} alt="買取表" className="max-h-40 mx-auto rounded" />
                  ) : (
                    <div className="py-4">
                      <Upload size={32} className="mx-auto text-gray-400 mb-2" />
                      <p className="text-gray-500 text-sm">買取表画像を選択</p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleBulkImageSelect}
                    className="hidden"
                  />
                </label>
                
                {bulkImage && (
                  <>
                    {/* 切り抜きパラメータ調整 */}
                    <div className="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-yellow-700 flex items-center gap-1">
                          <Sliders size={14} />
                          切り抜き調整
                        </span>
                        <button
                          onClick={() => setCutSettings({ headerRatio: 8, footerRatio: 12, priceRowRatio: 10, sidePadding: 0 })}
                          className="text-xs text-yellow-600 hover:underline"
                        >
                          リセット
                        </button>
                      </div>
                      
                      <div className="space-y-2 text-sm">
                        <div>
                          <div className="flex justify-between text-xs text-gray-600">
                            <span>ヘッダー（上部除外）</span>
                            <span>{cutSettings.headerRatio}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="30"
                            value={cutSettings.headerRatio}
                            onChange={(e) => setCutSettings(s => ({ ...s, headerRatio: Number(e.target.value) }))}
                            className="w-full h-1 bg-yellow-200 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-xs text-gray-600">
                            <span>フッター（下部除外）</span>
                            <span>{cutSettings.footerRatio}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="30"
                            value={cutSettings.footerRatio}
                            onChange={(e) => setCutSettings(s => ({ ...s, footerRatio: Number(e.target.value) }))}
                            className="w-full h-1 bg-yellow-200 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-xs text-gray-600">
                            <span>価格行（各カード下部）</span>
                            <span>{cutSettings.priceRowRatio}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="30"
                            value={cutSettings.priceRowRatio}
                            onChange={(e) => setCutSettings(s => ({ ...s, priceRowRatio: Number(e.target.value) }))}
                            className="w-full h-1 bg-yellow-200 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-xs text-gray-600">
                            <span>左右余白</span>
                            <span>{cutSettings.sidePadding}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="20"
                            value={cutSettings.sidePadding}
                            onChange={(e) => setCutSettings(s => ({ ...s, sidePadding: Number(e.target.value) }))}
                            className="w-full h-1 bg-yellow-200 rounded-lg appearance-none cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                    
                    <button
                      onClick={handleCutCards}
                      disabled={cutting}
                      className="mt-3 w-full py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {cutting ? <RefreshCw size={18} className="animate-spin" /> : <Scissors size={18} />}
                      切り抜き実行
                    </button>
                  </>
                )}
              </div>

              {/* 切り抜き結果 */}
              <div className="flex-1">
                {cutCards.length > 0 ? (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-500">{cutCards.length}枚切り抜き完了</span>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => selectCutCard(selectedCardIndex - 1)}
                          disabled={selectedCardIndex === 0}
                          className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                        >
                          <ChevronLeft size={20} />
                        </button>
                        <span className="text-sm font-bold">{selectedCardIndex + 1} / {cutCards.length}</span>
                        <button
                          onClick={() => selectCutCard(selectedCardIndex + 1)}
                          disabled={selectedCardIndex === cutCards.length - 1}
                          className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                        >
                          <ChevronRight size={20} />
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-1 flex-wrap max-h-32 overflow-auto">
                      {cutCards.map((card, i) => (
                        <button
                          key={i}
                          onClick={() => selectCutCard(i)}
                          className={`w-12 h-16 rounded overflow-hidden border-2 ${
                            i === selectedCardIndex ? 'border-blue-500' : 'border-transparent'
                          }`}
                        >
                          <img src={card.image} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center text-gray-400 py-8">
                    買取表をアップロードして切り抜きを実行
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4">
          {/* 左: 画像 */}
          <div className="bg-white rounded-xl p-4 shadow">
            <h2 className="font-bold mb-3 flex items-center gap-2">
              <Upload size={18} />
              {mode === 'bulk' ? '選択中のカード' : '画像'}
            </h2>
            
            {mode === 'single' && (
              <label className="block border-2 border-dashed border-gray-300 rounded-xl p-4 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 mb-3">
                {image ? (
                  <img src={processedImage || image} alt="uploaded" className="max-h-36 mx-auto rounded" />
                ) : (
                  <div className="py-6">
                    <Upload size={36} className="mx-auto text-gray-400 mb-2" />
                    <p className="text-gray-500 text-sm">画像を選択</p>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </label>
            )}

            {mode === 'bulk' && image && (
              <div className="mb-3">
                <img src={processedImage || image} alt="selected" className="max-h-36 mx-auto rounded border" />
                {cutCards[selectedCardIndex] && (
                  <div className="mt-2 text-center text-sm text-gray-500">
                    価格: ¥{cutCards[selectedCardIndex].price?.toLocaleString()}
                  </div>
                )}
              </div>
            )}

            {/* 画像前処理パネル */}
            {image && (
              <div className="mb-3 p-3 bg-purple-50 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-purple-700 flex items-center gap-1">
                    <Image size={14} />
                    画像前処理
                  </span>
                  <button
                    onClick={resetImageSettings}
                    className="text-xs text-purple-600 hover:underline"
                  >
                    リセット
                  </button>
                </div>
                
                <div className="space-y-2 text-xs">
                  <div>
                    <div className="flex justify-between text-gray-600">
                      <span>コントラスト</span>
                      <span>{imageSettings.contrast}</span>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={imageSettings.contrast}
                      onChange={(e) => handleImageSettingsChange('contrast', parseInt(e.target.value))}
                      className="w-full h-1"
                    />
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-gray-600">
                      <span>明るさ</span>
                      <span>{imageSettings.brightness}</span>
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      value={imageSettings.brightness}
                      onChange={(e) => handleImageSettingsChange('brightness', parseInt(e.target.value))}
                      className="w-full h-1"
                    />
                  </div>
                  
                  <div>
                    <div className="flex justify-between text-gray-600">
                      <span>シャープネス</span>
                      <span>{imageSettings.sharpness}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={imageSettings.sharpness}
                      onChange={(e) => handleImageSettingsChange('sharpness', parseInt(e.target.value))}
                      className="w-full h-1"
                    />
                  </div>
                  
                  <div className="flex gap-4">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={imageSettings.grayscale}
                        onChange={(e) => handleImageSettingsChange('grayscale', e.target.checked)}
                        className="w-3 h-3"
                      />
                      <span className="text-gray-600">グレースケール</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={imageSettings.invert}
                        onChange={(e) => handleImageSettingsChange('invert', e.target.checked)}
                        className="w-3 h-3"
                      />
                      <span className="text-gray-600">反転</span>
                    </label>
                  </div>
                </div>
              </div>
            )}

            {image && mode === 'single' && (
              <button
                onClick={handleOcr}
                disabled={loading}
                className="w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw size={18} className="animate-spin" /> : <Search size={18} />}
                OCR実行
              </button>
            )}
            
            {/* 切り抜きモードでもOCR再実行ボタン */}
            {image && mode === 'bulk' && (
              <button
                onClick={handleOcr}
                disabled={loading}
                className="w-full py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <RefreshCw size={18} className="animate-spin" /> : <Search size={18} />}
                前処理を適用してOCR再実行
              </button>
            )}

            {error && (
              <div className="mt-3 p-3 bg-red-50 text-red-600 rounded-lg text-sm">
                {error}
              </div>
            )}
            
            {/* 非表示Canvas（画像処理用） */}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* 中央: OCR結果 & 調整 */}
          <div className="bg-white rounded-xl p-4 shadow">
            <h2 className="font-bold mb-3 flex items-center gap-2">
              <Sliders size={18} />
              抽出設定 & 結果
            </h2>

            {/* 調整パラメータ */}
            <div className="space-y-2 mb-3 p-3 bg-gray-50 rounded-lg text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-gray-500">何行目まで</label>
                  <input
                    type="number"
                    value={settings.maxLines}
                    onChange={(e) => handleSettingsChange('maxLines', parseInt(e.target.value) || 5)}
                    className="w-full px-2 py-1 border rounded text-sm"
                    min={1}
                    max={20}
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500">最小文字数</label>
                  <input
                    type="number"
                    value={settings.minLength}
                    onChange={(e) => handleSettingsChange('minLength', parseInt(e.target.value) || 2)}
                    className="w-full px-2 py-1 border rounded text-sm"
                    min={1}
                    max={10}
                  />
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500">除外（完全一致）- この文字だけの行を除外</label>
                <input
                  type="text"
                  value={settings.excludeExact}
                  onChange={(e) => handleSettingsChange('excludeExact', e.target.value)}
                  className="w-full px-2 py-1 border rounded text-sm"
                  placeholder="HP,10,GEM,MT,MINT"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">除外（含む）- この文字を含む行を除外</label>
                <input
                  type="text"
                  value={settings.excludeContains}
                  onChange={(e) => handleSettingsChange('excludeContains', e.target.value)}
                  className="w-full px-2 py-1 border rounded text-sm"
                  placeholder="進化,たね,鑑定,買取"
                />
              </div>
            </div>

            {/* OCR全文 */}
            {result && (
              <div className="mb-3">
                <label className="text-xs text-gray-500">OCR全文</label>
                <pre className="p-2 bg-gray-100 rounded text-xs max-h-24 overflow-auto whitespace-pre-wrap">
                  {result.text || '(なし)'}
                </pre>
              </div>
            )}

            {/* カード名（編集可能） */}
            <div>
              <label className="text-xs text-gray-500">カード名（編集可能・リアルタイム検索）</label>
              <input
                type="text"
                value={editedCardName}
                onChange={(e) => setEditedCardName(e.target.value)}
                className="w-full px-3 py-2 border-2 border-blue-300 rounded-lg font-bold"
                placeholder="カード名を入力..."
              />
              <p className="text-xs text-gray-400 mt-1">※ひらがな・カタカナは自動変換して検索</p>
            </div>
          </div>

          {/* 右: マッチング結果 */}
          <div className="bg-white rounded-xl p-4 shadow">
            <h2 className="font-bold mb-3 flex items-center gap-2">
              <Database size={18} />
              マッチング結果
            </h2>

            {/* 閾値スライダー */}
            <div className="mb-3 p-2 bg-gray-50 rounded-lg">
              <label className="text-xs text-gray-500">
                閾値: <span className="font-bold">{matchThreshold}%</span>
              </label>
              <input
                type="range"
                value={matchThreshold}
                onChange={(e) => setMatchThreshold(parseInt(e.target.value))}
                className="w-full"
                min={0}
                max={100}
              />
            </div>

            {/* 結果リスト */}
            <div className="space-y-2 max-h-72 overflow-auto">
              {matchResults.length > 0 ? (
                matchResults.map((card) => (
                  <div
                    key={card.id}
                    className={`p-2 rounded-lg border-2 flex items-center gap-2 ${getSimilarityColor(card.similarity)}`}
                  >
                    {card.image_url && (
                      <img src={card.image_url} alt="" className="w-10 h-14 object-cover rounded" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm truncate">{card.name}</div>
                      {card.card_number && (
                        <div className="text-xs opacity-70">{card.card_number}</div>
                      )}
                    </div>
                    <div className="text-lg font-bold">{card.similarity}%</div>
                  </div>
                ))
              ) : (
                <div className="text-center text-gray-400 py-6 text-sm">
                  {editedCardName ? '候補なし' : '2文字以上入力で検索'}
                </div>
              )}
            </div>

            {matchResults.length > 0 && (
              <div className="mt-2 text-xs text-gray-500 text-center">
                {matchResults.length}件（DB: {dbCards.length}件）
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
