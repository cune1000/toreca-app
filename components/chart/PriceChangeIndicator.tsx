'use client'

interface Props {
    value: number
    suffix?: string
    size?: 'sm' | 'md' | 'lg'
}

export default function PriceChangeIndicator({ value, suffix = '%', size = 'sm' }: Props) {
    if (value === 0) return <span className="text-gray-400 text-xs">-</span>

    const isUp = value > 0
    const sizeClasses = {
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-base',
    }

    return (
        <span
            className={`inline-flex items-center gap-0.5 font-bold tabular-nums ${sizeClasses[size]} ${isUp ? 'text-red-500' : 'text-blue-500'
                }`}
        >
            {isUp ? '▲' : '▼'} {Math.abs(value).toFixed(1)}{suffix}
        </span>
    )
}
