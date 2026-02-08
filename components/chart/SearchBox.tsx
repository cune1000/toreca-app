'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'

interface Props {
    initialQuery?: string
    onSearch?: (query: string) => void
}

export default function SearchBox({ initialQuery = '', onSearch }: Props) {
    const [query, setQuery] = useState(initialQuery)

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (query.trim()) {
            if (onSearch) {
                onSearch(query.trim())
            } else {
                window.location.href = `/chart/search?q=${encodeURIComponent(query.trim())}`
            }
        }
    }

    return (
        <form onSubmit={handleSubmit} className="relative">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="カード名を入力して検索..."
                className="w-full pl-12 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm
          focus:outline-none focus:ring-2 focus:ring-red-400/30 focus:border-red-400
          shadow-sm transition-all"
            />
        </form>
    )
}
