// 相対時間フォーマットユーティリティ

/**
 * 日付を相対時間文字列にフォーマットする
 * 例: "たった今", "5分前", "3時間前", "2日前", "1ヶ月前", "3分後"
 */
export function formatRelativeTime(date: string | Date | null, fallback?: string): string {
  if (date === null || date === undefined) return fallback ?? '-'

  const target = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diff = now.getTime() - target.getTime()

  // 未来の日時
  if (diff < 0) {
    const futureMins = Math.floor(Math.abs(diff) / 60000)
    if (futureMins < 60) return `${futureMins}分後`
    const futureHours = Math.floor(futureMins / 60)
    if (futureHours < 24) return `${futureHours}時間後`
    return `${Math.floor(futureHours / 24)}日後`
  }

  // 過去の日時
  const diffMins = Math.floor(diff / 60000)
  if (diffMins < 1) return 'たった今'
  if (diffMins < 60) return `${diffMins}分前`
  const diffHours = Math.floor(diffMins / 60)
  if (diffHours < 24) return `${diffHours}時間前`
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `${diffDays}日前`
  const diffMonths = Math.floor(diffDays / 30)
  return `${diffMonths}ヶ月前`
}
