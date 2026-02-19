const SIZES = {
    sm: 'w-10 h-14',
    md: 'w-12 h-16',
    lg: 'w-14 h-20',
    xl: 'w-20 h-28',
    hero: 'w-36 h-48',
}

export default function CardThumbnail({ url, size = 'sm', name }: { url?: string | null; size?: keyof typeof SIZES; name?: string }) {
    const s = SIZES[size]
    return url ? (
        <img src={url} alt={name || ''} className={`${s} object-cover rounded flex-shrink-0`} />
    ) : (
        <div className={`${s} bg-gray-100 rounded flex items-center justify-center text-lg flex-shrink-0`}>🎴</div>
    )
}
