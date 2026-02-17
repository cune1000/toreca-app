import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

const supabase = createServiceClient()

export const maxDuration = 60

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const start = Date.now()

    try {
        // ① シンソクのshop_idを取得
        const { data: shops } = await supabase
            .from('purchase_shops')
            .select('id')
            .eq('name', 'シンソク（郵送買取）')
            .limit(1)

        const shop = shops?.[0]
        if (!shop) throw new Error('シンソクがpurchase_shopsに未登録')

        // ② card_purchase_linksから紐付け済みカードを一括取得
        const { data: links, error: linksError } = await supabase
            .from('card_purchase_links')
            .select('id, card_id, external_key, label, condition, card:card_id(name)')
            .eq('shop_id', shop.id)

        if (linksError) throw linksError

        if (!links || links.length === 0) {
            return NextResponse.json({ success: true, message: 'No linked cards', synced: 0 })
        }

        // ③ shinsoku_itemsから全価格データを一括取得（バッチ処理）
        const externalKeys = [...new Set(links.map(l => l.external_key))]
        const itemMap = new Map<string, { price_s: number | null; price_a: number | null; price_am: number | null; price_b: number | null; price_c: number | null }>()

        for (let i = 0; i < externalKeys.length; i += 100) {
            const batch = externalKeys.slice(i, i + 100)
            const { data: items } = await supabase
                .from('shinsoku_items')
                .select('item_id, price_s, price_a, price_am, price_b, price_c')
                .in('item_id', batch)
            if (items) {
                for (const item of items) {
                    itemMap.set(item.item_id, item)
                }
            }
        }

        // ④ 各紐付けの価格を計算してINSERT（毎回記録）
        let updatedCount = 0
        let skippedCount = 0
        const errors: string[] = []
        const inserts: any[] = []

        for (const link of links) {
            try {
                const itemId = link.external_key
                const condition = link.condition || 'S'
                const itemRow = itemMap.get(itemId)

                if (!itemRow) {
                    skippedCount++
                    continue
                }

                // condition → price_* マッピング
                const conditionToPriceMap: Record<string, number | null> = {
                    'S': itemRow.price_s,
                    'normal': itemRow.price_s,
                    '素体': itemRow.price_s,
                    'PSA10': itemRow.price_s,
                    'A': itemRow.price_a,
                    'A-': itemRow.price_am,
                    'B': itemRow.price_b,
                    'C': itemRow.price_c,
                    'sealed': itemRow.price_s,
                    '未開封': itemRow.price_s,
                }
                const priceYen = conditionToPriceMap[condition] ?? itemRow.price_s

                if (!priceYen || priceYen === 0) {
                    skippedCount++
                    continue
                }

                // 毎回INSERTリストに追加（価格変動の有無に関係なく）
                inserts.push({
                    card_id: link.card_id,
                    shop_id: shop.id,
                    price: priceYen,
                    condition: condition,
                    link_id: link.id,
                })
                updatedCount++
            } catch (err: any) {
                const cardName = (link as any).card?.name || link.card_id
                errors.push(`${cardName}(${link.label}): ${err.message}`)
            }
        }

        // ⑤ バッチINSERT（100件ずつ）
        for (let i = 0; i < inserts.length; i += 100) {
            const batch = inserts.slice(i, i + 100)
            const { error: insertError } = await supabase
                .from('purchase_prices')
                .insert(batch)
            if (insertError) {
                errors.push(`Batch insert error: ${insertError.message}`)
            }
        }

        const elapsed = ((Date.now() - start) / 1000).toFixed(1)

        return NextResponse.json({
            success: true,
            total_links: links.length,
            items_found: itemMap.size,
            items_missing: externalKeys.length - itemMap.size,
            updated: updatedCount,
            skipped: skippedCount,
            elapsed: `${elapsed}s`,
            errors: errors.length > 0 ? errors : undefined,
        })
    } catch (error: any) {
        const elapsed = ((Date.now() - start) / 1000).toFixed(1)

        return NextResponse.json({
            error: error.message,
            elapsed: `${elapsed}s`,
        }, { status: 500 })
    }
}
