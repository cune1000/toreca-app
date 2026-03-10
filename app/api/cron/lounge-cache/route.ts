import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { shouldRunCronJob, markCronJobRun } from '@/lib/cron-gate'
import { fetchAllLoungeCards } from '@/lib/toreca-lounge'

export const maxDuration = 120

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const force = request.nextUrl.searchParams.get('force') === '1'
    const gate = await shouldRunCronJob('lounge-cache', { force })
    if (!gate.shouldRun) {
        return NextResponse.json({ skipped: true, reason: gate.reason })
    }

    const start = Date.now()
    const supabase = createServiceClient()

    try {
        // ① 全ページスクレイピング
        const allCards = await fetchAllLoungeCards()

        if (allCards.length === 0) {
            await markCronJobRun('lounge-cache', 'error', 'No cards fetched')
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

        // ③ バッチUPSERT（card_keyで重複排除済み）
        const batchSize = 50
        let insertedCount = 0
        let errorCount = 0
        const syncTimestamp = new Date().toISOString()

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
                updated_at: syncTimestamp,
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

        // ④ 今回の同期で更新されなかった古いキャッシュを削除
        //    （スクレイピング元から消えた商品をキャッシュに残さない）
        const { error: cleanupError, count: cleanupCount } = await supabase
            .from('lounge_cards_cache')
            .delete({ count: 'exact' })
            .lt('updated_at', syncTimestamp)
        if (cleanupError) {
            console.error('[lounge-cache] Cleanup error:', cleanupError.message)
        } else if (cleanupCount && cleanupCount > 0) {
            console.log(`[lounge-cache] Cleaned up ${cleanupCount} stale cache entries`)
        }

        // ⑤ lounge_known_keys に新規キーを登録（新商品検知用）
        // 既存のcard_keyを取得（ページネーション）
        let existingKeys: { card_key: string }[] = []
        let keyOffset = 0
        const KEY_PAGE = 1000
        while (true) {
            const { data: keyPage } = await supabase
                .from('lounge_known_keys')
                .select('card_key')
                .range(keyOffset, keyOffset + KEY_PAGE - 1)
            if (!keyPage || keyPage.length === 0) break
            existingKeys = existingKeys.concat(keyPage)
            if (keyPage.length < KEY_PAGE) break
            keyOffset += KEY_PAGE
        }

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

                const { error: knownKeyError } = await supabase
                    .from('lounge_known_keys')
                    .upsert(batch, { onConflict: 'card_key' })
                if (knownKeyError) {
                    console.error(`[lounge-cache] lounge_known_keys upsert error:`, knownKeyError.message)
                }
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
                stale_removed: cleanupCount || 0,
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
            stale_removed: cleanupCount || 0,
            new_products: newProductCount,
            errors: errorCount,
            elapsed: `${elapsed}s`,
        })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        const elapsed = ((Date.now() - start) / 1000).toFixed(1)

        try {
            await supabase.from('cron_logs').insert({
                job_name: 'lounge_cache_refresh',
                status: 'error',
                details: { error: message, elapsed: `${elapsed}s` },
            })
        } catch { /* ignore logging failure */ }

        try {
            await markCronJobRun('lounge-cache', 'error', message)
        } catch { /* ignore */ }
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
