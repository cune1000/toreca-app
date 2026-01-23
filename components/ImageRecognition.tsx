'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { X, Loader2, Check, AlertCircle } from 'lucide-react';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface CardCandidate {
  id: string;
  name: string;
  cardNumber?: string;
  rarity?: string;
  imageUrl?: string;
  similarity: number;
  isExactMatch: boolean;
}

interface RecognitionResult {
  name: string;
  cardNumber?: string;
  rarity?: string;
  series?: string;
  confidence?: number;
  matchedCard?: CardCandidate | null;
  candidates?: CardCandidate[];
  needsReview?: boolean;
}

interface Category {
  id: string;
  name: string;
}

interface Rarity {
  id: string;
  name: string;
}

interface Props {
  onClose: () => void;
  onRecognized?: () => void;
}

export default function ImageRecognition({ onClose, onRecognized }: Props) {
  const [image, setImage] = useState<string | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [result, setResult] = useState<RecognitionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedCard, setSelectedCard] = useState<CardCandidate | null>(null);
  
  // カード登録用
  const [isRegistering, setIsRegistering] = useState(false);
  const [categories, setCategories] = useState<{
    large: Category[];
    medium: Category[];
    small: Category[];
  }>({ large: [], medium: [], small: [] });
  const [rarities, setRarities] = useState<Rarity[]>([]);
  const [formData, setFormData] = useState({
    name: '',
    cardNumber: '',
    categoryLargeId: '',
    categoryMediumId: '',
    categorySmallId: '',
    rarityId: ''
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // カテゴリ・レアリティ取得
  useEffect(() => {
    const fetchMasterData = async () => {
      const [largeRes, raritiesRes] = await Promise.all([
        supabase.from('category_large').select('id, name').order('name'),
        supabase.from('rarities').select('id, name').order('name')
      ]);
      
      if (largeRes.data) {
        setCategories(prev => ({ ...prev, large: largeRes.data }));
      }
      if (raritiesRes.data) {
        setRarities(raritiesRes.data);
      }
    };
    fetchMasterData();
  }, []);

  // 大カテゴリ変更時
  const handleLargeCategoryChange = async (id: string) => {
    setFormData(prev => ({ 
      ...prev, 
      categoryLargeId: id, 
      categoryMediumId: '', 
      categorySmallId: '' 
    }));
    
    if (id) {
      const { data } = await supabase
        .from('category_medium')
        .select('id, name')
        .eq('category_large_id', id)
        .order('name');
      setCategories(prev => ({ ...prev, medium: data || [], small: [] }));
    } else {
      setCategories(prev => ({ ...prev, medium: [], small: [] }));
    }
  };

  // 中カテゴリ変更時
  const handleMediumCategoryChange = async (id: string) => {
    setFormData(prev => ({ ...prev, categoryMediumId: id, categorySmallId: '' }));
    
    if (id) {
      const { data } = await supabase
        .from('category_small')
        .select('id, name')
        .eq('category_medium_id', id)
        .order('name');
      setCategories(prev => ({ ...prev, small: data || [] }));
    } else {
      setCategories(prev => ({ ...prev, small: [] }));
    }
  };

  // 画像選択
  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setImage(event.target?.result as string);
      setResult(null);
      setSelectedCard(null);
      setError(null);
    };
    reader.readAsDataURL(file);
  }, []);

  // 認識実行
  const handleRecognize = async () => {
    if (!image) return;

    setIsRecognizing(true);
    setError(null);

    try {
      const response = await fetch('/api/recognize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, matchWithDb: true }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || '認識に失敗しました');
      }

      setResult(data);
      
      // 自動マッチした場合
      if (data.matchedCard) {
        setSelectedCard(data.matchedCard);
      }
      
      // フォームに認識結果をセット
      setFormData(prev => ({
        ...prev,
        name: data.name || '',
        cardNumber: data.cardNumber || ''
      }));

      // レアリティをマッチ
      if (data.rarity && rarities.length > 0) {
        const matchedRarity = rarities.find(r => 
          r.name.toLowerCase() === data.rarity?.toLowerCase()
        );
        if (matchedRarity) {
          setFormData(prev => ({ ...prev, rarityId: matchedRarity.id }));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '認識に失敗しました');
    } finally {
      setIsRecognizing(false);
    }
  };

  // 候補を選択
  const handleSelectCandidate = (candidate: CardCandidate) => {
    setSelectedCard(candidate);
  };

  // 新規カード登録
  const handleRegister = async () => {
    if (!formData.name) {
      setError('カード名は必須です');
      return;
    }

    setIsRegistering(true);
    setError(null);

    try {
      // 画像をアップロード
      let imageUrl = null;
      if (image) {
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            image, 
            fileName: `card_${Date.now()}.jpg` 
          }),
        });
        const uploadData = await uploadRes.json();
        if (uploadData.success) {
          imageUrl = uploadData.url;
        }
      }

      // カード登録
      const { error: insertError } = await supabase
        .from('cards')
        .insert({
          name: formData.name,
          card_number: formData.cardNumber || null,
          category_small_id: formData.categorySmallId || null,
          rarity_id: formData.rarityId || null,
          image_url: imageUrl
        });

      if (insertError) throw insertError;

      alert('カードを登録しました');
      
      // コールバック
      onRecognized?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '登録に失敗しました');
    } finally {
      setIsRegistering(false);
    }
  };

  // 類似度に応じた色
  const getSimilarityColor = (similarity: number) => {
    if (similarity >= 90) return 'text-green-600 bg-green-100';
    if (similarity >= 70) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-[800px] max-h-[90vh] overflow-auto">
        {/* ヘッダー */}
        <div className="p-4 border-b flex items-center justify-between sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold">カード画像認識</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 画像選択 */}
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            
            {image ? (
              <div className="space-y-4">
                <img
                  src={image}
                  alt="カード画像"
                  className="max-h-64 mx-auto rounded-lg shadow"
                />
                <div className="flex justify-center gap-4">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 text-gray-600 border rounded hover:bg-gray-50"
                  >
                    画像を変更
                  </button>
                  <button
                    onClick={handleRecognize}
                    disabled={isRecognizing}
                    className="px-6 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isRecognizing ? (
                      <>
                        <Loader2 size={18} className="animate-spin" />
                        認識中...
                      </>
                    ) : (
                      'AIで認識する'
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-12 text-gray-500 hover:text-gray-700"
              >
                クリックしてカード画像を選択
              </button>
            )}
          </div>

          {/* エラー */}
          {error && (
            <div className="p-4 bg-red-100 text-red-700 rounded-lg flex items-center gap-2">
              <AlertCircle size={20} />
              {error}
            </div>
          )}

          {/* 認識結果 */}
          {result && (
            <div className="space-y-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <h3 className="font-semibold mb-2">AI認識結果</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>カード名: <span className="font-medium">{result.name}</span></div>
                  <div>カード番号: <span className="font-medium">{result.cardNumber || '-'}</span></div>
                  <div>レアリティ: <span className="font-medium">{result.rarity || '-'}</span></div>
                  <div>確信度: <span className="font-medium">{result.confidence || '-'}%</span></div>
                </div>
              </div>

              {/* マッチ状態 */}
              {selectedCard ? (
                <div className="p-4 border-2 border-green-300 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-4">
                    {selectedCard.imageUrl && (
                      <img
                        src={selectedCard.imageUrl}
                        alt=""
                        className="w-16 h-16 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <div className="font-medium">{selectedCard.name}</div>
                      <div className="text-sm text-gray-600">
                        {selectedCard.cardNumber && `${selectedCard.cardNumber} / `}
                        {selectedCard.rarity}
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded ${getSimilarityColor(selectedCard.similarity)}`}>
                      {selectedCard.similarity}% マッチ
                    </span>
                    <button
                      onClick={() => setSelectedCard(null)}
                      className="text-red-600 hover:underline text-sm"
                    >
                      解除
                    </button>
                  </div>
                  <div className="mt-3 text-sm text-green-700 flex items-center gap-2">
                    <Check size={16} />
                    このカードはDBに登録済みです
                  </div>
                </div>
              ) : result.candidates && result.candidates.length > 0 ? (
                <div className="p-4 border-2 border-yellow-300 bg-yellow-50 rounded-lg">
                  <div className="font-medium mb-3">候補から選択してください:</div>
                  <div className="space-y-2">
                    {result.candidates.map((candidate, i) => (
                      <button
                        key={i}
                        onClick={() => handleSelectCandidate(candidate)}
                        className="w-full flex items-center gap-4 p-3 border rounded hover:bg-white transition-colors text-left"
                      >
                        {candidate.imageUrl && (
                          <img
                            src={candidate.imageUrl}
                            alt=""
                            className="w-12 h-12 object-cover rounded"
                          />
                        )}
                        <div className="flex-1">
                          <div className="font-medium">{candidate.name}</div>
                          <div className="text-sm text-gray-600">
                            {candidate.cardNumber && `${candidate.cardNumber} / `}
                            {candidate.rarity}
                          </div>
                        </div>
                        <span className={`px-2 py-1 rounded text-sm ${getSimilarityColor(candidate.similarity)}`}>
                          {candidate.similarity}%
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-4 border-2 border-red-300 bg-red-50 rounded-lg">
                  <div className="text-red-700">
                    DBに該当するカードが見つかりませんでした。
                    下のフォームから新規登録してください。
                  </div>
                </div>
              )}

              {/* 新規登録フォーム */}
              {!selectedCard && (
                <div className="p-4 border rounded-lg space-y-4">
                  <h3 className="font-semibold">新規カード登録</h3>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">カード名 *</label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        className="w-full px-3 py-2 border rounded"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">カード番号</label>
                      <input
                        type="text"
                        value={formData.cardNumber}
                        onChange={(e) => setFormData(prev => ({ ...prev, cardNumber: e.target.value }))}
                        className="w-full px-3 py-2 border rounded"
                        placeholder="例: 198/187"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1">大カテゴリ</label>
                      <select
                        value={formData.categoryLargeId}
                        onChange={(e) => handleLargeCategoryChange(e.target.value)}
                        className="w-full px-3 py-2 border rounded"
                      >
                        <option value="">選択...</option>
                        {categories.large.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">中カテゴリ</label>
                      <select
                        value={formData.categoryMediumId}
                        onChange={(e) => handleMediumCategoryChange(e.target.value)}
                        className="w-full px-3 py-2 border rounded"
                        disabled={!formData.categoryLargeId}
                      >
                        <option value="">選択...</option>
                        {categories.medium.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1">小カテゴリ</label>
                      <select
                        value={formData.categorySmallId}
                        onChange={(e) => setFormData(prev => ({ ...prev, categorySmallId: e.target.value }))}
                        className="w-full px-3 py-2 border rounded"
                        disabled={!formData.categoryMediumId}
                      >
                        <option value="">選択...</option>
                        {categories.small.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">レアリティ</label>
                    <select
                      value={formData.rarityId}
                      onChange={(e) => setFormData(prev => ({ ...prev, rarityId: e.target.value }))}
                      className="w-full px-3 py-2 border rounded"
                    >
                      <option value="">選択...</option>
                      {rarities.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={handleRegister}
                    disabled={isRegistering || !formData.name}
                    className="w-full py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                  >
                    {isRegistering ? '登録中...' : 'カードを登録'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
