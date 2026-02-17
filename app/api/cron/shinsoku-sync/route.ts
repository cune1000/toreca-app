import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { fetchShinsokuItems, toYen } from '@/lib/shinsoku'

const supabase = createServiceClient()

export const maxDuration = 300

export async function GET(request: NextRequest) {
    // CRON認証
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const startTime = Date.now()
    const brands = ['ポケモン', 'ワンピース', '遊戯王', 'ヴァイスシュヴァルツ', 'デュエルマスターズ']
    let totalInserted = 0
    let totalUpdated = 0
    const errors: string[] = []

    for (const brand of brands) {
        try {
            console.log(`[shinsoku-sync] Fetching brand: ${brand}`)
            const items = await fetchShinsokuItems(brand, 'ALL', 100)
            console.log(`[shinsoku-sync] Got ${items.length} items for ${brand}`)

            if (items.length === 0) continue

            // 重複item_idを除去（APIが同一商品を複数ページで返す場合がある）
            const uniqueMap = new Map<string, typeof items[0]>()
            for (const item of items) {
                uniqueMap.set(item.item_id, item)
            }
            const uniqueItems = Array.from(uniqueMap.values())
            console.log(`[shinsoku-sync] Got ${items.length} items (${uniqueItems.length} unique) for ${brand}`)
            const batchSize = 500
            for (let i = 0; i < uniqueItems.length; i += batchSize) {
                const batch = uniqueItems.slice(i, i + batchSize).map(item => ({
                    item_id: item.item_id,
                    name: item.name,
                    name_processed: item.name_processed || item.name,
                    type: item.type || 'NORMAL',
                    brand: brand,
                    rarity: item.rarity || null,
                    modelno: item.modelno || null,
                    image_url: item.image_url_public || null,
                    tags: item.tags || [],
                    is_full_amount: item.is_full_amount_flag || false,
                    price_s: item.postal_purchase_price_s,
                    price_a: item.postal_purchase_price_a,
                    price_am: item.postal_purchase_price_am,
                    price_b: item.postal_purchase_price_b,
                    price_c: item.postal_purchase_price_c,
                    synced_at: new Date().toISOString(),
                }))

                const { error, count } = await supabase
                    .from('shinsoku_items')
                    .upsert(batch, { onConflict: 'item_id' })

                if (error) {
                    errors.push(`${brand} batch ${i}: ${error.message}`)
                } else {
                    totalInserted += batch.length
                }
            }
        } catch (err: any) {
            errors.push(`${brand}: ${err.message}`)
        }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)

    // cron_logsに記録
    await supabase.from('cron_logs').insert({
        card_sale_url_id: null,
        card_name: 'shinsoku-sync',
        site_name: 'シンソク',
        status: errors.length > 0 ? 'error' : 'success',
        message: `同期完了: ${totalInserted}件 (${elapsed}s)${errors.length > 0 ? ` errors: ${errors.join(', ')}` : ''}`,
        response_time_ms: Date.now() - startTime,
    })

    return NextResponse.json({
        success: true,
        synced: totalInserted,
        elapsed: `${elapsed}s`,
        errors: errors.length > 0 ? errors : undefined,
    })
}
