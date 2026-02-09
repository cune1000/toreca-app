import { NextRequest, NextResponse } from 'next/server'
import { fetchAllLoungeCards } from '@/lib/toreca-lounge'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const query = searchParams.get('q') || ''

        if (!query || query.length < 2) {
            return NextResponse.json({
                success: false,
                error: '検索キーワードは2文字以上必要です',
            }, { status: 400 })
        }

        // トレカラウンジから全カードを取得
        const allCards = await fetchAllLoungeCards()

        // キーワード分割AND検索
        const keywords = query.split(/[\s　]+/).filter(k => k.length > 0)
        const filtered = allCards.filter(card => {
            const searchTarget = `${card.name} ${card.modelno} ${card.grade} ${card.rarity}`.toLowerCase()
            return keywords.every(kw => searchTarget.includes(kw.toLowerCase()))
        })

        // 価格降順でソート
        filtered.sort((a, b) => b.price - a.price)

        return NextResponse.json({
            success: true,
            data: {
                items: filtered.slice(0, 50),
                total: filtered.length,
                allCount: allCards.length,
            },
        })
    } catch (error: any) {
        console.error('[toreca-lounge/search]', error)
        return NextResponse.json({
            success: false,
            error: error.message,
        }, { status: 500 })
    }
}
