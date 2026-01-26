'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { createClient } from '@supabase/supabase-js';
import { X, Check, AlertCircle, Loader2, Search, Clock, Sparkles, Filter, Globe } from 'lucide-react';

// =============================================================================
// Constants & Types
// =============================================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const CONDITION_OPTIONS = [
  { value: 'normal', label: '素体', color: 'bg-gray-100 text-gray-700' },
  { value: 'psa', label: 'PSA', color: 'bg-purple-100 text-purple-700' },
  { value: 'sealed', label: '未開封', color: 'bg-blue-100 text-blue-700' },
  { value: 'opened', label: '開封済み', color: 'bg-orange-100 text-orange-700' },
] as const;

interface CardCandidate {
  id: string;
  name: string;
  cardNumber?: string;
  imageUrl?: string;
  rarity?: string;
  expansion?: string;
  similarity: number;
  isExactMatch: boolean;
}

// Grounding情報の型定義
interface GroundingInfo {
  official_name?: string;
  card_number?: string;
  expansion?: string;
  rarity?: string;
  confidence?: 'high' | 'medium' | 'low';
  notes?: string;
  search_queries?: string[];
  sources?: { url: string; title: string }[];
}

interface RecognizedCard {
  index: number;
  price?: number;
  quantity?: number;
  name?: string;
  ocrText?: string;
  matchedCard: CardCandidate | null;
  candidates: CardCandidate[];
  needsReview: boolean;
  excluded?: boolean;
  condition: string;
  grounding?: GroundingInfo | null;  // ← Grounding情報追加
}

interface Shop { id: string; name: string; }

interface Props {
  imageUrl?: string;
  imageBase64?: string;
  shop?: Shop;
  tweetTime?: string;
  tweetUrl?: string;
  onClose?: () => void;
  onCompleted?: () => void;
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
  // State
  const [isMounted, setIsMounted] = useState(false);
  const [image, setImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState('');
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [recognizedCards, setRecognizedCards] = useState<RecognizedCard[]>([]);
  const [globalCondition, setGlobalCondition] = useState('normal');
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
  const [saveResult, setSaveResult] = useState<string | null>(null);
  const [groundingStats, setGroundingStats] = useState<{ total: number; high_confidence: number; success_rate: number } | null>(null);

  // Refs
  const abortRef = useRef<AbortController | null>(null);
  const lastUrlRef = useRef<string | null>(null);

  // Computed
  const stats = useMemo(() => ({
    total: recognizedCards.length,
    autoMatched: recognizedCards.filter(c => c.matchedCard && !c.excluded).length,
    needsReview: recognizedCards.filter(c => c.needsReview && !c.excluded).length,
    saveable: recognizedCards.filter(c => !c.excluded && c.matchedCard && c.price).length,
  }), [recognizedCards]);

  const displayImage = image || imageUrl;

  // Callbacks
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
        body: JSON.stringify({ imageUrl: url }),
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

  const handleSearch = useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    try {
      let q = supabase
        .from('cards')
        .select('id, name, image_url, card_number, rarity, expansion')
        .or(`name.ilike.%${query}%,card_number.ilike.%${query}%`)
        .limit(20);
      if (filterRarity) q = q.eq('rarity', filterRarity);
      if (filterExpansion) q = q.eq('expansion', filterExpansion);

      const { data } = await q;
      setSearchResults((data || []).map(c => ({
        id: c.id,
        name: c.name,
        cardNumber: c.card_number,
        imageUrl: c.image_url,
        rarity: c.rarity,
        expansion: c.expansion,
        similarity: 100,
        isExactMatch: true,
      })));
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  }, [filterRarity, filterExpansion]);

  // Grounding情報を活用した改良版マッチング
  const autoMatchCards = useCallback(async (cards: RecognizedCard[]) => {
    setProgress('カードをマッチング中...');
    const updated = [...cards];
    
    for (const card of updated) {
      // 1. まずGrounding情報の型番で検索（最も精度が高い）
      if (card.grounding?.card_number) {
        const { data } = await supabase
          .from('cards')
          .select('id, name, image_url, card_number, rarity, expansion')
          .ilike('card_number', `%${card.grounding.card_number}%`)
          .limit(5);

        if (data?.length) {
          const candidates: CardCandidate[] = data.map(c => ({
            id: c.id,
            name: c.name,
            cardNumber: c.card_number,
            imageUrl: c.image_url,
            rarity: c.rarity,
            expansion: c.expansion,
            similarity: c.card_number === card.grounding?.card_number ? 100 : 90,
            isExactMatch: c.card_number === card.grounding?.card_number,
          }));
          card.candidates = candidates;
          // 型番完全一致なら自動マッチ
          const exactMatch = candidates.find(c => c.isExactMatch);
          if (exactMatch) {
            card.matchedCard = exactMatch;
            card.needsReview = false;
            continue;
          }
        }
      }

      // 2. Grounding情報の正式名称で検索
      if (card.grounding?.official_name) {
        const { data } = await supabase
          .from('cards')
          .select('id, name, image_url, card_number, rarity, expansion')
          .ilike('name', `%${card.grounding.official_name}%`)
          .limit(5);

        if (data?.length) {
          const candidates: CardCandidate[] = data.map(c => ({
            id: c.id,
            name: c.name,
            cardNumber: c.card_number,
            imageUrl: c.image_url,
            rarity: c.rarity,
            expansion: c.expansion,
            similarity: c.name.toLowerCase() === card.grounding?.official_name?.toLowerCase() ? 100 : 85,
            isExactMatch: c.name.toLowerCase() === card.grounding?.official_name?.toLowerCase(),
          }));
          // 既存候補とマージ
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
        const { data } = await supabase
          .from('cards')
          .select('id, name, image_url, card_number, rarity, expansion')
          .ilike('name', `%${card.name}%`)
          .limit(5);

        if (data?.length) {
          const candidates: CardCandidate[] = data.map(c => ({
            id: c.id,
            name: c.name,
            cardNumber: c.card_number,
            imageUrl: c.image_url,
            rarity: c.rarity,
            expansion: c.expansion,
            similarity: c.name.toLowerCase() === card.name?.toLowerCase() ? 100 : 80,
            isExactMatch: c.name.toLowerCase() === card.name?.toLowerCase(),
          }));
          const existingIds = new Set(card.candidates.map(c => c.id));
          card.candidates = [...card.candidates, ...candidates.filter(c => !existingIds.has(c.id))];
          card.matchedCard = candidates[0]?.similarity >= 90 ? candidates[0] : null;
          card.needsReview = !card.matchedCard;
        }
      }
    }
    setRecognizedCards(updated);
    setProgress('');
  }, []);

  // Effects
  useEffect(() => { setIsMounted(true); }, []);

  useEffect(() => {
    supabase.from('purchase_shops').select('id, name').order('name')
      .then(({ data }) => { if (data) setShops(data); });
  }, []);

  useEffect(() => {
    const fetchFilters = async () => {
      const [{ data: r }, { data: e }] = await Promise.all([
        supabase.from('cards').select('rarity').not('rarity', 'is', null),
        supabase.from('cards').select('expansion').not('expansion', 'is', null),
      ]);
      if (r) setRarities([...new Set(r.map(x => x.rarity).filter(Boolean))].sort());
      if (e) setExpansions([...new Set(e.map(x => x.expansion).filter(Boolean))].sort());
    };
    fetchFilters();
  }, []);

  useEffect(() => {
    if (imageBase64) {
      setImage(imageBase64);
    } else if (imageUrl) {
      loadImageAsBase64(imageUrl);
    }
  }, [imageUrl, imageBase64, loadImageAsBase64]);

  useEffect(() => {
    if (shop?.id) setSelectedShop(shop.id);
  }, [shop]);

  useEffect(() => {
    if (searchModalIndex === null) return;
    const timer = setTimeout(() => handleSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchModalIndex, handleSearch]);

  // 検索モーダルを開くときにGrounding情報があれば初期値にセット
  const openSearchModal = (idx: number) => {
    const card = recognizedCards[idx];
    // Grounding情報があれば型番や正式名称を初期クエリに
    const initialQuery = card.grounding?.card_number || card.grounding?.official_name || card.name || '';
    setSearchQuery(initialQuery);
    setSearchModalIndex(idx);
  };

  // Handlers
  const handleRecognize = async () => {
    if (!image && !imageUrl) return;
    setIsRecognizing(true);
    setError(null);
    setProgress('Gemini AIで画像を解析中...');

    try {
      const res = await fetch('/api/purchase-recognize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: image?.startsWith('data:') ? image.split(',')[1] : image,
          imageUrl,
          tweetText: tweetUrl || '',
          enableGrounding: true,  // Grounding有効
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
        condition: data.data.is_psa ? 'psa' : 'normal',
        grounding: c.grounding || null,  // ← Grounding情報を保存
      }));

      if (data.data.is_psa) setGlobalCondition('psa');
      setRecognizedCards(cards);
      setProgress('カード情報を検索中...');
      await autoMatchCards(cards);
    } catch (err) {
      setError(err instanceof Error ? err.message : '認識に失敗しました');
      setProgress('');
    } finally {
      setIsRecognizing(false);
    }
  };

  const handleSelectFromSearch = (candidate: CardCandidate) => {
    if (searchModalIndex === null) return;
    setRecognizedCards(prev => prev.map((c, i) =>
      i === searchModalIndex ? { ...c, matchedCard: candidate, needsReview: false } : c
    ));
    setSearchModalIndex(null);
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleSelectCandidate = (idx: number, candidate: CardCandidate) => {
    setRecognizedCards(prev => prev.map((c, i) =>
      i === idx ? { ...c, matchedCard: candidate, needsReview: false } : c
    ));
  };

  const handleClearMatch = (idx: number) => {
    setRecognizedCards(prev => prev.map((c, i) =>
      i === idx ? { ...c, matchedCard: null, needsReview: c.candidates.length > 0 } : c
    ));
  };

  const handleExclude = (idx: number) => {
    setRecognizedCards(prev => prev.map((c, i) =>
      i === idx ? { ...c, excluded: true } : c
    ));
  };

  const handleConditionChange = (idx: number, condition: string) => {
    setRecognizedCards(prev => prev.map((c, i) =>
      i === idx ? { ...c, condition } : c
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

  // Render
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
              <div className="flex gap-2 flex-wrap">
                {CONDITION_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setGlobalCondition(opt.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      globalCondition === opt.value
                        ? opt.color + ' ring-2 ring-offset-1 ring-blue-500'
                        : 'bg-white border hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 画像（参照用） */}
            {displayImage ? (
              <div className="relative">
                <img src={displayImage} alt="買取表" className="w-full rounded-lg shadow-lg" />
                {!recognizedCards.length && !isRecognizing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
                    <button
                      onClick={handleRecognize}
                      className="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 flex items-center gap-2 shadow-lg"
                    >
                      <Sparkles size={20} />
                      認識開始
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
              <div className="h-64 flex items-center justify-center text-gray-400 bg-gray-100 rounded-lg">
                <Loader2 size={32} className="animate-spin" />
              </div>
            )}
          </div>

          {/* Right: Results */}
          <div className="w-2/3 flex flex-col overflow-hidden">
            {/* 店舗選択 & 保存 */}
            <div className="p-4 border-b flex items-center gap-4 flex-shrink-0">
              <select
                value={selectedShop}
                onChange={e => setSelectedShop(e.target.value)}
                className="flex-1 px-4 py-2 border rounded-lg"
              >
                <option value="">店舗を選択...</option>
                {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button
                onClick={handleSave}
                disabled={isSaving || !stats.saveable}
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
                      className={`p-3 border rounded-lg ${card.matchedCard ? 'border-green-300 bg-green-50' : 'bg-white'}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 bg-blue-600 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {card.index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-sm truncate">{card.name || '不明'}</span>
                            {card.quantity && <span className="text-xs text-gray-500">{card.quantity}枚</span>}
                          </div>
                          
                          {/* Grounding情報表示 */}
                          {card.grounding && card.grounding.confidence && (
                            <div className={`mb-2 p-1.5 rounded text-xs ${
                              card.grounding.confidence === 'high' 
                                ? 'bg-blue-50 border border-blue-200' 
                                : card.grounding.confidence === 'medium'
                                ? 'bg-yellow-50 border border-yellow-200'
                                : 'bg-gray-50 border border-gray-200'
                            }`}>
                              <div className="flex items-center gap-1 mb-0.5">
                                <Globe size={10} className={
                                  card.grounding.confidence === 'high' ? 'text-blue-500' :
                                  card.grounding.confidence === 'medium' ? 'text-yellow-500' : 'text-gray-400'
                                } />
                                <span className={`font-medium ${
                                  card.grounding.confidence === 'high' ? 'text-blue-700' :
                                  card.grounding.confidence === 'medium' ? 'text-yellow-700' : 'text-gray-600'
                                }`}>
                                  {card.grounding.official_name || card.name}
                                </span>
                              </div>
                              <div className="text-gray-500 truncate">
                                {[card.grounding.card_number, card.grounding.rarity, card.grounding.expansion]
                                  .filter(Boolean).join(' / ')}
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-gray-500 text-sm">¥</span>
                            <input
                              type="number"
                              value={card.price || ''}
                              onChange={e => handlePriceChange(card.index, e.target.value)}
                              className="w-24 px-2 py-1 border rounded text-right font-bold text-sm"
                              placeholder="価格"
                            />
                            <select
                              value={card.condition}
                              onChange={e => handleConditionChange(card.index, e.target.value)}
                              className={`px-2 py-1 rounded text-xs font-medium ${
                                CONDITION_OPTIONS.find(o => o.value === card.condition)?.color || ''
                              }`}
                            >
                              {CONDITION_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                          {card.matchedCard ? (
                            <div className="flex items-center gap-2 p-2 bg-green-100 rounded">
                              {card.matchedCard.imageUrl && (
                                <img src={card.matchedCard.imageUrl} alt="" className="w-8 h-11 object-cover rounded" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-green-700 truncate">{card.matchedCard.name}</p>
                                <p className="text-xs text-green-600 truncate">
                                  {[card.matchedCard.cardNumber, card.matchedCard.rarity].filter(Boolean).join(' / ')}
                                </p>
                              </div>
                              <button onClick={() => handleClearMatch(card.index)} className="text-xs text-red-500 hover:underline">
                                解除
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 flex-wrap">
                              <button
                                onClick={() => openSearchModal(card.index)}
                                className="text-xs text-blue-600 hover:underline flex items-center gap-1"
                              >
                                <Search size={12} />検索
                              </button>
                              {card.candidates.slice(0, 3).map((c, i) => (
                                <button
                                  key={i}
                                  onClick={() => handleSelectCandidate(card.index, c)}
                                  className="p-0.5 border rounded hover:bg-blue-50"
                                  title={c.name}
                                >
                                  {c.imageUrl && <img src={c.imageUrl} alt="" className="w-6 h-8 object-cover rounded" />}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => handleExclude(card.index)}
                          className="p-1 text-gray-400 hover:text-red-500"
                          title="除外"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">
                  左の画像を認識すると結果がここに表示されます
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Search Modal */}
      {searchModalIndex !== null && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70]">
          <div className="bg-white rounded-xl w-[700px] max-h-[85vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold">カード検索</h3>
              <button
                onClick={() => { setSearchModalIndex(null); setSearchQuery(''); setSearchResults([]); setShowFilters(false); }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 relative">
                  <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="カード名または型番で検索..."
                    className="w-full pl-10 pr-3 py-2 border rounded-lg"
                    autoFocus
                  />
                </div>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`p-2 border rounded-lg ${showFilters ? 'bg-blue-50 border-blue-300' : ''}`}
                >
                  <Filter size={20} />
                </button>
              </div>

              {showFilters && (
                <div className="flex gap-3 mb-3 p-3 bg-gray-50 rounded-lg">
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
