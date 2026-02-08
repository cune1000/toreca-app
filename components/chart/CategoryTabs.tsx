'use client'

import { CATEGORIES } from '@/lib/chart/constants'

interface Props {
    selected: string
    onChange: (slug: string) => void
}

export default function CategoryTabs({ selected, onChange }: Props) {
    return (
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide">
            {CATEGORIES.map(cat => (
                <button
                    key={cat.slug}
                    onClick={() => onChange(cat.slug)}
                    className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all
            ${selected === cat.slug
                            ? 'bg-gray-800 text-white shadow-sm'
                            : 'bg-white text-gray-500 hover:bg-gray-100 border border-gray-200'
                        }`}
                >
                    {cat.name}
                </button>
            ))}
        </div>
    )
}
