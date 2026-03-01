'use client'

import { CATEGORIES } from '@/lib/chart/constants'

interface Props {
    selected: string
    onChange: (slug: string) => void
}

const CATEGORY_STYLES: Record<string, { active: string; icon: string }> = {
    all: {
        active: 'bg-gradient-to-r from-red-500 to-orange-500 text-white shadow-red-200/50',
        icon: '🎴',
    },
    pokemon: {
        active: 'bg-amber-400 text-amber-900 shadow-amber-200/50',
        icon: '⚡',
    },
}

export default function CategoryTabs({ selected, onChange }: Props) {
    return (
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {CATEGORIES.map(cat => {
                const isSelected = selected === cat.slug
                const style = CATEGORY_STYLES[cat.slug] || CATEGORY_STYLES.all

                return (
                    <button
                        key={cat.slug}
                        onClick={() => onChange(cat.slug)}
                        className={`px-5 py-2.5 rounded-full text-sm font-bold whitespace-nowrap
                            transition-all duration-200 min-h-[44px]
                            ${isSelected
                                ? `${style.active} shadow-md scale-105`
                                : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'
                            }`}
                    >
                        {style.icon} {cat.name}
                    </button>
                )
            })}
        </div>
    )
}
