// 価格フォーマットユーティリティ

export function formatPrice(price: number): string {
    return `¥${price.toLocaleString()}`
}

export function formatPriceCompact(price: number): string {
    if (price >= 10000) {
        return `¥${(price / 10000).toFixed(1)}万`
    }
    return formatPrice(price)
}

export function formatChange(value: number, suffix = '%'): string {
    const sign = value > 0 ? '+' : ''
    return `${sign}${value.toFixed(1)}${suffix}`
}

export function formatChangeYen(value: number): string {
    const sign = value > 0 ? '+' : ''
    return `${sign}¥${Math.abs(value).toLocaleString()}`
}

export function formatRelativeTime(dateStr: string): string {
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)

    if (diffMins < 1) return 'たった今'
    if (diffMins < 60) return `${diffMins}分前`
    const diffHours = Math.floor(diffMins / 60)
    if (diffHours < 24) return `${diffHours}時間前`
    const diffDays = Math.floor(diffHours / 24)
    if (diffDays < 30) return `${diffDays}日前`
    const diffMonths = Math.floor(diffDays / 30)
    return `${diffMonths}ヶ月前`
}

export function formatDate(dateStr: string): string {
    const d = new Date(dateStr)
    return `${d.getMonth() + 1}/${d.getDate()}`
}
