'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { X, Check, AlertCircle, Loader2, Search, Clock, Sparkles, Filter, Globe, Inbox } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { addPendingCardsFromRecognition, addPendingImage } from '@/lib/api/pending';
import { searchCards, searchByCardNumber } from '@/lib/api/cards';
import { getShops } from '@/lib/api/shops';
import type { 
  RecognizedCard, 
  CardCandidate, 
  GroundingInfo, 
  Shop,
  CardCondition,
  CONDITION_OPTIONS 
} from '@/lib/types';

// =============================================================================
// Constants
// =============================================================================

const CONDITION_OPTIONS_LOCAL = [
  { value: 'normal' as const, label: '素体', color: 'bg-gray-100 text-gray-700' },
  { value: 'psa' as const, label: 'PSA', color: 'bg-purple-100 text-purple-700' },
  { value: 'sealed' as const, label: '未開封', color: 'bg-blue-100 text-blue-700' },
  { value: 'opened' as const, label: '開封済み', color: 'bg-orange-100 text-orange-700' },
] as const;

// =============================================================================
// Types
// =============================================================================

interface Props {
  imageUrl?: string;
  imageBase64?: string;
  shop?: Shop | null;
  tweetTime?: string;
  tweetUrl?: string;
  onClose?: () => void;
  onCompleted?: () => void;
}

interface GroundingStats {
  total: number;
  high_confidence: number;
  success_rate: number;
}

// =============================================================================
// Component
// =============================================================================

export default function BulkRecognition({
  imageUrl,
  imageBase64,
  shop,
  tweetTime,
  tweetUrl,
  onClose,
  onCompleted,
}: Props) {
  // =============================================================================
  // State
  // =============================================================================
  
  const [isMounted, setIsMounted] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [recognizedCards, setRecognizedCards] = useState<RecognizedCard[]>([]);
  const [globalCondition, setGlobalCondition] = useState<CardCondition>('normal');
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShop, setSelectedShop] = useState(shop?.id || '');
  const [searchModalIndex, setSearchModalIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CardCandidate[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filterRarity, setFilterRarity] = useState('');
  const [filterExpansion, setFilterExpansion] = useState('');
  const [rarities, setRarities] = useState<string[]>([]);
  const [expansions, setExpansions] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingPending, setIsSavingPending] = useState(false);
  const [saveResult, setSaveResult] = useState<string | null>(null);
  const [groundingStats, setGroundingStats] = useState<GroundingStats | null>(null);

  // Refs
  const abortRef = useRef<AbortController | null>(null);
  const lastUrlRef = useRef<string | null>(null);

  // =============================================================================
  // Computed
  // =============================================================================
  
  const stats = useMemo(() => ({
    total: recognizedCards.length,
    autoMatched: recognizedCards.filter(c => c.matchedCard && !c.excluded).length,
    needsReview: recognizedCards.filter(c => c.needsReview && !c.excluded).length,
    saveable: recognizedCards.filter(c => !c.excluded && c.matchedCard && c.price).length,
    pendingCount: recognizedCards.filter(c => !c.excluded && !c.matchedCard).length,
  }), [recognizedCards]);

  const displayImage = image || imageUrl;

  // =============================================================================
  // Effects
  // =============================================================================

  useEffect(() => {
    setIsMounted(true);
    fetchShops();
    fetchFilters();
  }, []);

  useEffect(() => {
    if (imageBase64) {
      setImage(imageBase64);
    } else if (imageUrl) {
      loadImageAsBase64(imageUrl);
    }
  }, [imageUrl, imageBase64]);

  useEffect(() => {
    if (!searchModalIndex) return;
    const timer = setTimeout(() => {
      if (searchQuery.length >= 2) handleSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchModalIndex]);

  // =============================================================================
  // Data Fetching
  // =============================================================================

  const fetchShops = async () => {
    const data = await getShops();
    setShops(data);
  };

  const fetchFilters = async () => {
    const { data: cardData } = await supabase
      .from('cards')
      .select('rarity, expansion')
      .not('rarity', 'is', null);
    
    if (cardData) {
      const uniqueRarities = [...new Set(cardData.map(c => c.rarity).filter(Boolean))];
      const uniqueExpansions = [...new Set(cardData.map(c => c.expansion).filter(Boolean))];
      setRarities(uniqueRarities as string[]);
      setExpansions(uniqueExpansions as string[]);
    }
  };

  // =============================================================================
  // Image Loading
  // =============================================================================

  const loadImageAsBase64 = useCallback(async (url: string) => {
    if (lastUrlRef.current === url) return;
    lastUrlRef.current = url;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch('/api/image-proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, returnBase64: true }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`image-proxy: ${res.status}`);
      const data = await res.json();
      if (data.success && data.base64) {
        setImage(data.base64);
      } else {
        throw new Error('Failed to load image');
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      console.error('画像変換エラー:', err);
      setError('画像の読み込みに失敗しました');
    }
  }, []);

  // =============================================================================
  // Search
  // =============================================================================

  const handleSearch = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      let results = await searchCards(query, 20);
      
      // フィルタ適用
      if (filterRarity) {
        results = results.filter(c => c.rarity === filterRarity);
      }
      if (filterExpansion) {
        results = results.filter(c => c.expansion === filterExpansion);
      }
      
      setSearchResults(results);
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  }, [filterRarity, filterExpansion]);

  // =============================================================================
  // Matching (3段階: 型番 → 正式名称 → 認識名)
  // =============================================================================

  const autoMatchCards = useCallback(async (cards: RecognizedCard[]) => {
    setProgress('カードをマッチング中...');
    const updated = [...cards];
    
    for (const card of updated) {
      // 既にマッチ済みならスキップ
      if (card.matchedCard) continue;
      
      // 1. Grounding型番で検索（最高精度）
      if (card.grounding?.card_number) {
        const candidates = await searchByCardNumber(card.grounding.card_number);
        
        if (candidates.length > 0) {
          card.candidates = candidates;
          const exactMatch = candidates.find(c => c.isExactMatch);
          if (exactMatch) {
            card.matchedCard = exactMatch;
            card.needsReview = false;
            continue;
          }
        }
      }

      // 2. Grounding正式名称で検索
      if (card.grounding?.official_name) {
        const candidates = await searchCards(card.grounding.official_name, 5);
        
        if (candidates.length > 0) {
          const existingIds = new Set(card.candidates.map(c => c.id));
          card.candidates = [...card.candidates, ...candidates.filter(c => !existingIds.has(c.id))];
          
          if (!card.matchedCard && candidates[0]?.similarity >= 90) {
            card.matchedCard = candidates[0];
            card.needsReview = false;
            continue;
          }
        }
      }

      // 3. 元の認識名で検索（フォールバック）
      if (!card.matchedCard && card.name) {
        const candidates = await searchCards(card.name, 5);
        
        if (candidates.length > 0) {
          const existingIds = new Set(card.candidates.map(c => c.id));
          card.candidates = [...card.candidates, ...candidates.filter(c => !existingIds.has(c.id))];
          card.matchedCard = candidates[0]?.similarity >= 90 ? candidates[0] : null;
          card.needsReview = !card.matchedCard;
        }
      }
      
      // マッチしなかった場合
      if (!card.matchedCard) {
        card.needsReview = true;
      }
    }
    
    setRecognizedCards(updated);
    setProgress('');
  }, []);

  // =============================================================================
  // Recognition
  // =============================================================================

  const handleRecognize = async () => {
    if (!image && !imageUrl) return;
    
    setIsRecognizing(true);
    setError(null);
    setProgress('画像を認識中...');
    setSaveResult(null);
    
    try {
      const res = await fetch('/api/recognize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: image?.startsWith('data:') ? image.split(',')[1] : image,
          imageUrl,
          tweetText: tweetUrl || '',
          enableGrounding: true,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || '認識に失敗しました');

      // Grounding統計を保存
      if (data.data.grounding_stats) {
        setGroundingStats(data.data.grounding_stats);
      }

      const cards: RecognizedCard[] = data.data.cards.map((c: any, i: number) => ({
        index: i,
        price: c.price,
        quantity: c.quantity,
        name: c.name,
        ocrText: c.raw_text,
        matchedCard: null,
        candidates: [],
        needsReview: true,
        excluded: false,
        condition: data.data.is_psa ? 'psa' : 'normal',
        grounding: c.grounding || null,
      }));

      if (data.data.is_psa) {
        setGlobalCondition('psa');
      }

      setRecognizedCards(cards);
      await autoMatchCards(cards);
    } catch (err) {
      setError(err instanceof Error ? err.message : '認識に失敗しました');
    } finally {
      setIsRecognizing(false);
      setProgress('');
    }
  };

  // =============================================================================
  // Card Actions
  // =============================================================================

  const handleSelectFromSearch = (card: CardCandidate) => {
    if (searchModalIndex === null) return;
    setRecognizedCards(prev => prev.map((c, i) =>
      i === searchModalIndex
        ? { ...c, matchedCard: card, needsReview: false }
        : c
    ));
    setSearchModalIndex(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  const openSearchModal = (idx: number) => {
    const card = recognizedCards[idx];
    // Grounding情報があれば初期クエリに
    const initialQuery = card.grounding?.card_number || card.grounding?.official_name || card.name || '';
    setSearchQuery(initialQuery);
    setSearchModalIndex(idx);
  };

  const handleExclude = (idx: number) => {
    setRecognizedCards(prev => prev.map((c, i) =>
      i === idx ? { ...c, excluded: true } : c
    ));
  };

  const handleConditionChange = (idx: number, condition: string) => {
    setRecognizedCards(prev => prev.map((c, i) =>
      i === idx ? { ...c, condition: condition as CardCondition } : c
    ));
  };

  const handlePriceChange = (idx: number, price: string) => {
    setRecognizedCards(prev => prev.map((c, i) =>
      i === idx ? { ...c, price: price ? parseInt(price, 10) : undefined } : c
    ));
  };

  const applyGlobalCondition = () => {
    setRecognizedCards(prev => prev.map(c => ({ ...c, condition: globalCondition })));
  };

  // =============================================================================
  // Save Functions
  // =============================================================================

  const handleSave = async () => {
    if (!selectedShop) return setError('店舗を選択してください');
    const toSave = recognizedCards.filter(c => !c.excluded && c.matchedCard && c.price);
    if (!toSave.length) return setError('保存するカードがありません');

    setIsSaving(true);
    setError(null);
    try {
      const records = toSave.map(c => ({
        card_id: c.matchedCard!.id,
        shop_id: selectedShop,
        price: c.price,
        condition: c.condition,
        is_psa: c.condition === 'psa',
        psa_grade: c.condition === 'psa' ? 10 : null,
        recognized_at: new Date().toISOString(),
        tweet_time: tweetTime || null,
        source_image_url: imageUrl || null,
      }));
      const { error: err } = await supabase.from('purchase_prices').insert(records);
      if (err) throw err;
      setSaveResult(`${records.length}件の買取価格を保存しました`);
      if (onCompleted) setTimeout(onCompleted, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存に失敗しました');
    } finally {
      setIsSaving(false);
    }
  };

  // 保留に追加
  const handleSaveToPending = async () => {
    if (!selectedShop) return setError('店舗を選択してください');
    
    const unmatchedCards = recognizedCards.filter(c => !c.excluded && !c.matchedCard);
    if (!unmatchedCards.length) return setError('保留に追加するカードがありません');

    setIsSavingPending(true);
    setError(null);
    try {
      const { success, failed } = await addPendingCardsFromRecognition({
        shop_id: selectedShop,
        cards: unmatchedCards,
        tweet_time: tweetTime,
      });
      
      if (success > 0) {
        setSaveResult(`${success}件を保留に追加しました`);
        // 保留に追加したカードを除外
        setRecognizedCards(prev => prev.map(c => 
          !c.excluded && !c.matchedCard ? { ...c, excluded: true } : c
        ));
      }
      if (failed > 0) {
        setError(`${failed}件の保存に失敗しました`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '保留への追加に失敗しました');
    } finally {
      setIsSavingPending(false);
    }
  };

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div className="bg-white rounded-2xl w-[95vw] h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Sparkles size={24} className="text-purple-500" />
              買取表認識
            </h2>
            {isMounted && tweetTime && (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Clock size={16} />
                <span>{new Date(tweetTime).toLocaleString('ja-JP')}</span>
              </div>
            )}
            {stats.total > 0 && (
              <div className="flex items-center gap-3 text-sm">
                <span className="text-gray-600">{stats.total}件</span>
                <span className="text-green-600">{stats.autoMatched}マッチ</span>
                <span className="text-yellow-600">{stats.needsReview}要確認</span>
              </div>
            )}
            {/* Grounding統計表示 */}
            {groundingStats && (
              <div className="flex items-center gap-2 text-sm bg-blue-50 px-3 py-1 rounded-full">
                <Globe size={14} className="text-blue-500" />
                <span className="text-blue-700">
                  Grounding: {groundingStats.success_rate}% ({groundingStats.high_confidence}/{groundingStats.total})
                </span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={24} />
          </button>
        </div>

        {/* Main */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left: Image */}
          <div className="w-1/3 p-4 border-r overflow-auto bg-gray-50">
            {/* 状態一括設定 */}
            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-blue-700 text-sm">カード状態</span>
                <button
                  onClick={applyGlobalCondition}
                  className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  全カードに適用
                </button>
              </div>
              <div className="flex gap-2">
                {CONDITION_OPTIONS_LOCAL.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setGlobalCondition(opt.value)}
                    className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-colors ${
                      globalCondition === opt.value
                        ? opt.color.replace('100', '500').replace('700', 'white') + ' text-white'
                        : opt.color
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Image Display */}
            {displayImage ? (
              <img
                src={displayImage}
                alt="買取表"
                className="w-full rounded-lg border"
              />
            ) : (
              <div className="aspect-video bg-gray-200 rounded-lg flex items-center justify-center">
                <span className="text-gray-400">画像なし</span>
              </div>
            )}

            {/* Recognize Button */}
            {recognizedCards.length === 0 && (
              <button
                onClick={handleRecognize}
                disabled={isRecognizing || !displayImage}
                className="w-full mt-4 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isRecognizing ? (
                  <>
                    <Loader2 size={20} className="animate-spin" />
                    {progress || '認識中...'}
                  </>
                ) : (
                  <>
                    <Sparkles size={20} />
                    AI認識を開始
                  </>
                )}
              </button>
            )}
          </div>

          {/* Right: Results */}
          <div className="w-2/3 flex flex-col overflow-hidden">
            {/* 店舗選択 & ボタン */}
            <div className="p-4 border-b flex items-center gap-3 flex-shrink-0">
              <select
                value={selectedShop}
                onChange={e => setSelectedShop(e.target.value)}
                className="flex-1 px-4 py-2 border rounded-lg"
              >
                <option value="">店舗を選択...</option>
                {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              
              {/* 保留に追加ボタン */}
              <button
                onClick={handleSaveToPending}
                disabled={isSavingPending || !stats.pendingCount || !selectedShop}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 flex items-center gap-2"
              >
                {isSavingPending ? <Loader2 size={18} className="animate-spin" /> : <Inbox size={18} />}
                保留 ({stats.pendingCount}件)
              </button>
              
              {/* 保存ボタン */}
              <button
                onClick={handleSave}
                disabled={isSaving || !stats.saveable || !selectedShop}
                className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                保存 ({stats.saveable}件)
              </button>
            </div>

            {/* Messages */}
            {error && (
              <div className="mx-4 mt-2 p-3 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
                <AlertCircle size={18} />{error}
              </div>
            )}
            {saveResult && (
              <div className="mx-4 mt-2 p-3 bg-green-50 text-green-600 rounded-lg flex items-center gap-2">
                <Check size={18} />{saveResult}
              </div>
            )}

            {/* Card List */}
            <div className="flex-1 overflow-auto p-4">
              {recognizedCards.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {recognizedCards.filter(c => !c.excluded).map(card => (
                    <div
                      key={card.index}
                      className={`p-3 border rounded-lg ${
                        card.matchedCard 
                          ? 'border-green-300 bg-green-50' 
                          : 'border-orange-300 bg-orange-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`w-7 h-7 ${card.matchedCard ? 'bg-green-600' : 'bg-orange-500'} text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0`}>
                          {card.index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          {/* Grounding情報表示 */}
                          {card.grounding && card.grounding.confidence && (
                            <div className={`mb-2 p-1.5 rounded text-xs ${
                              card.grounding.confidence === 'high' 
                                ? 'bg-blue-50 border border-blue-200' 
                                : card.grounding.confidence === 'medium'
                                ? 'bg-yellow-50 border border-yellow-200'
                                : 'bg-gray-50 border border-gray-200'
                            }`}>
                              <div className="flex items-center gap-1">
                                <Globe size={10} className="text-blue-500" />
                                <span className="font-medium">{card.grounding.official_name || card.name}</span>
                              </div>
                              <div className="text-gray-500 mt-0.5">
                                {[card.grounding.card_number, card.grounding.rarity, card.grounding.expansion]
                                  .filter(Boolean).join(' / ')}
                              </div>
                            </div>
                          )}
                          
                          {/* カード名 */}
                          <div className="font-medium text-gray-800 truncate">
                            {card.matchedCard?.name || card.name || '不明'}
                          </div>
                          
                          {/* マッチしたカード情報 */}
                          {card.matchedCard && (
                            <div className="flex items-center gap-2 mt-1">
                              {card.matchedCard.imageUrl && (
                                <img 
                                  src={card.matchedCard.imageUrl} 
                                  alt="" 
                                  className="w-10 h-14 object-cover rounded"
                                />
                              )}
                              <div className="text-xs text-gray-500">
                                {card.matchedCard.cardNumber && <div>{card.matchedCard.cardNumber}</div>}
                                {card.matchedCard.rarity && <div>{card.matchedCard.rarity}</div>}
                              </div>
                            </div>
                          )}
                          
                          {/* 価格・状態 */}
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-sm">¥</span>
                            <input
                              type="number"
                              value={card.price || ''}
                              onChange={e => handlePriceChange(card.index, e.target.value)}
                              className="w-24 px-2 py-1 border rounded text-right text-sm"
                            />
                            <select
                              value={card.condition}
                              onChange={e => handleConditionChange(card.index, e.target.value)}
                              className="px-2 py-1 border rounded text-xs"
                            >
                              {CONDITION_OPTIONS_LOCAL.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                          
                          {/* アクションボタン */}
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => openSearchModal(card.index)}
                              className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600 flex items-center gap-1"
                            >
                              <Search size={12} />
                              検索
                            </button>
                            <button
                              onClick={() => handleExclude(card.index)}
                              className="px-2 py-1 text-red-500 text-xs hover:bg-red-50 rounded"
                            >
                              除外
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : !isRecognizing ? (
                <div className="h-full flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <Sparkles size={48} className="mx-auto mb-4 opacity-50" />
                    <p>「AI認識を開始」ボタンで買取表を解析します</p>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Search Modal */}
      {searchModalIndex !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70]">
          <div className="bg-white rounded-xl w-[700px] max-h-[80vh] flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold">カード検索</h3>
              <button
                onClick={() => { setSearchModalIndex(null); setSearchQuery(''); setSearchResults([]); }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 overflow-auto">
              <div className="flex gap-2 mb-3">
                <div className="relative flex-1">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="カード名・型番で検索..."
                    className="w-full pl-10 pr-4 py-2 border rounded-lg"
                    autoFocus
                  />
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`px-3 py-2 border rounded-lg ${showFilters ? 'bg-blue-50 border-blue-300' : ''}`}
                >
                  <Filter size={18} />
                </button>
              </div>

              {showFilters && (
                <div className="flex gap-3 mb-3">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">レアリティ</label>
                    <select value={filterRarity} onChange={e => setFilterRarity(e.target.value)} className="w-full px-2 py-1 border rounded text-sm">
                      <option value="">すべて</option>
                      {rarities.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">収録弾</label>
                    <select value={filterExpansion} onChange={e => setFilterExpansion(e.target.value)} className="w-full px-2 py-1 border rounded text-sm">
                      <option value="">すべて</option>
                      {expansions.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* 認識結果 + Grounding情報 */}
              {recognizedCards[searchModalIndex] && (
                <div className="mb-3 p-2 bg-purple-50 rounded-lg text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-purple-600">認識結果: </span>
                    <span className="font-medium">{recognizedCards[searchModalIndex].name}</span>
                  </div>
                  {recognizedCards[searchModalIndex].grounding && (
                    <div className="mt-1 flex items-center gap-2 text-xs text-blue-600">
                      <Globe size={12} />
                      <span>Grounding: {recognizedCards[searchModalIndex].grounding?.official_name}</span>
                      {recognizedCards[searchModalIndex].grounding?.card_number && (
                        <span className="text-gray-500">({recognizedCards[searchModalIndex].grounding?.card_number})</span>
                      )}
                    </div>
                  )}
                </div>
              )}

              <div className="max-h-[400px] overflow-auto">
                {isSearching ? (
                  <div className="text-center py-8"><Loader2 size={32} className="animate-spin mx-auto text-blue-500" /></div>
                ) : searchResults.length > 0 ? (
                  <div className="grid grid-cols-4 gap-3">
                    {searchResults.map(card => (
                      <button
                        key={card.id}
                        onClick={() => handleSelectFromSearch(card)}
                        className="p-2 border rounded-lg hover:bg-blue-50 hover:border-blue-300 text-left"
                      >
                        {card.imageUrl && <img src={card.imageUrl} alt={card.name} className="w-full h-28 object-cover rounded mb-2" />}
                        <div className="text-xs font-medium truncate">{card.name}</div>
                        <div className="text-xs text-gray-500 truncate">
                          {[card.cardNumber, card.rarity].filter(Boolean).join(' / ')}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : searchQuery.length >= 2 ? (
                  <div className="text-center text-gray-500 py-8">「{searchQuery}」に一致するカードが見つかりません</div>
                ) : (
                  <div className="text-center text-gray-400 py-8">2文字以上入力で検索</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
