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

export function formatUsd(pennies: number): string {
    const dollars = pennies / 100
    return `$${dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatUsdCompact(pennies: number): string {
    const dollars = pennies / 100
    if (dollars >= 1000) {
        return `$${(dollars / 1000).toFixed(1)}k`
    }
    return formatUsd(pennies)
}

// Re-export from shared utility
export { formatRelativeTime } from '@/lib/utils/format'

export function formatDate(dateStr: string): string {
    const d = new Date(dateStr)
    return `${d.getMonth() + 1}/${d.getDate()}`
}
