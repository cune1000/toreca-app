// サイト別カラー
export const SITE_COLORS = [
  '#10b981', // green
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#ec4899', // pink
]

// 買取価格の状態別カラー
export const PURCHASE_CONDITION_COLORS: Record<string, { color: string; label: string }> = {
  '素体': { color: '#3b82f6', label: '素体' },
  'PSA10': { color: '#8b5cf6', label: 'PSA10' },
  '未開封': { color: '#06b6d4', label: '未開封' },
  '開封済み': { color: '#f97316', label: '開封済み' },
  // レガシー英語キー（既存チャートデータ互換）
  normal: { color: '#3b82f6', label: '素体' },
  psa: { color: '#8b5cf6', label: 'PSA' },
  psa10: { color: '#8b5cf6', label: 'PSA10' },
  sealed: { color: '#06b6d4', label: '未開封' },
  opened: { color: '#f97316', label: '開封済み' },
}

// スニダン売買履歴のグレード別カラー
export const SNKRDUNK_GRADE_COLORS: Record<string, string> = {
  PSA10: '#8b5cf6',    // purple
  PSA9: '#06b6d4',     // cyan
  'PSA8以下': '#64748b', // slate
  'BGS10BL': '#a855f7', // purple-500
  'BGS10GL': '#8b5cf6', // violet
  'BGS9.5': '#0ea5e9',  // sky
  'BGS9以下': '#6b7280', // gray
  'ARS10+': '#d946ef',  // fuchsia
  'ARS10': '#c026d3',   // fuchsia-600
  'ARS9': '#0891b2',    // cyan-600
  'ARS8以下': '#71717a', // zinc
  A: '#10b981',        // green
  B: '#f59e0b',        // amber
  C: '#ef4444',        // red
  D: '#dc2626',        // red-600
  // BOX個数
  '1個': '#3b82f6',     // blue
  '2個': '#06b6d4',     // cyan
  '3個': '#10b981',     // green
  '4個': '#22c55e',     // green-500
  '5個': '#84cc16',     // lime
  '6個': '#eab308',     // yellow
  '7個': '#f59e0b',     // amber
  '8個': '#f97316',     // orange
  '9個': '#ef4444',     // red
  '10個': '#dc2626',    // red-600
}

// グレードソート順序
export const GRADE_SORT_ORDER: Record<string, number> = {
  PSA10: 1, PSA9: 2, 'PSA8以下': 3,
  'BGS10BL': 10, 'BGS10GL': 11, 'BGS9.5': 12, 'BGS9以下': 13,
  'ARS10+': 20, 'ARS10': 21, 'ARS9': 22, 'ARS8以下': 23,
  A: 30, B: 31, C: 32, D: 33,
  '1個': 100, '2個': 101, '3個': 102, '4個': 103, '5個': 104,
  '6個': 105, '7個': 106, '8個': 107, '9個': 108, '10個': 109,
}

// BOX系グレード判定
export const isBoxGrade = (grade: string) => /^\d+個$/.test(grade) || grade === 'BOX'

// シングルカード用カテゴリ
export const SINGLE_CATEGORIES = [
  { key: 'all', label: 'すべて', grades: null as string[] | null },
  { key: 'a', label: '素体', grades: ['A'] },
  { key: 'psa10', label: 'PSA10', grades: ['PSA10'] },
  { key: 'b_below', label: 'B以下', grades: ['B', 'C', 'D'] },
  { key: 'psa9_below', label: 'PSA9以下', grades: ['PSA9', 'PSA8以下'] },
  { key: 'other_graded', label: 'その他鑑定品', grades: ['BGS10BL', 'BGS10GL', 'BGS9.5', 'BGS9以下', 'ARS10+', 'ARS10', 'ARS9', 'ARS8以下'] },
]

// グレード別最安値カラー（価格・在庫推移グラフ用）
export const SALE_GRADE_COLORS: Record<string, { color: string; label: string }> = {
  PSA10: { color: '#8b5cf6', label: 'PSA10最安' },
  A: { color: '#10b981', label: '状態A最安' },
  B: { color: '#f59e0b', label: '状態B最安' },
  BOX: { color: '#3b82f6', label: 'BOX最安' },
}

// 海外価格線カラー
export const OVERSEAS_LINE_COLORS: Record<string, { color: string; label: string }> = {
  loose: { color: '#6366f1', label: '海外素体' },   // indigo
  graded: { color: '#a78bfa', label: '海外PSA10' },  // violet
}

// 日次平均カラー
export const DAILY_AVG_COLORS: Record<string, { color: string; label: string }> = {
  trade: { color: '#f97316', label: '売買平均' },     // orange
}

// 期間フィルタオプション
export const PERIOD_OPTIONS = [
  { label: '本日', days: 1 },
  { label: '7日', days: 7 },
  { label: '30日', days: 30 },
  { label: '180日', days: 180 },
  { label: '1年', days: 365 },
  { label: '全期間', days: null as number | null },
]

// 相対時間フォーマット
export function formatRelativeTime(dateStr: string) {
  const now = new Date()
  const target = new Date(dateStr)
  const diff = now.getTime() - target.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (diff < 0) {
    const futureMins = Math.abs(minutes)
    if (futureMins < 60) return `${futureMins}分後`
    const futureHours = Math.floor(futureMins / 60)
    if (futureHours < 24) return `${futureHours}時間後`
    return `${Math.floor(futureHours / 24)}日後`
  }
  if (minutes < 1) return 'たった今'
  if (minutes < 60) return `${minutes}分前`
  if (hours < 24) return `${hours}時間前`
  return `${days}日前`
}
