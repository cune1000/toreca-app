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
        <div className="flex gap-1.5 overflow-x-auto p-1.5 bg-gray-200/50 backdrop-blur-md rounded-[20px] w-fit shadow-inner border border-gray-200/50" style={{ scrollbarWidth: 'none' }}>
            {CATEGORIES.map(cat => {
                const isSelected = selected === cat.slug
                const style = CATEGORY_STYLES[cat.slug] || CATEGORY_STYLES.all

                return (
                    <button
                        key={cat.slug}
                        onClick={() => onChange(cat.slug)}
                        className={`relative px-6 py-2.5 rounded-2xl text-sm font-bold whitespace-nowrap
                            transition-all duration-300 min-h-[44px] flex items-center justify-center gap-2
                            ${isSelected
                                ? `text-gray-900 shadow-[0_2px_8px_rgba(0,0,0,0.08)] bg-white border border-gray-200/50`
                                : 'text-gray-500 hover:text-gray-800 hover:bg-white/50 border border-transparent'
                            }`}
                    >
                        {isSelected && (
                            <div className={`absolute inset-0 rounded-2xl opacity-5 bg-gradient-to-r from-red-500 to-orange-500 pointer-events-none`} />
                        )}
                        <span className={`${isSelected ? 'scale-110 drop-shadow-sm' : ''} transition-transform duration-300 -mt-0.5 text-base`}>{style.icon}</span>
                        <span className="relative z-10 tracking-wide">{cat.name}</span>
                    </button>
                )
            })}
        </div>
    )
}
