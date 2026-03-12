import { NextResponse } from 'next/server'
import { withCronAuth } from '@/lib/cron-gate'
import { fetchAllLoungeCards } from '@/lib/toreca-lounge'
import { syncPurchasePrices, LinkInfo } from '@/lib/cron/purchase-sync'

export const maxDuration = 60

export const GET = withCronAuth('toreca-lounge', async (_req, supabase) => {
    const start = Date.now()

    const result = await syncPurchasePrices(
        supabase,
        'トレカラウンジ（郵送買取）',
        async (links: LinkInfo[]) => {
            // トレカラウンジから全カードを取得
            const loungeCards = await fetchAllLoungeCards()
            const loungeMap = new Map(loungeCards.map(c => [c.key, c]))

            // 各 link に対して価格をルックアップ
            const prices = new Map<string, { price: number; condition: string } | null>()

            for (const link of links) {
                const loungeCard = loungeMap.get(link.external_key)
                if (!loungeCard || loungeCard.price === 0) {
                    prices.set(link.id, null)
                    continue
                }

                prices.set(link.id, {
                    price: loungeCard.price,
                    condition: link.condition || '素体',
                })
            }

            return {
                prices,
                extra: {
                    scraped: loungeCards.length,
                },
            }
        },
    )

    if (result.totalLinks === 0) {
        return NextResponse.json({ success: true, message: 'No linked cards', synced: 0 })
    }

    const elapsed = ((Date.now() - start) / 1000).toFixed(1)

    return NextResponse.json({
        success: true,
        total_links: result.totalLinks,
        scraped: result.extra.scraped,
        updated: result.updated,
        unchanged: result.unchanged,
        skipped: result.skipped,
        elapsed: `${elapsed}s`,
        errors: result.errors.length > 0 ? result.errors : undefined,
    })
})
