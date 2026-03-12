/**
 * condition（状態/コンディション）正規化ユーティリティ
 *
 * DB内の正規値: '素体', 'PSA10', '未開封'
 * レガシー値やラベル文字列から正規値に変換する
 */

/** レガシー値 → 正規値マッピング（小文字キー） */
const CONDITION_ALIAS_MAP: Record<string, string> = {
  // 英語レガシー値
  normal: '素体',
  sealed: '未開封',
  psa: 'PSA10',
  psa10: 'PSA10',
  s: '未開封',
  // 日本語はそのまま通す
  素体: '素体',
  未開封: '未開封',
  開封済み: '開封済み',
}

/**
 * condition文字列を正規化する
 *
 * @param condition - DB保存値またはレガシー値 (例: 'normal', 'psa10', 'sealed', '素体')
 * @param label - purchase_links等のラベル文字列。PSA10/未開封キーワードを含む場合はそちらを優先
 * @returns 正規化されたcondition ('素体' | 'PSA10' | '未開封' | 等)
 */
export function normalizeCondition(condition: string, label?: string): string {
  // labelにキーワードが含まれていればそちらを優先（link.label > condition の優先ルール）
  if (label) {
    if (label.includes('PSA10') || label.includes('PSA')) return 'PSA10'
    if (label.includes('未開封')) return '未開封'
  }

  // conditionの正規化
  const normalized = CONDITION_ALIAS_MAP[condition] ?? CONDITION_ALIAS_MAP[condition.toLowerCase()]
  if (normalized) return normalized

  // マッピングにないconditionはそのまま返す（'A', 'A-', 'B', 'C' 等のグレード値）
  return condition
}
