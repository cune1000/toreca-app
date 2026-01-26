'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { X, Check, AlertCircle, Loader2, Image, Search, Plus, Grid, Clock, Trash2, Inbox, Sparkles, Filter } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// 状態の選択肢
const CONDITION_OPTIONS = [
  { value: 'normal', label: '素体', color: 'bg-gray-100 text-gray-700' },
  { value: 'psa', label: 'PSA', color: 'bg-purple-100 text-purple-700' },
  { value: 'sealed', label: '未開封', color: 'bg-blue-100 text-blue-700' },
  { value: 'opened', label: '開封済み', color: 'bg-orange-100 text-orange-700' },
];

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

interface RecognizedCard {
  index: number;
  row?: number;
  col?: number;
  price?: number;
  quantity?: number;
  cardImage?: string;
  ocrText?: string;
  name?: string;
  bounding_box?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  matchedCard: CardCandidate | null;
  candidates: CardCandidate[];
  needsReview: boolean;
  error?: string;
  excluded?: boolean;
  condition: string;  // 状態（素体/PSA/未開封/開封済み）
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
  const [imageForOverlay, setImageForOverlay] = useState<string | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [recognizedCards, setRecognizedCards] = useState<RecognizedCard[]>([]);
  const [stats, setStats] = useState<RecognitionStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShop, setSelectedShop] = useState<string>(shop?.id || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  
  // 認識方法
  const [recognitionMethod, setRecognitionMethod] = useState<'gemini' | 'template' | 'ocr'>('gemini');
  
  // テンプレート関連
  const [templates, setTemplates] = useState<GridTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  
  // グローバル状態（全カードに適用）
  const [globalCondition, setGlobalCondition] = useState<string>('normal');
  
  // 検索モーダル用
  const [searchModalIndex, setSearchModalIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CardCandidate[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // 詳細検索フィルター
  const [showFilters, setShowFilters] = useState(false);
  const [filterRarity, setFilterRarity] = useState('');
  const [filterExpansion, setFilterExpansion] = useState('');
  const [rarities, setRarities] = useState<string[]>([]);
  const [expansions, setExpansions] = useState<string[]>([]);
  
  // ホバー中のカードインデックス
  const [hoveredCardIndex, setHoveredCardIndex] = useState<number | null>(null);

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

  // レアリティと収録弾のリストを取得
  useEffect(() => {
    const fetchFilters = async () => {
      const { data: rarityData } = await supabase
        .from('cards')
        .select('rarity')
        .not('rarity', 'is', null);
      
      const { data: expansionData } = await supabase
        .from('cards')
        .select('expansion')
        .not('expansion', 'is', null);

      if (rarityData) {
        const unique = [...new Set(rarityData.map(r => r.rarity).filter(Boolean))];
        setRarities(unique.sort());
      }
      if (expansionData) {
        const unique = [...new Set(expansionData.map(e => e.expansion).filter(Boolean))];
        setExpansions(unique.sort());
      }
    };
    fetchFilters();
  }, []);

  // 画像の読み込み
  useEffect(() => {
    if (imageBase64) {
      setImage(imageBase64);
      setImageForOverlay(imageBase64);
    } else if (imageUrl) {
      convertUrlToBase64(imageUrl);
      setImageForOverlay(imageUrl);
    }
  }, [imageUrl, imageBase64]);

  // shopが渡された場合
  useEffect(() => {
    if (shop?.id) {
      setSelectedShop(shop.id);
    }
  }, [shop]);

  // URLからBase64に変換
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

  // Gemini認識
  const handleGeminiRecognize = async () => {
    if (!image && !imageUrl) return;

    setIsRecognizing(true);
    setError(null);
    setProgress('Gemini AIで画像を解析中...');

    try {
      const response = await fetch('/api/purchase-recognize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: image?.startsWith('data:') ? image.split(',')[1] : image,
          imageUrl: imageUrl,
          tweetText: tweetUrl || ''
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || '認識に失敗しました');
      }

      // Geminiの結果をRecognizedCard形式に変換
      const cards: RecognizedCard[] = data.data.cards.map((card: any, idx: number) => ({
        index: idx,
        price: card.price,
        quantity: card.quantity,
        name: card.name,
        ocrText: card.raw_text,
        bounding_box: card.bounding_box,
        matchedCard: null,
        candidates: [],
        needsReview: true,
        condition: data.data.is_psa ? 'psa' : 'normal'
      }));

      // PSA検出時はグローバル状態も更新
      if (data.data.is_psa) {
        setGlobalCondition('psa');
      }

      setRecognizedCards(cards);
      setStats({
        total: cards.length,
        autoMatched: 0,
        needsReview: cards.length,
        noMatch: 0
      });
      setProgress('');

      // 自動マッチング試行
      await autoMatchCards(cards);
    } catch (err) {
      setError(err instanceof Error ? err.message : '認識に失敗しました');
      setProgress('');
    } finally {
      setIsRecognizing(false);
    }
  };

  // 自動マッチング
  const autoMatchCards = async (cards: RecognizedCard[]) => {
    setProgress('カードをマッチング中...');
    const updatedCards = [...cards];
    let matched = 0;

    for (let i = 0; i < updatedCards.length; i++) {
      const card = updatedCards[i];
      if (!card.name) continue;

      const { data } = await supabase
        .from('cards')
        .select('id, name, image_url, card_number, rarity, expansion')
        .ilike('name', `%${card.name}%`)
        .limit(5);

      if (data && data.length > 0) {
        const candidates = data.map(c => ({
          id: c.id,
          name: c.name,
          cardNumber: c.card_number,
          imageUrl: c.image_url,
          rarity: c.rarity,
          expansion: c.expansion,
          similarity: c.name.toLowerCase() === card.name?.toLowerCase() ? 100 : 80,
          isExactMatch: c.name.toLowerCase() === card.name?.toLowerCase()
        }));

        updatedCards[i] = {
          ...card,
          candidates,
          matchedCard: candidates[0].similarity >= 90 ? candidates[0] : null,
          needsReview: candidates[0].similarity < 90
        };

        if (candidates[0].similarity >= 90) matched++;
      }
    }

    setRecognizedCards(updatedCards);
    setStats({
      total: updatedCards.length,
      autoMatched: matched,
      needsReview: updatedCards.filter(c => c.needsReview && !c.excluded).length,
      noMatch: updatedCards.filter(c => !c.matchedCard && !c.candidates.length).length
    });
    setProgress('');
  };

  // 認識実行
  const handleRecognize = async () => {
    if (recognitionMethod === 'gemini') {
      await handleGeminiRecognize();
    } else if (recognitionMethod === 'template' && selectedTemplate) {
      // 既存のテンプレート認識
      await handleTemplateRecognize();
    } else {
      // 既存のOCR認識
      await handleOcrRecognize();
    }
  };

  // テンプレート認識（既存コード）
  const handleTemplateRecognize = async () => {
    if (!image) return;
    setIsRecognizing(true);
    setProgress('テンプレートで切り抜き中...');

    try {
      const response = await fetch('/api/recognize-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          image,
          templateId: selectedTemplate,
          autoMatchThreshold: 70
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      const cards = data.cards.map((c: any) => ({ ...c, condition: globalCondition }));
      setRecognizedCards(cards);
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : '認識に失敗しました');
    } finally {
      setIsRecognizing(false);
      setProgress('');
    }
  };

  // OCR認識（既存コード）
  const handleOcrRecognize = async () => {
    if (!image) return;
    setIsRecognizing(true);
    setProgress('OCRで解析中...');

    try {
      const response = await fetch('/api/recognize-ocr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, autoMatchThreshold: 80 }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      const cards = data.cards.map((c: any) => ({ ...c, condition: globalCondition }));
      setRecognizedCards(cards);
      setStats(data.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : '認識に失敗しました');
    } finally {
      setIsRecognizing(false);
      setProgress('');
    }
  };

  // カード検索（詳細フィルター対応）
  const handleSearch = async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      let queryBuilder = supabase
        .from('cards')
        .select('id, name, image_url, card_number, rarity, expansion')
        .or(`name.ilike.%${query}%,card_number.ilike.%${query}%`)
        .limit(20);

      // フィルター適用
      if (filterRarity) {
        queryBuilder = queryBuilder.eq('rarity', filterRarity);
      }
      if (filterExpansion) {
        queryBuilder = queryBuilder.eq('expansion', filterExpansion);
      }

      const { data, error } = await queryBuilder;
      
      if (error) throw error;
      
      setSearchResults((data || []).map(card => ({
        id: card.id,
        name: card.name,
        cardNumber: card.card_number,
        imageUrl: card.image_url,
        rarity: card.rarity,
        expansion: card.expansion,
        similarity: 100,
        isExactMatch: true
      })));
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  // デバウンス検索
  useEffect(() => {
    if (searchModalIndex === null) return;
    const timer = setTimeout(() => handleSearch(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery, searchModalIndex, filterRarity, filterExpansion]);

  // カード選択
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

  // 候補から選択
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

  // マッチクリア
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

  // 除外
  const handleExclude = (cardIndex: number) => {
    setRecognizedCards(prev => {
      const updated = [...prev];
      updated[cardIndex] = { ...updated[cardIndex], excluded: true };
      return updated;
    });
  };

  // 状態変更
  const handleConditionChange = (cardIndex: number, condition: string) => {
    setRecognizedCards(prev => {
      const updated = [...prev];
      updated[cardIndex] = { ...updated[cardIndex], condition };
      return updated;
    });
  };

  // グローバル状態を全カードに適用
  const applyGlobalCondition = () => {
    setRecognizedCards(prev => prev.map(card => ({ ...card, condition: globalCondition })));
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

  // 保存
  const handleSave = async () => {
    if (!selectedShop) {
      setError('店舗を選択してください');
      return;
    }

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
        condition: card.condition,
        is_psa: card.condition === 'psa',
        psa_grade: card.condition === 'psa' ? 10 : null,
        recognized_at: new Date().toISOString(),
        tweet_time: tweetTime || null,
        source_image_url: imageUrl || null
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

  // bounding_boxスタイル計算
  const getBoundingBoxStyle = (bbox: RecognizedCard['bounding_box'], isHovered: boolean, isMatched: boolean) => {
    if (!bbox) return {};
    const scale = 1000;
    return {
      position: 'absolute' as const,
      left: `${(bbox.x / scale) * 100}%`,
      top: `${(bbox.y / scale) * 100}%`,
      width: `${(bbox.width / scale) * 100}%`,
      height: `${(bbox.height / scale) * 100}%`,
      border: isMatched ? '3px solid #22c55e' : isHovered ? '3px solid #eab308' : '2px solid #3b82f6',
      backgroundColor: isMatched ? 'rgba(34, 197, 94, 0.2)' : isHovered ? 'rgba(234, 179, 8, 0.3)' : 'rgba(59, 130, 246, 0.1)',
      cursor: 'pointer',
      transition: 'all 0.2s'
    };
  };

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
              <Sparkles size={24} className="text-purple-500" />
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
            {/* 認識方法選択 */}
            <div className="mb-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={18} className="text-purple-600" />
                <span className="font-bold text-purple-700">認識方法</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setRecognitionMethod('gemini')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    recognitionMethod === 'gemini'
                      ? 'bg-purple-500 text-white'
                      : 'bg-white border hover:bg-purple-50'
                  }`}
                >
                  🤖 Gemini AI
                </button>
                <button
                  onClick={() => setRecognitionMethod('template')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    recognitionMethod === 'template'
                      ? 'bg-purple-500 text-white'
                      : 'bg-white border hover:bg-purple-50'
                  }`}
                >
                  <Grid size={16} className="inline mr-1" />
                  テンプレート
                </button>
                <button
                  onClick={() => setRecognitionMethod('ocr')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    recognitionMethod === 'ocr'
                      ? 'bg-purple-500 text-white'
                      : 'bg-white border hover:bg-purple-50'
                  }`}
                >
                  📝 OCR
                </button>
              </div>
              
              {recognitionMethod === 'template' && (
                <select
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  className="w-full mt-2 px-3 py-2 border rounded-lg"
                >
                  <option value="">テンプレートを選択...</option>
                  {templates.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* グローバル状態選択 */}
            <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between mb-2">
                <span className="font-bold text-blue-700 text-sm">カード状態（一括設定）</span>
                <button
                  onClick={applyGlobalCondition}
                  className="text-xs px-2 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  全カードに適用
                </button>
              </div>
              <div className="flex gap-2">
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
            
            {/* 画像表示 */}
            {imageForOverlay ? (
              <div className="relative">
                <img 
                  src={imageForOverlay} 
                  alt="買取表" 
                  className="w-full rounded-lg shadow-lg"
                />
                
                {/* bounding_boxオーバーレイ */}
                {recognizedCards.map((card, idx) => card.bounding_box && (
                  <div
                    key={idx}
                    style={getBoundingBoxStyle(
                      card.bounding_box,
                      hoveredCardIndex === idx,
                      !!card.matchedCard
                    )}
                    onClick={() => setSearchModalIndex(idx)}
                    onMouseEnter={() => setHoveredCardIndex(idx)}
                    onMouseLeave={() => setHoveredCardIndex(null)}
                  >
                    <span className="absolute -top-5 left-0 text-xs bg-blue-600 text-white px-1.5 py-0.5 rounded font-bold">
                      {idx + 1}
                    </span>
                  </div>
                ))}
                
                {!recognizedCards.length && !isRecognizing && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-lg">
                    <button
                      onClick={handleRecognize}
                      disabled={recognitionMethod === 'template' && !selectedTemplate}
                      className="px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 flex items-center gap-2 shadow-lg disabled:opacity-50"
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
              
              <button
                onClick={handleSave}
                disabled={isSaving || !recognizedCards.filter(c => !c.excluded && c.matchedCard && c.price).length}
                className="px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 flex items-center gap-2"
              >
                {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                保存 ({recognizedCards.filter(c => !c.excluded && c.matchedCard && c.price).length}件)
              </button>
            </div>

            {/* エラー・結果表示 */}
            {error && (
              <div className="mx-4 mt-2 p-3 bg-red-50 text-red-600 rounded-lg flex items-center gap-2">
                <AlertCircle size={18} />
                {error}
              </div>
            )}
            {saveResult && (
              <div className="mx-4 mt-2 p-3 bg-green-50 text-green-600 rounded-lg flex items-center gap-2">
                <Check size={18} />
                {saveResult}
              </div>
            )}

            {/* カード一覧 */}
            <div className="flex-1 overflow-auto p-4">
              {recognizedCards.length > 0 ? (
                <div className="space-y-3">
                  {recognizedCards.filter(c => !c.excluded).map((card, index) => (
                    <div
                      key={index}
                      className={`p-3 border rounded-lg transition-colors ${
                        hoveredCardIndex === card.index ? 'border-yellow-500 bg-yellow-50' : ''
                      } ${card.matchedCard ? 'border-green-300 bg-green-50' : 'bg-white'}`}
                      onMouseEnter={() => setHoveredCardIndex(card.index)}
                      onMouseLeave={() => setHoveredCardIndex(null)}
                    >
                      <div className="flex items-start gap-3">
                        {/* 番号 */}
                        <div className="w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                          {card.index + 1}
                        </div>

                        {/* カード情報 */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium truncate">{card.name || '不明'}</span>
                            {card.quantity && (
                              <span className="text-xs text-gray-500">{card.quantity}枚</span>
                            )}
                          </div>

                          {/* 価格入力 */}
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-gray-500">¥</span>
                            <input
                              type="number"
                              value={card.price || ''}
                              onChange={(e) => handlePriceChange(card.index, e.target.value)}
                              className="w-28 px-2 py-1 border rounded text-right font-bold"
                              placeholder="価格"
                            />
                            
                            {/* 状態選択 */}
                            <select
                              value={card.condition}
                              onChange={(e) => handleConditionChange(card.index, e.target.value)}
                              className={`px-2 py-1 rounded text-sm font-medium ${
                                CONDITION_OPTIONS.find(o => o.value === card.condition)?.color || ''
                              }`}
                            >
                              {CONDITION_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          </div>

                          {/* マッチ状態 */}
                          {card.matchedCard ? (
                            <div className="flex items-center gap-2 p-2 bg-green-100 rounded">
                              {card.matchedCard.imageUrl && (
                                <img src={card.matchedCard.imageUrl} alt="" className="w-10 h-14 object-cover rounded" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-green-700 truncate">{card.matchedCard.name}</p>
                                <p className="text-xs text-green-600">
                                  {card.matchedCard.cardNumber && `${card.matchedCard.cardNumber} / `}
                                  {card.matchedCard.rarity && `${card.matchedCard.rarity} / `}
                                  {card.matchedCard.expansion}
                                </p>
                              </div>
                              <button onClick={() => handleClearMatch(card.index)} className="text-xs text-red-500 hover:underline">
                                解除
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setSearchModalIndex(card.index)}
                                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                              >
                                <Search size={14} />
                                カードを検索
                              </button>
                              
                              {card.candidates.length > 0 && (
                                <div className="flex gap-1">
                                  {card.candidates.slice(0, 3).map((c, ci) => (
                                    <button
                                      key={ci}
                                      onClick={() => handleSelectCandidate(card.index, c)}
                                      className="p-1 border rounded hover:bg-blue-50"
                                      title={c.name}
                                    >
                                      {c.imageUrl && <img src={c.imageUrl} alt="" className="w-8 h-10 object-cover rounded" />}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* 除外ボタン */}
                        <button
                          onClick={() => handleExclude(card.index)}
                          className="p-1 text-gray-400 hover:text-red-500"
                          title="除外"
                        >
                          <X size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
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
          <div className="bg-white rounded-xl w-[700px] max-h-[85vh] overflow-hidden flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold">カード検索</h3>
              <button
                onClick={() => {
                  setSearchModalIndex(null);
                  setSearchQuery('');
                  setSearchResults([]);
                  setShowFilters(false);
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4">
              {/* 検索ボックス */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 relative">
                  <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
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

              {/* フィルター */}
              {showFilters && (
                <div className="flex gap-3 mb-3 p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">レアリティ</label>
                    <select
                      value={filterRarity}
                      onChange={(e) => setFilterRarity(e.target.value)}
                      className="w-full px-2 py-1 border rounded text-sm"
                    >
                      <option value="">すべて</option>
                      {rarities.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-xs text-gray-500 mb-1 block">収録弾</label>
                    <select
                      value={filterExpansion}
                      onChange={(e) => setFilterExpansion(e.target.value)}
                      className="w-full px-2 py-1 border rounded text-sm"
                    >
                      <option value="">すべて</option>
                      {expansions.map(e => <option key={e} value={e}>{e}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* 対象カードプレビュー */}
              {recognizedCards[searchModalIndex]?.name && (
                <div className="mb-3 p-2 bg-purple-50 rounded-lg text-sm">
                  <span className="text-purple-600">認識結果: </span>
                  <span className="font-medium">{recognizedCards[searchModalIndex].name}</span>
                </div>
              )}

              {/* 検索結果 */}
              <div className="max-h-[400px] overflow-auto">
                {isSearching ? (
                  <div className="text-center py-8">
                    <Loader2 size={32} className="animate-spin mx-auto text-blue-500" />
                  </div>
                ) : searchResults.length > 0 ? (
                  <div className="grid grid-cols-4 gap-3">
                    {searchResults.map((card) => (
                      <button
                        key={card.id}
                        onClick={() => handleSelectFromSearch(card)}
                        className="p-2 border rounded-lg hover:bg-blue-50 hover:border-blue-300 text-left"
                      >
                        {card.imageUrl && (
                          <img src={card.imageUrl} alt={card.name} className="w-full h-28 object-cover rounded mb-2" />
                        )}
                        <div className="text-xs font-medium truncate">{card.name}</div>
                        <div className="text-xs text-gray-500 truncate">
                          {card.cardNumber && `${card.cardNumber}`}
                          {card.rarity && ` / ${card.rarity}`}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : searchQuery.length >= 2 ? (
                  <div className="text-center text-gray-500 py-8">
                    「{searchQuery}」に一致するカードが見つかりません
                  </div>
                ) : (
                  <div className="text-center text-gray-400 py-8">
                    2文字以上入力で検索
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
