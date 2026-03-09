'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

export type ChartTheme = 'default' | 'native' | 'bento' | 'dark' | 'neumorphism' | 'glass' | 'neopop' | 'elegant'
export type ChartLayoutMode = 'carousel' | 'grid' | 'compact'

interface ThemeContextType {
    theme: ChartTheme
    setTheme: (theme: ChartTheme) => void
    layout: ChartLayoutMode
    setLayout: (layout: ChartLayoutMode) => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ChartThemeProvider({ children }: { children: ReactNode }) {
    const [theme, setTheme] = useState<ChartTheme>('default')
    const [layout, setLayout] = useState<ChartLayoutMode>('carousel')
    const [mounted, setMounted] = useState(false)

    // Persist theme to localStorage
    useEffect(() => {
        setMounted(true)
        const savedTheme = localStorage.getItem('chart-theme') as ChartTheme | null
        if (savedTheme && ['default', 'native', 'bento', 'dark', 'neumorphism', 'glass', 'neopop', 'elegant'].includes(savedTheme)) {
            setTheme(savedTheme)
        }
        const savedLayout = localStorage.getItem('chart-layout') as ChartLayoutMode | null
        if (savedLayout && ['carousel', 'grid', 'compact'].includes(savedLayout)) {
            setLayout(savedLayout)
        }
    }, [])

    const handleSetTheme = (newTheme: ChartTheme) => {
        setTheme(newTheme)
        localStorage.setItem('chart-theme', newTheme)
    }

    const handleSetLayout = (newLayout: ChartLayoutMode) => {
        setLayout(newLayout)
        localStorage.setItem('chart-layout', newLayout)
    }

    if (!mounted) {
        // Prevent hydration mismatch by rendering default on server
        return <>{children}</>
    }

    return (
        <ThemeContext.Provider value={{ theme, setTheme: handleSetTheme, layout, setLayout: handleSetLayout }}>
            <div data-theme={theme} data-layout={layout} className="contents theme-root">
                {children}
            </div>
        </ThemeContext.Provider>
    )
}

export function useChartTheme() {
    const context = useContext(ThemeContext)
    if (!context) {
        // Fallback or throw based on preference, but here we just return default to be safe on SSR
        return { theme: 'default' as ChartTheme, setTheme: () => { }, layout: 'carousel' as ChartLayoutMode, setLayout: () => { } }
    }
    return context
}
