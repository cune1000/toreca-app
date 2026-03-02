import { MATCH_SCORES } from './constants'

// ============================================================================
// 名前正規化
// ============================================================================

/**
 * 外部商品名をDBカード名と比較しやすいように正規化
 * - 全角英数→半角
 * - グレード表記除去（PSA10, BGS9.5 等）
 * - 括弧内の付加情報を分離
 * - トリム・連続スペース除去
 */
export function normalizeName(raw: string): string {
  let s = raw
  // 全角英数→半角
  s = s.replace(/[Ａ-Ｚａ-ｚ０-９]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
  )
  // 全角スペース→半角
  s = s.replace(/　/g, ' ')
  // グレード表記除去
  s = s.replace(/\b(PSA|BGS|ARS|CGC)\s*\d+\.?\d*\s*(BL|GL)?\b/gi, '')
  // 状態表記除去
  s = s.replace(/[\[【]\s*(美品|良品|傷あり|状態[A-D])\s*[\]】]/g, '')
  // 括弧内の付加情報（発売日、セット名等）は保持するが分離可能にする
  // 連続スペース除去・トリム
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

/**
 * 型番を正規化
 * - ハイフン/スラッシュの揺れ対応
 * - 大文字化
 */
export function normalizeModelno(raw: string | null | undefined): string {
  if (!raw) return ''
  return raw
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    .replace(/[\s　]+/g, '')
    .toUpperCase()
    .trim()
}

// ============================================================================
// スコアリング
// ============================================================================

/**
 * 外部商品名とDBカード名のマッチングスコアを算出
 * @returns 0-100 のスコア
 */
export function calculateMatchScore(
  externalName: string,
  externalModelno: string | null,
  cardName: string,
  cardNumber: string | null,
): number {
  const normExtName = normalizeName(externalName)
  const normCardName = normalizeName(cardName)
  const normExtModel = normalizeModelno(externalModelno)
  const normCardModel = normalizeModelno(cardNumber)

  const nameMatch = checkNameMatch(normExtName, normCardName)
  const modelMatch = normExtModel && normCardModel && normExtModel === normCardModel

  // 名前+型番完全一致
  if (nameMatch === 'exact' && modelMatch) {
    return MATCH_SCORES.EXACT
  }

  // 名前完全一致（型番なし or 型番不一致）
  if (nameMatch === 'exact') {
    return MATCH_SCORES.NAME_EXACT
  }

  // 型番一致（名前は不一致）
  if (modelMatch && nameMatch === 'none') {
    return MATCH_SCORES.MODELNO_ONLY
  }

  // 名前+型番で部分一致
  if (nameMatch === 'partial' && modelMatch) {
    return MATCH_SCORES.PARTIAL_MAX
  }

  // 名前部分一致のみ
  if (nameMatch === 'partial') {
    return calculatePartialScore(normExtName, normCardName)
  }

  return 0
}

// ============================================================================
// 内部ヘルパー
// ============================================================================

type NameMatchResult = 'exact' | 'partial' | 'none'

function checkNameMatch(a: string, b: string): NameMatchResult {
  if (!a || !b) return 'none'
  const la = a.toLowerCase()
  const lb = b.toLowerCase()
  if (la === lb) return 'exact'
  if (la.includes(lb) || lb.includes(la)) return 'partial'
  return 'none'
}

function calculatePartialScore(a: string, b: string): number {
  const la = a.toLowerCase()
  const lb = b.toLowerCase()
  const shorter = la.length < lb.length ? la : lb
  const longer = la.length < lb.length ? lb : la
  const ratio = shorter.length / longer.length
  // 60-80の範囲でスコアリング
  return Math.round(
    MATCH_SCORES.PARTIAL_MIN + (MATCH_SCORES.PARTIAL_MAX - MATCH_SCORES.PARTIAL_MIN) * ratio
  )
}

// ============================================================================
// 括弧内情報の抽出
// ============================================================================

/**
 * 商品名から括弧内の情報を抽出（セット名等の候補）
 */
export function extractBracketInfo(name: string): string[] {
  const results: string[] = []
  const patterns = [
    /【(.+?)】/g,
    /\[(.+?)\]/g,
    /（(.+?)）/g,
    /\((.+?)\)/g,
  ]
  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(name)) !== null) {
      results.push(match[1].trim())
    }
  }
  return results
}
