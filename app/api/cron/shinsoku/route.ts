import { NextResponse } from 'next/server'
import { withCronAuth } from '@/lib/cron-gate'
import { normalizeCondition } from '@/lib/condition'
import { syncPurchasePrices, LinkInfo } from '@/lib/cron/purchase-sync'

export const maxDuration = 60

export const GET = withCronAuth('shinsoku', async (_req, supabase) => {
    const start = Date.now()

    const result = await syncPurchasePrices(
        supabase,
        'シンソク（郵送買取）',
        async (links: LinkInfo[], sb) => {
            // shinsoku_items から全価格データを一括取得（バッチ処理）
            const externalKeys = [...new Set(links.map(l => l.external_key))]
            const itemMap = new Map<string, { price_s: number | null; price_a: number | null; price_am: number | null; price_b: number | null; price_c: number | null }>()

            for (let i = 0; i < externalKeys.length; i += 100) {
                const batch = externalKeys.slice(i, i + 100)
                const { data: items } = await sb
                    .from('shinsoku_items')
                    .select('item_id, price_s, price_a, price_am, price_b, price_c')
                    .in('item_id', batch)
                if (items) {
                    for (const item of items) {
                        itemMap.set(item.item_id, item)
                    }
                }
            }

            // 各 link に対して価格を算出
            const prices = new Map<string, { price: number; condition: string } | null>()

            for (const link of links) {
                const itemRow = itemMap.get(link.external_key)
                if (!itemRow) {
                    prices.set(link.id, null)
                    continue
                }

                const rawCondition = link.condition || '未開封'
                const condition = normalizeCondition(rawCondition)

                // condition → price_* マッピング
                // シンソクのランク: S=未開封, A=素体美品, A-=小傷, B=傷あり, C=大傷
                const conditionToPriceMap: Record<string, number | null> = {
                    '未開封': itemRow.price_s,
                    '素体': itemRow.price_a,
                    'PSA10': itemRow.price_s,  // PSA10はシンソクにランクなし → S(最高値)で代用
                    'A': itemRow.price_a,
                    'A-': itemRow.price_am,
                    'B': itemRow.price_b,
                    'C': itemRow.price_c,
                }
                const priceYen = conditionToPriceMap[condition] ?? itemRow.price_a

                if (!priceYen || priceYen === 0) {
                    prices.set(link.id, null)
                    continue
                }

                prices.set(link.id, { price: priceYen, condition })
            }

            return {
                prices,
                extra: {
                    items_found: itemMap.size,
                    items_missing: externalKeys.length - itemMap.size,
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
        items_found: result.extra.items_found,
        items_missing: result.extra.items_missing,
        updated: result.updated,
        unchanged: result.unchanged,
        skipped: result.skipped,
        elapsed: `${elapsed}s`,
        errors: result.errors.length > 0 ? result.errors : undefined,
    })
})
