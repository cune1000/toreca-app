import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { fetchAllLoungeCards } from '@/lib/toreca-lounge'

export const maxDuration = 120

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const start = Date.now()

    try {
        // ① 全ページスクレイピング
        const allCards = await fetchAllLoungeCards()

        if (allCards.length === 0) {
            return NextResponse.json({ success: false, error: 'No cards fetched' }, { status: 500 })
        }

        // ② 既存キャッシュを全削除してから一括INSERT
        await supabase.from('lounge_cards_cache').delete().neq('id', 0)

        // 50件ずつバッチINSERT
        const batchSize = 50
        let insertedCount = 0

        for (let i = 0; i < allCards.length; i += batchSize) {
            const batch = allCards.slice(i, i + batchSize).map(card => ({
                product_id: card.productId,
                name: card.name,
                modelno: card.modelno,
                rarity: card.rarity || '',
                grade: card.grade || '',
                product_format: card.productFormat || 'NORMAL',
                price: card.price,
                card_key: card.key,
                image_url: card.imageUrl || '',
                updated_at: new Date().toISOString(),
            }))

            const { error } = await supabase
                .from('lounge_cards_cache')
                .upsert(batch, { onConflict: 'card_key' })

            if (error) {
                console.error(`Batch ${i} error:`, error)
            } else {
                insertedCount += batch.length
            }
        }

        const elapsed = ((Date.now() - start) / 1000).toFixed(1)

        await supabase.from('cron_logs').insert({
            job_name: 'lounge_cache_refresh',
            status: 'success',
            details: {
                scraped: allCards.length,
                cached: insertedCount,
                elapsed: `${elapsed}s`,
            },
        })

        return NextResponse.json({
            success: true,
            scraped: allCards.length,
            cached: insertedCount,
            elapsed: `${elapsed}s`,
        })
    } catch (error: any) {
        const elapsed = ((Date.now() - start) / 1000).toFixed(1)

        await supabase.from('cron_logs').insert({
            job_name: 'lounge_cache_refresh',
            status: 'error',
            details: { error: error.message, elapsed: `${elapsed}s` },
        })

        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
