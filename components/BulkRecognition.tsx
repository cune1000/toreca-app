'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { X, Check, AlertCircle, Loader2, Image, Search, Plus, Grid, Clock, Trash2, Inbox } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface CardCandidate {
  id: string;
  name: string;
  cardNumber?: string;
  imageUrl?: string;
  similarity: number;
  isExactMatch: boolean;
}

interface RecognizedCard {
  row: number;
  col: number;
  price?: number;
  cardImage?: string;
  ocrText?: string;
  matchedCard: CardCandidate | null;
  candidates: CardCandidate[];
  needsReview: boolean;
  error?: string;
  excluded?: boolean;  // 除外フラグ
}

interface PendingCard {
  cardImage?: string;
  price?: number;
  ocrText?: string;
  manualName?: string;  // 手動入力したカード名
}

interface RecognitionStats {
  total: number;
  autoMatched: number;
  needsReview: number;
  noMatch: number;
}

interface Shop {
  id: string;
  name: string;
}

interface GridTemplate {
  id: string;
  name: string;
  shop_id?: string;
}

interface Props {
  imageUrl?: string;
  imageBase64?: string;
  shop?: Shop;
  tweetTime?: string;
  tweetUrl?: string;
  onClose?: () => void;
  onCompleted?: () => void;
}

export default function BulkRecognition({ imageUrl, imageBase64, shop, tweetTime, tweetUrl, onClose, onCompleted }: Props) {
  const [image, setImage] = useState<string | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [recognizedCards, setRecognizedCards] = useState<RecognizedCard[]>([]);
  const [stats, setStats] = useState<RecognitionStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShop, setSelectedShop] = useState<string>(shop?.id || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  
  // テンプレート関連
  const [templates, setTemplates] = useState<GridTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  
  // 保留リスト
  const [pendingCards, setPendingCards] = useState<PendingCard[]>([]);
  const [showPendingModal, setShowPendingModal] = useState(false);
  
  // 検索モーダル用
  const [searchModalIndex, setSearchModalIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CardCandidate[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // 店舗一覧を取得
  useEffect(() => {
    const fetchShops = async () => {
      const { data } = await supabase
        .from('purchase_shops')
        .select('id, name')
        .order('name');
      if (data) setShops(data);
    };
    fetchShops();
  }, []);

  // テンプレート一覧を取得
  useEffect(() => {
    const fetchTemplates = async () => {
      const { data } = await supabase
        .from('grid_templates')
        .select('id, name, shop_id')
        .order('name');
      if (data) setTemplates(data);
    };
    fetchTemplates();
  }, []);

  // imageBase64が渡された場合はそれを使う
  useEffect(() => {
    if (imageBase64) {
      setImage(imageBase64);
    } else if (imageUrl) {
      convertUrlToBase64(imageUrl);
    }
  }, [imageUrl, imageBase64]);

  // shopが渡された場合
  useEffect(() => {
    if (shop?.id) {
      setSelectedShop(shop.id);
    }
  }, [shop]);

  // URLからBase64に変換（プロキシ経由）
  const convertUrlToBase64 = async (url: string) => {
    try {
      const response = await fetch('/api/image-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: url }),
      });
      const data = await response.json();
      if (data.success && data.base64) {
        setImage(data.base64);
      } else {
        throw new Error('Failed to load image');
      }
    } catch (err) {
      console.error('画像変換エラー:', err);
      setError('画像の読み込みに失敗しました');
    }
  };

  // 認識実行（テンプレートベース or 従来のOCR）
  const handleRecognize = async () => {
    if (!image) return;

    setIsRecognizing(true);
    setError(null);
    setSaveResult(null);

    try {
      let response;
      
      if (selectedTemplate) {
        // テンプレートベースの認識（高速・安定）
        setProgress('テンプレートで切り抜き中...');
        
        response = await fetch('/api/recognize-template', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            image,
            templateId: selectedTemplate,
            autoMatchThreshold: 70
          }),
        });
      } else {
        // 従来のOCR認識（AI検出）
        setProgress('画像を解析中...（AI検出 + OCR）');
        
        response = await fetch('/api/recognize-ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            image,
            autoMatchThreshold: 80
          }),
        });
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '認識に失敗しました');
      }

      setRecognizedCards(data.cards);
      setStats(data.stats);
      setProgress('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '認識に失敗しました');
      setProgress('');
    } finally {
      setIsRecognizing(false);
    }
  };

  // カード検索（リアルタイム）
  const handleSearch = async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('cards')
        .select('id, name, image_url, card_number')
        .or(`name.ilike.%${query}%,card_number.ilike.%${query}%`)
        .limit(12);
      
      if (error) throw error;
      
      setSearchResults((data || []).map(card => ({
        id: card.id,
        name: card.name,
        cardNumber: card.card_number,
        imageUrl: card.image_url,
        similarity: 100,
        isExactMatch: true
      })));
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // デバウンス付きリアルタイム検索
  useEffect(() => {
    if (searchModalIndex === null) return;
    
    const timer = setTimeout(() => {
      handleSearch(searchQuery);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchQuery, searchModalIndex]);

  // 検索結果からカードを選択
  const handleSelectFromSearch = (candidate: CardCandidate) => {
    if (searchModalIndex === null) return;
    
    setRecognizedCards(prev => {
      const updated = [...prev];
      updated[searchModalIndex] = {
        ...updated[searchModalIndex],
        matchedCard: candidate,
        needsReview: false
      };
      return updated;
    });
    
    setSearchModalIndex(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  // カード候補を選択
  const handleSelectCandidate = (cardIndex: number, candidate: CardCandidate) => {
    setRecognizedCards(prev => {
      const updated = [...prev];
      updated[cardIndex] = {
        ...updated[cardIndex],
        matchedCard: candidate,
        needsReview: false
      };
      return updated;
    });
  };

  // マッチをクリア
  const handleClearMatch = (cardIndex: number) => {
    setRecognizedCards(prev => {
      const updated = [...prev];
      updated[cardIndex] = {
        ...updated[cardIndex],
        matchedCard: null,
        needsReview: updated[cardIndex].candidates.length > 0
      };
      return updated;
    });
  };

  // カードを除外
  const handleExclude = (cardIndex: number) => {
    setRecognizedCards(prev => {
      const updated = [...prev];
      updated[cardIndex] = {
        ...updated[cardIndex],
        excluded: true
      };
      return updated;
    });
  };

  // 除外を取り消し
  const handleRestoreExcluded = (cardIndex: number) => {
    setRecognizedCards(prev => {
      const updated = [...prev];
      updated[cardIndex] = {
        ...updated[cardIndex],
        excluded: false
      };
      return updated;
    });
  };

  // 保留リストに追加
  const handleAddToPending = (cardIndex: number) => {
    const card = recognizedCards[cardIndex];
    setPendingCards(prev => [...prev, {
      cardImage: card.cardImage,
      price: card.price,
      ocrText: card.ocrText,
      manualName: ''
    }]);
    // 元のリストから除外
    handleExclude(cardIndex);
  };

  // 保留リストから削除
  const handleRemoveFromPending = (pendingIndex: number) => {
    setPendingCards(prev => prev.filter((_, i) => i !== pendingIndex));
  };

  // 保留カードの名前を更新
  const handlePendingNameChange = (pendingIndex: number, name: string) => {
    setPendingCards(prev => {
      const updated = [...prev];
      updated[pendingIndex] = { ...updated[pendingIndex], manualName: name };
      return updated;
    });
  };

  // 保留カードの価格を更新
  const handlePendingPriceChange = (pendingIndex: number, price: string) => {
    setPendingCards(prev => {
      const updated = [...prev];
      updated[pendingIndex] = { ...updated[pendingIndex], price: price ? parseInt(price, 10) : undefined };
      return updated;
    });
  };

  // 価格変更
  const handlePriceChange = (cardIndex: number, price: string) => {
    setRecognizedCards(prev => {
      const updated = [...prev];
      updated[cardIndex] = {
        ...updated[cardIndex],
        price: price ? parseInt(price, 10) : undefined
      };
      return updated;
    });
  };

  // 買取価格を保存
  const handleSave = async () => {
    if (!selectedShop) {
      setError('店舗を選択してください');
      return;
    }

    // 除外されていない、マッチしている、価格があるカードのみ保存
    const cardsToSave = recognizedCards.filter(c => !c.excluded && c.matchedCard && c.price);
    if (cardsToSave.length === 0) {
      setError('保存するカードがありません');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const records = cardsToSave.map(card => ({
        card_id: card.matchedCard!.id,
        shop_id: selectedShop,
        price: card.price,
        recorded_at: new Date().toISOString(),
        tweet_time: tweetTime || null
      }));

      const { error: insertError } = await supabase
        .from('purchase_prices')
        .insert(records);

      if (insertError) throw insertError;

      setSaveResult(`${records.length}件の買取価格を保存しました`);
      
      if (onCompleted) {
        setTimeout(() => onCompleted(), 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  // 中断して保存
  const handleSaveAndExit = async () => {
    if (!selectedShop) {
      alert('店舗を選択してください')
      return
    }

    const unprocessedCards = recognizedCards.filter(c => !c.excluded && !c.matchedCard)
    
    if (unprocessedCards.length === 0) {
      if (confirm('未処理のカードがありません。閉じますか？')) {
        onClose?.()
      }
      return
    }

    if (!confirm(`${unprocessedCards.length}件の未処理カードを保留として保存しますか？`)) {
      return
    }

    setIsSaving(true)
    try {
      // 未処理カードをpending_cardsに保存
      const pendingRecords = unprocessedCards.map(card => ({
        shop_id: selectedShop,
        card_image: card.cardImage,
        ocr_text: card.ocrText,
        price: card.price,
        row_index: card.row,
        col_index: card.col,
        tweet_time: tweetTime || null,
        status: 'pending'
      }))

      const { error } = await supabase
        .from('pending_cards')
        .insert(pendingRecords)

      if (error) throw error

      // マッチ済みのカードは買取価格として保存
      const matchedCards = recognizedCards.filter(c => !c.excluded && c.matchedCard && c.price)
      if (matchedCards.length > 0) {
        const priceRecords = matchedCards.map(card => ({
          card_id: card.matchedCard!.id,
          shop_id: selectedShop,
          price: card.price,
          recorded_at: new Date().toISOString(),
          tweet_time: tweetTime || null
        }))

        await supabase.from('purchase_prices').insert(priceRecords)
      }

      alert(`${matchedCards.length}件を保存、${unprocessedCards.length}件を保留しました`)
      onCompleted?.()
    } catch (err: any) {
      console.error('Save error:', err)
      alert('保存に失敗しました: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  // 類似度に応じた色
  const getSimilarityColor = (similarity: number) => {
    if (similarity >= 90) return 'bg-green-100 text-green-800';
    if (similarity >= 70) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-2xl w-[95vw] h-[90vh] flex flex-col overflow-hidden">
        {/* ヘッダー */}
        <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Search size={24} />
              買取表認識
            </h2>
            {tweetTime && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Clock size={16} />
                <span>{new Date(tweetTime).toLocaleString('ja-JP')}</span>
              </div>
            )}
            {stats && (
              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-600">{stats.total}件</span>
                <span className="text-green-600">{stats.autoMatched}マッチ</span>
                <span className="text-yellow-600">{stats.needsReview}要確認</span>
                <span className="text-red-600">{stats.noMatch}未</span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={24} />
          </button>
        </div>

        {/* メインコンテンツ */}
        <div className="flex-1 flex overflow-hidden">
          {/* 左: 買取表画像 */}
          <div className="w-1/2 p-4 border-r overflow-auto bg-gray-50">
            {/* テンプレート選択 */}
            <div className="mb-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <Grid size={18} className="text-purple-600" />
                <span className="font-bold text-purple-700">テンプレート</span>
                <span className="text-xs text-purple-500">（選択で高速・正確に切り抜き）</span>
              </div>
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="w-full px-3 py-2 border border-purple-300 rounded-lg bg-white"
              >
                <option value="">テンプレートなし（AI検出）</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {!templates.length && (
                <p className="text-xs text-purple-500 mt-2">
                  テンプレートは <a href="/grid-editor" className="underline">グリッドエディタ</a> で作成できます
                </p>
              )}
            </div>
            
            {image ? (
              <div className="relative">
                <img 
                  src={image} 
                  alt="買取表" 
                  className="w-full rounded-lg shadow-lg"
                />
                {!recognizedCards.length && !isRecognizing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
                    <button
                      onClick={handleRecognize}
                      className="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 flex items-center gap-2 shadow-lg"
                    >
                      <Image size={20} />
                      {selectedTemplate ? 'テンプレートで認識' : 'AIで認識開始'}
                    </button>
                  </div>
                )}
                {isRecognizing && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 rounded-lg">
                    <Loader2 size={48} className="text-white animate-spin mb-4" />
                    <p className="text-white text-lg">{progress || '処理中...'}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                <p>画像を読み込み中...</p>
              </div>
            )}
          </div>

          {/* 右: 認識結果 */}
          <div className="w-1/2 flex flex-col overflow-hidden">
            {/* 店舗選択と保存ボタン */}
            <div className="p-4 border-b flex items-center gap-4 flex-shrink-0">
              <select
                value={selectedShop}
                onChange={(e) => setSelectedShop(e.target.value)}
                className="flex-1 px-4 py-2 border rounded-lg"
              >
                <option value="">店舗を選択...</option>
                {shops.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              
              {/* 保留リストボタン */}
              {pendingCards.length > 0 && (
                <button
                  onClick={() => setShowPendingModal(true)}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 flex items-center gap-2"
                >
                  <Clock size={18} />
                  保留 ({pendingCards.length})
                </button>
              )}
              
              <button
                onClick={handleSave}
                disabled={isSaving || !selectedShop || !recognizedCards.some(c => !c.excluded && c.matchedCard && c.price)}
                className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                買取価格を保存
              </button>
              
              {/* 中断して保存ボタン */}
              <button
                onClick={handleSaveAndExit}
                disabled={isSaving}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2"
              >
                <Inbox size={18} />
                中断して保存
              </button>
            </div>

            {/* エラー/成功メッセージ */}
            {error && (
              <div className="mx-4 mt-4 p-3 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
                <AlertCircle size={18} />
                {error}
              </div>
            )}
            {saveResult && (
              <div className="mx-4 mt-4 p-3 bg-green-50 text-green-600 rounded-lg flex items-center gap-2">
                <Check size={18} />
                {saveResult}
              </div>
            )}

            {/* 認識結果リスト */}
            <div className="flex-1 overflow-auto p-4">
              {recognizedCards.length > 0 ? (
                <div className="space-y-4">
                  {recognizedCards.map((card, index) => {
                    // 除外されたカードはスキップ
                    if (card.excluded) return null;
                    
                    return (
                    <div
                      key={index}
                      className={`p-4 rounded-lg border-2 relative ${
                        card.matchedCard 
                          ? 'border-green-200 bg-green-50' 
                          : card.needsReview 
                            ? 'border-yellow-200 bg-yellow-50'
                            : 'border-red-200 bg-red-50'
                      }`}
                    >
                      {/* 除外・保留ボタン（右上） */}
                      <div className="absolute top-2 right-2 flex gap-1">
                        {!card.matchedCard && (
                          <button
                            onClick={() => handleAddToPending(index)}
                            className="p-1 text-orange-500 hover:bg-orange-100 rounded"
                            title="保留リストに追加"
                          >
                            <Clock size={16} />
                          </button>
                        )}
                        <button
                          onClick={() => handleExclude(index)}
                          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                          title="除外"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        {/* 切り出し画像 */}
                        <div className="flex-shrink-0">
                          <div className="text-xs text-gray-500 mb-1 text-center">買取表</div>
                          {card.cardImage ? (
                            <img 
                              src={card.cardImage} 
                              alt={`Card ${index}`}
                              className="w-24 h-32 object-cover rounded border-2 border-gray-300"
                            />
                          ) : (
                            <div className="w-24 h-32 bg-gray-200 rounded flex items-center justify-center">
                              <span className="text-xs text-gray-500">?</span>
                            </div>
                          )}
                          {/* OCR結果表示 */}
                          {card.ocrText && (
                            <div className="text-xs text-gray-500 mt-1 text-center truncate w-24" title={card.ocrText}>
                              {card.ocrText}
                            </div>
                          )}
                        </div>

                        {/* 矢印 */}
                        <div className="text-2xl text-gray-400 pt-10">→</div>

                        {/* マッチした画像 */}
                        <div className="flex-shrink-0">
                          <div className="text-xs text-gray-500 mb-1 text-center">DB</div>
                          {card.matchedCard?.imageUrl ? (
                            <img 
                              src={card.matchedCard.imageUrl}
                              alt={card.matchedCard.name}
                              className="w-24 h-32 object-cover rounded border-2 border-green-400"
                            />
                          ) : (
                            <button
                              onClick={() => {
                                setSearchModalIndex(index);
                                setSearchQuery('');
                                setSearchResults([]);
                              }}
                              className="w-24 h-32 bg-gray-100 rounded border-2 border-dashed border-gray-300 flex flex-col items-center justify-center hover:bg-gray-200"
                            >
                              <Plus size={24} className="text-gray-400" />
                              <span className="text-xs text-gray-500 mt-1">検索</span>
                            </button>
                          )}
                        </div>

                        {/* 情報 */}
                        <div className="flex-1 min-w-0">
                          {/* 類似度・カード名 */}
                          {card.matchedCard ? (
                            <div className="mb-2">
                              <div className={`inline-block px-2 py-1 rounded text-sm font-bold ${getSimilarityColor(card.matchedCard.similarity)}`}>
                                {card.matchedCard.similarity}%
                              </div>
                              <div className="text-sm font-medium mt-1" title={card.matchedCard.name}>
                                {card.matchedCard.name}
                              </div>
                              <button
                                onClick={() => handleClearMatch(index)}
                                className="text-xs text-red-600 hover:underline mt-1"
                              >
                                マッチ解除
                              </button>
                            </div>
                          ) : (
                            <div className="mb-2">
                              <div className="text-sm text-red-600 font-medium">未マッチ</div>
                              <button
                                onClick={() => {
                                  setSearchModalIndex(index);
                                  setSearchQuery('');
                                  setSearchResults([]);
                                }}
                                className="mt-1 px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 flex items-center gap-1"
                              >
                                <Search size={12} />
                                カード検索
                              </button>
                            </div>
                          )}

                          {/* 価格入力 */}
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-500">¥</span>
                            <input
                              type="number"
                              value={card.price || ''}
                              onChange={(e) => handlePriceChange(index, e.target.value)}
                              className="w-28 px-2 py-1 border rounded text-right"
                            />
                          </div>

                          {/* 候補 */}
                          {card.candidates.length > 0 && !card.matchedCard && (
                            <div className="mt-2">
                              <div className="text-xs text-gray-500 mb-1">候補:</div>
                              <div className="flex flex-wrap gap-1">
                                {card.candidates.slice(0, 3).map((candidate, ci) => (
                                  <button
                                    key={ci}
                                    onClick={() => handleSelectCandidate(index, candidate)}
                                    className="flex items-center gap-1 px-2 py-1 border rounded text-xs hover:bg-white"
                                    title={candidate.name}
                                  >
                                    {candidate.imageUrl && (
                                      <img
                                        src={candidate.imageUrl}
                                        alt=""
                                        className="w-8 h-10 object-cover rounded"
                                      />
                                    )}
                                    <span className={`px-1 rounded ${getSimilarityColor(candidate.similarity)}`}>
                                      {candidate.similarity}%
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )})}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <p>左の画像を認識すると結果がここに表示されます</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 検索モーダル */}
      {searchModalIndex !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70]">
          <div className="bg-white rounded-xl w-[600px] max-h-[80vh] overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold">カード検索</h3>
              <button
                onClick={() => {
                  setSearchModalIndex(null);
                  setSearchQuery('');
                  setSearchResults([]);
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4">
              {/* 検索ボックス */}
              <div className="relative mb-4">
                <div className="flex items-center border rounded-lg overflow-hidden">
                  <Search size={20} className="ml-3 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="2文字以上でリアルタイム検索..."
                    className="flex-1 px-3 py-2 outline-none"
                    autoFocus
                  />
                  {isSearching && <Loader2 size={20} className="mr-3 animate-spin text-blue-500" />}
                </div>
                {searchQuery.length > 0 && searchQuery.length < 2 && (
                  <p className="text-xs text-gray-400 mt-1">あと{2 - searchQuery.length}文字入力してください</p>
                )}
              </div>

              {/* 対象カードの画像 */}
              {recognizedCards[searchModalIndex]?.cardImage && (
                <div className="mb-4 p-3 bg-gray-50 rounded-lg flex items-center gap-4">
                  <img
                    src={recognizedCards[searchModalIndex].cardImage}
                    alt="検索対象"
                    className="w-20 h-28 object-cover rounded border"
                  />
                  <div className="text-sm text-gray-600">
                    <p>このカードに合うDBカードを検索してください</p>
                    {recognizedCards[searchModalIndex].ocrText && (
                      <p className="text-xs text-gray-400 mt-1">
                        OCR: {recognizedCards[searchModalIndex].ocrText}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* 検索結果 */}
              <div className="max-h-[400px] overflow-auto">
                {searchResults.length > 0 ? (
                  <div className="grid grid-cols-3 gap-3">
                    {searchResults.map((card) => (
                      <button
                        key={card.id}
                        onClick={() => handleSelectFromSearch(card)}
                        className="p-2 border rounded-lg hover:bg-blue-50 hover:border-blue-300 text-left"
                      >
                        {card.imageUrl && (
                          <img
                            src={card.imageUrl}
                            alt={card.name}
                            className="w-full h-32 object-cover rounded mb-2"
                          />
                        )}
                        <div className="text-xs font-medium truncate" title={card.name}>
                          {card.name}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : searchQuery.length >= 2 && !isSearching ? (
                  <div className="text-center text-gray-500 py-8">
                    「{searchQuery}」に一致するカードが見つかりません
                  </div>
                ) : !searchQuery ? (
                  <div className="text-center text-gray-400 py-8">
                    カード名または型番を入力して検索
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 保留リストモーダル */}
      {showPendingModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70]">
          <div className="bg-white rounded-xl w-[700px] max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2">
                <Clock size={20} />
                保留リスト ({pendingCards.length}件)
              </h3>
              <button
                onClick={() => setShowPendingModal(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-auto p-4">
              {pendingCards.length > 0 ? (
                <div className="space-y-4">
                  {pendingCards.map((card, index) => (
                    <div key={index} className="p-4 bg-orange-50 rounded-lg border border-orange-200">
                      <div className="flex items-start gap-4">
                        {/* 画像 */}
                        {card.cardImage && (
                          <img
                            src={card.cardImage}
                            alt={`Pending ${index}`}
                            className="w-20 h-28 object-cover rounded border"
                          />
                        )}
                        
                        {/* 入力フォーム */}
                        <div className="flex-1 space-y-2">
                          <div>
                            <label className="text-xs text-gray-500">カード名（後で検索用）</label>
                            <input
                              type="text"
                              value={card.manualName || ''}
                              onChange={(e) => handlePendingNameChange(index, e.target.value)}
                              placeholder="カード名を入力..."
                              className="w-full px-3 py-2 border rounded-lg"
                            />
                          </div>
                          
                          <div>
                            <label className="text-xs text-gray-500">価格</label>
                            <div className="flex items-center gap-2">
                              <span>¥</span>
                              <input
                                type="number"
                                value={card.price || ''}
                                onChange={(e) => handlePendingPriceChange(index, e.target.value)}
                                className="w-32 px-3 py-2 border rounded-lg text-right"
                              />
                            </div>
                          </div>
                          
                          {card.ocrText && (
                            <div className="text-xs text-gray-400">
                              OCR: {card.ocrText}
                            </div>
                          )}
                        </div>
                        
                        {/* 削除ボタン */}
                        <button
                          onClick={() => handleRemoveFromPending(index)}
                          className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center text-gray-400 py-8">
                  保留中のカードはありません
                </div>
              )}
            </div>
            
            <div className="p-4 border-t bg-gray-50">
              <p className="text-sm text-gray-500 mb-2">
                保留したカードは後でカード検索・追加してから登録できます
              </p>
              <button
                onClick={() => setShowPendingModal(false)}
                className="w-full py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
