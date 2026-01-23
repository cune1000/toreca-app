/**
 * あいまい検索ユーティリティ
 * カード名の誤認識を補正するための関数群
 */

/**
 * Levenshtein距離を計算
 * 2つの文字列間の編集距離（挿入・削除・置換の最小回数）
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;
  
  // 空文字列の場合
  if (m === 0) return n;
  if (n === 0) return m;
  
  // DPテーブル
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  // 初期化
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  
  // DP計算
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // 削除
        dp[i][j - 1] + 1,      // 挿入
        dp[i - 1][j - 1] + cost // 置換
      );
    }
  }
  
  return dp[m][n];
}

/**
 * 類似度を計算（0-100%）
 * Levenshtein距離を正規化
 */
export function calculateSimilarity(str1: string, str2: string): number {
  const maxLen = Math.max(str1.length, str2.length);
  if (maxLen === 0) return 100;
  
  const distance = levenshteinDistance(str1, str2);
  return Math.round((1 - distance / maxLen) * 100);
}

/**
 * カード名を正規化（比較用）
 * - 全角→半角変換
 * - 大文字→小文字
 * - 空白削除
 * - 記号統一
 */
export function normalizeCardName(name: string): string {
  return name
    // 全角英数字→半角
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (s) => 
      String.fromCharCode(s.charCodeAt(0) - 0xFEE0)
    )
    // 全角スペース→半角
    .replace(/　/g, ' ')
    // 小文字化
    .toLowerCase()
    // 空白削除
    .replace(/\s+/g, '')
    // 記号統一
    .replace(/[・]/g, '')
    // ハイフン統一
    .replace(/[ー－―]/g, '-')
    .trim();
}

/**
 * カード候補を検索
 * 指定された名前に類似するカードを返す
 */
export interface CardCandidate {
  id: string;
  name: string;
  cardNumber?: string;
  rarity?: string;
  imageUrl?: string;
  similarity: number;
  isExactMatch: boolean;
}

export interface Card {
  id: string;
  name: string;
  card_number?: string;
  rarity_id?: string;
  image_url?: string;
  rarities?: { name: string };
}

export function findSimilarCards(
  searchName: string,
  cards: Card[],
  options: {
    threshold?: number;      // 類似度の閾値（デフォルト: 60%）
    maxResults?: number;     // 最大結果数（デフォルト: 5）
    includeCardNumber?: boolean; // カード番号も検索対象にするか
  } = {}
): CardCandidate[] {
  const { threshold = 60, maxResults = 5, includeCardNumber = true } = options;
  
  const normalizedSearch = normalizeCardName(searchName);
  
  const candidates: CardCandidate[] = cards.map(card => {
    const normalizedName = normalizeCardName(card.name);
    let similarity = calculateSimilarity(normalizedSearch, normalizedName);
    
    // カード番号も検索対象にする場合
    if (includeCardNumber && card.card_number) {
      const numberSimilarity = calculateSimilarity(
        normalizedSearch,
        normalizeCardName(card.card_number)
      );
      // より高い類似度を採用
      similarity = Math.max(similarity, numberSimilarity);
    }
    
    // 部分一致ボーナス
    if (normalizedName.includes(normalizedSearch) || normalizedSearch.includes(normalizedName)) {
      similarity = Math.min(100, similarity + 20);
    }
    
    return {
      id: card.id,
      name: card.name,
      cardNumber: card.card_number,
      rarity: card.rarities?.name,
      imageUrl: card.image_url,
      similarity,
      isExactMatch: similarity === 100
    };
  });
  
  // 閾値以上でフィルタ、類似度順でソート
  return candidates
    .filter(c => c.similarity >= threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxResults);
}

/**
 * 最も類似するカードを取得
 */
export function findBestMatch(
  searchName: string,
  cards: Card[],
  minSimilarity: number = 70
): CardCandidate | null {
  const candidates = findSimilarCards(searchName, cards, { 
    threshold: minSimilarity, 
    maxResults: 1 
  });
  return candidates[0] || null;
}

/**
 * 複数のAI認識結果を一括でマッチング
 */
export interface RecognizedCard {
  name: string;
  cardNumber?: string;
  rarity?: string;
  price?: number;
}

export interface MatchedCard extends RecognizedCard {
  matchedCard: CardCandidate | null;
  candidates: CardCandidate[];
  needsReview: boolean; // 手動確認が必要か
}

export function matchRecognizedCards(
  recognizedCards: RecognizedCard[],
  dbCards: Card[],
  options: {
    autoMatchThreshold?: number;  // 自動マッチの閾値（デフォルト: 90%）
    candidateThreshold?: number;  // 候補表示の閾値（デフォルト: 50%）
  } = {}
): MatchedCard[] {
  const { autoMatchThreshold = 90, candidateThreshold = 50 } = options;
  
  return recognizedCards.map(recognized => {
    const candidates = findSimilarCards(recognized.name, dbCards, {
      threshold: candidateThreshold,
      maxResults: 5
    });
    
    // カード番号でも検索（より正確）
    if (recognized.cardNumber) {
      const numberMatches = dbCards.filter(c => 
        c.card_number === recognized.cardNumber
      );
      if (numberMatches.length > 0) {
        // 完全一致するカード番号があれば最優先
        const exactMatch: CardCandidate = {
          id: numberMatches[0].id,
          name: numberMatches[0].name,
          cardNumber: numberMatches[0].card_number,
          rarity: numberMatches[0].rarities?.name,
          imageUrl: numberMatches[0].image_url,
          similarity: 100,
          isExactMatch: true
        };
        // 重複を除いて先頭に追加
        const filteredCandidates = candidates.filter(c => c.id !== exactMatch.id);
        candidates.unshift(exactMatch);
        candidates.splice(5); // maxResults維持
      }
    }
    
    const bestMatch = candidates[0] || null;
    const isAutoMatch = bestMatch && bestMatch.similarity >= autoMatchThreshold;
    
    return {
      ...recognized,
      matchedCard: isAutoMatch ? bestMatch : null,
      candidates,
      needsReview: !isAutoMatch && candidates.length > 0
    };
  });
}

/**
 * よくある誤認識パターンの修正辞書
 */
const CORRECTION_MAP: Record<string, string> = {
  // カタカナの誤認識
  'バイパーボール': 'ハイパーボール',
  'バイバーボール': 'ハイパーボール',
  'ハイバーボール': 'ハイパーボール',
  // 数字の誤認識
  '0': 'O',
  'l': '1',
  'I': '1',
  // その他
};

/**
 * 既知の誤認識パターンを修正
 */
export function correctKnownErrors(name: string): string {
  return CORRECTION_MAP[name] || name;
}
