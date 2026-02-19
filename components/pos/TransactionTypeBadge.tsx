export default function TransactionTypeBadge({ type, size = 'md' }: { type: 'purchase' | 'sale'; size?: 'sm' | 'md' }) {
    const cls = type === 'purchase' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'
    const padding = size === 'sm' ? 'px-2 py-0.5' : 'px-2.5 py-1'
    return (
        <span className={`text-xs ${padding} rounded-full font-bold ${cls}`}>
            {type === 'purchase' ? '仕入れ' : '販売'}
        </span>
    )
}
