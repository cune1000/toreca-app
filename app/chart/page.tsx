'use client'

import { useState, useEffect, useCallback } from 'react'
import ChartLayoutComponent from '@/components/chart/ChartLayout'
import CategoryTabs from '@/components/chart/CategoryTabs'
import RankingRow from '@/components/chart/RankingRow'
import RankingSettings from '@/components/chart/RankingSettings'
import AdBanner from '@/components/chart/AdBanner'
import { getRanking } from '@/lib/chart/queries'
import { ALL_RANKINGS, DEFAULT_VISIBLE_RANKINGS, RANKING_STORAGE_KEY } from '@/lib/chart/constants'
import { ChartCard, RankingDef } from '@/lib/chart/types'

export default function ChartTopPage() {
    const [category, setCategory] = useState('all')
    const [visibleRankings, setVisibleRankings] = useState<string[]>(DEFAULT_VISIBLE_RANKINGS)
    const [showSettings, setShowSettings] = useState(false)
    const [rankingData, setRankingData] = useState<Record<string, ChartCard[]>>({})
    const [loading, setLoading] = useState(true)

    // localStorage からランキング設定を復元
    useEffect(() => {
        try {
            const saved = localStorage.getItem(RANKING_STORAGE_KEY)
            if (saved) {
                const parsed = JSON.parse(saved)
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setVisibleRankings(parsed)
                }
            }
        } catch { }
    }, [])

    // ランキングデータ取得
    const fetchRankings = useCallback(async () => {
        setLoading(true)
        const rankings = visibleRankings
            .map(id => ALL_RANKINGS.find(r => r.id === id))
            .filter((r): r is RankingDef => !!r && !r.comingSoon)

        const results = await Promise.all(
            rankings.map(async (r) => {
                try {
                    const cards = await getRanking({
                        type: r.id,
                        category,
                        limit: 10,
                    })
                    return { id: r.id, cards }
                } catch (err) {
                    console.error(`Ranking ${r.id} error:`, err)
                    return { id: r.id, cards: [] }
                }
            })
        )

        const data: Record<string, ChartCard[]> = {}
        results.forEach(r => { data[r.id] = r.cards })
        setRankingData(data)
        setLoading(false)
    }, [category, visibleRankings])

    useEffect(() => {
        fetchRankings()
    }, [fetchRankings])

    const activeRankings = visibleRankings
        .map(id => ALL_RANKINGS.find(r => r.id === id))
        .filter((r): r is RankingDef => !!r)

    return (
        <ChartLayoutComponent onOpenSettings={() => setShowSettings(true)}>
            {/* カテゴリタブ */}
            <div className="px-4 py-4">
                <CategoryTabs selected={category} onChange={setCategory} />
            </div>

            {/* ローディング */}
            {loading && (
                <div className="px-4 py-12 text-center">
                    <div className="inline-block w-8 h-8 border-2 border-gray-200 border-t-red-400 rounded-full animate-spin" />
                    <p className="text-sm text-gray-400 mt-3">ランキングを取得中...</p>
                </div>
            )}

            {/* ランキング一覧 */}
            {!loading && (
                <div className="py-2">
                    {activeRankings.map((ranking, i) => (
                        <div key={ranking.id}>
                            <RankingRow
                                ranking={ranking}
                                cards={rankingData[ranking.id] || []}
                            />
                            {/* 2番目と4番目のランキングの後に広告 */}
                            {(i === 1 || i === 3) && <AdBanner />}
                        </div>
                    ))}
                </div>
            )}

            {/* 設定モーダル */}
            {showSettings && (
                <RankingSettings
                    visible={visibleRankings}
                    onSave={setVisibleRankings}
                    onClose={() => setShowSettings(false)}
                />
            )}
        </ChartLayoutComponent>
    )
}
