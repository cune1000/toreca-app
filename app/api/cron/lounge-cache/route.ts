import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { shouldRunCronJob, markCronJobRun } from '@/lib/cron-gate'

const supabase = createServiceClient()
import { fetchAllLoungeCards } from '@/lib/toreca-lounge'

export const maxDuration = 120

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const gate = await shouldRunCronJob('lounge-cache')
    if (!gate.shouldRun) {
        return NextResponse.json({ skipped: true, reason: gate.reason })
    }

    const start = Date.now()

    try {
        // ① 全ページスクレイピング
        const allCards = await fetchAllLoungeCards()

        if (allCards.length === 0) {
            return NextResponse.json({ success: false, error: 'No cards fetched' }, { status: 500 })
        }

        // ② card_keyで重複除去（同じキーなら高い方を残す）
        const cardMap = new Map<string, typeof allCards[0]>()
        for (const card of allCards) {
            const existing = cardMap.get(card.key)
            if (!existing || card.price > existing.price) {
                cardMap.set(card.key, card)
            }
        }
        const uniqueCards = Array.from(cardMap.values())

        // ③ 既存キャッシュを全削除してから一括INSERT
        await supabase.from('lounge_cards_cache').delete().neq('id', 0)

        // 50件ずつバッチINSERT
        const batchSize = 50
        let insertedCount = 0
        let errorCount = 0

        for (let i = 0; i < uniqueCards.length; i += batchSize) {
            const batch = uniqueCards.slice(i, i + batchSize).map(card => ({
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
                errorCount++
            } else {
                insertedCount += batch.length
            }
        }

        // ⑤ lounge_known_keys に新規キーを登録（新商品検知用）
        // 既存のcard_keyを取得
        const { data: existingKeys } = await supabase
            .from('lounge_known_keys')
            .select('card_key')

        const knownKeySet = new Set((existingKeys || []).map(k => k.card_key))
        const newCards = uniqueCards.filter(c => !knownKeySet.has(c.key))
        const newProductCount = newCards.length

        // 新規キーをバッチINSERT
        if (newCards.length > 0) {
            const newKeyBatchSize = 100
            for (let i = 0; i < newCards.length; i += newKeyBatchSize) {
                const batch = newCards.slice(i, i + newKeyBatchSize).map(card => ({
                    card_key: card.key,
                    name: card.name,
                    price: card.price,
                    rarity: card.rarity || '',
                    grade: card.grade || '',
                }))

                await supabase
                    .from('lounge_known_keys')
                    .upsert(batch, { onConflict: 'card_key' })
            }
        }

        const elapsed = ((Date.now() - start) / 1000).toFixed(1)

        await supabase.from('cron_logs').insert({
            job_name: 'lounge_cache_refresh',
            status: 'success',
            details: {
                scraped: allCards.length,
                unique: uniqueCards.length,
                duplicates: allCards.length - uniqueCards.length,
                cached: insertedCount,
                new_products: newProductCount,
                errors: errorCount,
                elapsed: `${elapsed}s`,
            },
        })

        await markCronJobRun('lounge-cache', 'success')
        return NextResponse.json({
            success: true,
            scraped: allCards.length,
            unique: uniqueCards.length,
            duplicates: allCards.length - uniqueCards.length,
            cached: insertedCount,
            new_products: newProductCount,
            errors: errorCount,
            elapsed: `${elapsed}s`,
        })
    } catch (error: any) {
        const elapsed = ((Date.now() - start) / 1000).toFixed(1)

        await supabase.from('cron_logs').insert({
            job_name: 'lounge_cache_refresh',
            status: 'error',
            details: { error: error.message, elapsed: `${elapsed}s` },
        })

        await markCronJobRun('lounge-cache', 'error', error.message)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
