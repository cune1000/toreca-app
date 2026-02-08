'use client'

import { useState, useEffect, use } from 'react'
import ChartLayoutComponent from '@/components/chart/ChartLayout'
import CategoryTabs from '@/components/chart/CategoryTabs'
import RankingRow from '@/components/chart/RankingRow'
import AdBanner from '@/components/chart/AdBanner'
import { getRanking } from '@/lib/chart/queries'
import { ALL_RANKINGS } from '@/lib/chart/constants'
import { ChartCard, RankingDef } from '@/lib/chart/types'
import { CATEGORIES } from '@/lib/chart/constants'

interface Props {
    params: Promise<{ slug: string }>
}

export default function CategoryPage({ params }: Props) {
    const { slug } = use(params)
    const [rankingData, setRankingData] = useState<Record<string, ChartCard[]>>({})
    const [loading, setLoading] = useState(true)

    const categoryName = CATEGORIES.find(c => c.slug === slug)?.name || slug

    // このカテゴリで使えるランキング（Coming Soon以外）
    const activeRankings = ALL_RANKINGS.filter(r => !r.comingSoon)

    useEffect(() => {
        async function fetchData() {
            setLoading(true)
            const results = await Promise.all(
                activeRankings.map(async (r) => {
                    try {
                        const cards = await getRanking({
                            dataSource: r.dataSource,
                            sortBy: r.sortBy,
                            category: slug,
                            limit: 10,
                        })
                        return { id: r.id, cards }
                    } catch {
                        return { id: r.id, cards: [] }
                    }
                })
            )

            const data: Record<string, ChartCard[]> = {}
            results.forEach(r => { data[r.id] = r.cards })
            setRankingData(data)
            setLoading(false)
        }

        fetchData()
    }, [slug])

    return (
        <ChartLayoutComponent>
            {/* カテゴリタブ */}
            <div className="px-4 py-4">
                <CategoryTabs
                    selected={slug}
                    onChange={(newSlug) => {
                        window.location.href = newSlug === 'all' ? '/chart' : `/chart/category/${newSlug}`
                    }}
                />
            </div>

            <div className="px-4 mb-4">
                <h2 className="text-lg font-bold text-gray-800">{categoryName} ランキング</h2>
            </div>

            {loading ? (
                <div className="py-12 text-center">
                    <div className="inline-block w-8 h-8 border-2 border-gray-200 border-t-red-400 rounded-full animate-spin" />
                    <p className="text-sm text-gray-400 mt-3">ランキングを取得中...</p>
                </div>
            ) : (
                <div className="py-2">
                    {activeRankings.map((ranking, i) => (
                        <div key={ranking.id}>
                            <RankingRow
                                ranking={ranking}
                                cards={rankingData[ranking.id] || []}
                            />
                            {(i === 1 || i === 3) && <AdBanner />}
                        </div>
                    ))}
                </div>
            )}
        </ChartLayoutComponent>
    )
}
