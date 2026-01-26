/**
 * カード名マッチング用ユーティリティ
 */

// カード名を正規化
export function normalizeCardName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[ー−]/g, '-')
    // 全角英数字を半角に変換
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => 
      String.fromCharCode(c.charCodeAt(0) - 0xFEE0)
    )
    // サフィックスを統一
    .replace(/ｅｘ/g, 'ex')
    .replace(/ＥＸ/g, 'ex')
    .replace(/ｖｍａｘ/g, 'vmax')
    .replace(/ｖｓｔａｒ/g, 'vstar')
}

// レーベンシュタイン距離を計算
export function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length
  const n = str2.length
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))
  
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + 1
        )
      }
    }
  }
  
  return dp[m][n]
}

// 類似度を計算（0-100）
export function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 100
  
  // 部分一致チェック
  if (str1.includes(str2) || str2.includes(str1)) {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1
    return Math.round((shorter.length / longer.length) * 90)
  }
  
  // レーベンシュタイン距離による類似度
  const distance = levenshteinDistance(str1, str2)
  const maxLen = Math.max(str1.length, str2.length)
  const similarity = Math.round((1 - distance / maxLen) * 100)
  
  return Math.max(0, similarity)
}

// DBカードからあいまい検索
export interface CardCandidate {
  id: string
  name: string
  card_number?: string
  image_url?: string
  rarity?: string
  similarity: number
  isExactMatch: boolean
}

export function findSimilarCards(
  searchName: string,
  dbCards: Array<{
    id: string
    name: string
    card_number?: string
    image_url?: string
    rarities?: any
    rarity_id?: any
    [key: string]: any
  }>,
  options: {
    threshold?: number
    maxResults?: number
  } = {}
): CardCandidate[] {
  const { threshold = 30, maxResults = 5 } = options
  
  if (!searchName) return []
  
  const normalizedSearch = normalizeCardName(searchName)
  
  const results = dbCards
    .map(card => {
      const normalizedDb = normalizeCardName(card.name)
      const similarity = calculateSimilarity(normalizedSearch, normalizedDb)
      return {
        id: card.id,
        name: card.name,
        card_number: card.card_number,
        image_url: card.image_url,
        rarity: (card.rarities as any)?.name,
        similarity,
        isExactMatch: similarity >= 95
      }
    })
    .filter(card => card.similarity > threshold)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxResults)
  
  return results
}

// 既知の誤認識パターンを修正
const KNOWN_ERRORS: Record<string, string> = {
  'ピカチユウ': 'ピカチュウ',
  'リザ一ドン': 'リザードン',
  'ミユウ': 'ミュウ',
  'ミユウツー': 'ミュウツー',
}

export function correctKnownErrors(name: string): string {
  let corrected = name
  for (const [error, correct] of Object.entries(KNOWN_ERRORS)) {
    corrected = corrected.replace(error, correct)
  }
  return corrected
}
