/**
 * OCR結果処理ユーティリティ
 */

// 除外ワード（カード名ではないもの）
const EXCLUDE_CONTAINS = ['進化', 'たね', '鑑定', '買取', '価格', '円', '枚', '在庫', 'HP', 'PSA', 'GEM', 'MINT', 'BGS', 'CGC']
const EXCLUDE_EXACT = ['10', '9', '8', '7', '6', '5', '4', '3', '2', '1']

/**
 * OCR結果からカード名を抽出
 */
export function extractCardName(fullText: string): string | null {
  if (!fullText) return null
  
  const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean)
  
  if (lines.length === 0) return null
  
  for (const line of lines.slice(0, 5)) {
    // 完全一致除外
    if (EXCLUDE_EXACT.includes(line)) continue
    // 含む除外
    if (EXCLUDE_CONTAINS.some(w => line.includes(w))) continue
    // 数字だけの行はスキップ
    if (/^[\d\s,]+$/.test(line)) continue
    // 短すぎる行はスキップ
    if (line.length < 2) continue
    
    // カード名を整形
    let name = line
      .replace(/\s+/g, '')
      .replace(/[「」『』【】\[\]]/g, '')
      .replace(/PSA\d*/gi, '')
      .replace(/\d+$/, '') // 末尾の数字を除去
    
    // 2文字以上でひらがな/カタカナ/漢字を含む
    if (name.length >= 2 && /[ぁ-んァ-ヶ一-龥]/.test(name)) {
      return name
    }
  }
  
  return lines[0] || null
}

/**
 * OCR結果から価格を抽出
 */
export function extractPrice(fullText: string): number | null {
  if (!fullText) return null
  
  // カンマ区切りの数字を探す
  const match = fullText.match(/[\d,]+/)
  if (match) {
    const price = parseInt(match[0].replace(/,/g, ''), 10)
    if (!isNaN(price) && price > 0) {
      return price
    }
  }
  return null
}

/**
 * 在庫数を抽出（数値または文字列に対応）
 */
export function extractStock(stockValue: any): number | null {
  if (stockValue === null || stockValue === undefined) return null
  
  if (typeof stockValue === 'number') {
    return stockValue
  }
  
  if (typeof stockValue === 'string') {
    const stockMatch = stockValue.match(/(\d+)/)
    if (stockMatch) {
      return parseInt(stockMatch[1], 10)
    }
    if (stockValue.includes('あり') || stockValue.includes('在庫')) {
      return 1
    }
    if (stockValue.includes('なし') || stockValue.includes('売切')) {
      return 0
    }
  }
  
  return null
}

/**
 * JSONレスポンスからJSONを抽出
 */
export function extractJSON(text: string): any {
  // ```json ... ``` を除去
  let cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '')
  
  // JSONの開始と終了を見つける
  const jsonStart = cleaned.indexOf('{')
  const jsonEnd = cleaned.lastIndexOf('}')
  
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error('No JSON found in response')
  }
  
  cleaned = cleaned.substring(jsonStart, jsonEnd + 1)
  
  return JSON.parse(cleaned)
}
