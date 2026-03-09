'use client'

import { CATEGORIES } from '@/lib/chart/constants'
import { useChartTheme } from './ChartThemeContext'

interface Props {
    selected: string
    onChange: (slug: string) => void
}

const CATEGORY_STYLES: Record<string, { active: string; icon: string }> = {
    all: {
        active: '',
        icon: '🎴',
    },
    pokemon: {
        active: '',
        icon: '⚡',
    },
}

export default function CategoryTabs({ selected, onChange }: Props) {
    const { theme } = useChartTheme()

    const getWrapperClass = () => {
        switch (theme) {
            case 'native': return 'bg-white border-b border-gray-200 !w-full !p-0 !gap-4 !rounded-none shadow-sm'
            case 'dark': return 'bg-slate-900/50 border border-slate-800/80 rounded-[20px] shadow-inner w-fit p-1.5'
            case 'bento': return 'bg-gray-200 border-[2px] border-black rounded-none shadow-[inset_2px_2px_0px_rgba(0,0,0,0.1)] w-fit p-1.5'
            case 'neumorphism': return 'bg-[#e0e5ec] border-transparent rounded-[20px] shadow-[inset_3px_3px_6px_#c8d0e7,inset_-3px_-3px_6px_#ffffff] w-fit p-1.5'
            case 'glass': return 'bg-white/30 backdrop-blur-md rounded-[20px] shadow-inner border border-white/40 w-fit p-1.5'
            case 'neopop': return 'bg-yellow-300 border-[3px] border-black rounded-none shadow-[4px_4px_0_#000] w-fit p-1.5'
            case 'elegant': return 'bg-[#FAF8F5] border border-[#D4C3A3] rounded-full shadow-sm w-fit p-1.5'
            default: return 'bg-gray-200/50 backdrop-blur-md rounded-[20px] shadow-inner border border-gray-200/50 w-fit p-1.5'
        }
    }

    const getTabClass = (isSelected: boolean, slug: string) => {
        const base = `relative px-6 py-2.5 text-sm font-bold whitespace-nowrap transition-all duration-300 min-h-[44px] flex items-center justify-center gap-2 border`

        let shape = (theme === 'bento' || theme === 'neopop' || theme === 'native') ? 'rounded-none' : theme === 'elegant' ? 'rounded-full' : 'rounded-2xl'

        if (!isSelected) {
            switch (theme) {
                case 'native': return `${base} ${shape} text-gray-500 hover:text-gray-900 border-transparent !border-b-2 hover:!border-gray-300 bg-transparent`
                case 'dark': return `${base} ${shape} text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border-transparent`
                case 'bento': return `${base} ${shape} text-gray-700 hover:text-black hover:bg-white/50 border-transparent`
                case 'neumorphism': return `${base} ${shape} text-slate-500 hover:text-slate-700 border-transparent`
                case 'glass': return `${base} ${shape} text-sky-900/60 hover:text-sky-900 hover:bg-white/40 border-transparent`
                case 'neopop': return `${base} ${shape} text-black font-bold border-[3px] border-transparent hover:border-black/30`
                case 'elegant': return `${base} ${shape} text-[#A8A195] hover:text-[#5C5446] font-serif hover:bg-[#E8E1D5]/50 border-transparent`
                default: return `${base} ${shape} text-gray-500 hover:text-gray-800 hover:bg-white/50 border-transparent`
            }
        }

        // isSelected === true
        switch (theme) {
            case 'native':
                return `${base} ${shape} text-[#111827] border-transparent !border-b-2 !border-black font-bold bg-transparent`

            case 'dark':
                const darkActiveColor = slug === 'pokemon' ? 'text-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.2)]' : 'text-white shadow-[0_0_15px_rgba(255,255,255,0.1)]'
                return `${base} ${shape} bg-slate-800 border-slate-700 ${darkActiveColor}`

            case 'bento':
                return `${base} ${shape} bg-white text-black border-[2px] border-black shadow-[2px_2px_0_#000]`

            case 'neumorphism':
                const neumorphActiveColor = slug === 'pokemon' ? 'text-amber-600' : 'text-slate-800'
                return `${base} ${shape} bg-[#e0e5ec] border-transparent shadow-[3px_3px_6px_#c8d0e7,-3px_-3px_6px_#ffffff] ${neumorphActiveColor}`

            case 'glass':
                return `${base} ${shape} bg-white/80 text-sky-800 border-white/60 shadow-[0_4px_12px_rgba(0,0,0,0.05)]`

            case 'neopop':
                return `${base} ${shape} bg-white text-black border-[3px] border-black shadow-[4px_4px_0_#000] font-black -translate-y-0.5`

            case 'elegant':
                return `${base} ${shape} bg-white text-[#5C5446] border-[#D4C3A3] font-serif shadow-sm`

            default:
                const defaultActiveColor = slug === 'pokemon' ? 'text-amber-900 bg-amber-400 border-amber-300' : 'bg-white text-gray-900 border-gray-200/50'
                return `${base} ${shape} shadow-[0_2px_8px_rgba(0,0,0,0.08)] ${defaultActiveColor}`
        }
    }

    return (
        <div className={`flex gap-1.5 overflow-x-auto transition-colors duration-300 ${getWrapperClass()}`} style={{ scrollbarWidth: 'none' }}>
            {CATEGORIES.map(cat => {
                const isSelected = selected === cat.slug
                const style = CATEGORY_STYLES[cat.slug] || CATEGORY_STYLES.all

                return (
                    <button
                        key={cat.slug}
                        onClick={() => onChange(cat.slug)}
                        className={getTabClass(isSelected, cat.slug)}
                    >
                        {/* Default theme subtle gradient overlay for "all" */}
                        {isSelected && theme === 'default' && cat.slug === 'all' && (
                            <div className={`absolute inset-0 rounded-2xl opacity-5 bg-gradient-to-r from-red-500 to-orange-500 pointer-events-none`} />
                        )}
                        <span className={`${isSelected && theme !== 'bento' ? 'scale-110 drop-shadow-sm' : ''} transition-transform duration-300 -mt-0.5 text-base`}>{style.icon}</span>
                        <span className={`relative z-10 tracking-wide ${theme === 'bento' ? 'tracking-tighter' : ''}`}>{cat.name}</span>
                    </button>
                )
            })}
        </div>
    )
}
