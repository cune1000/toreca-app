import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { fetchAllLoungeCards } from '@/lib/toreca-lounge'

export const maxDuration = 60

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const start = Date.now()

    try {
        // ① トレカラウンジのshop_idを取得
        const { data: shops } = await supabase
            .from('purchase_shops')
            .select('id')
            .eq('name', 'トレカラウンジ（郵送買取）')
            .limit(1)

        const shop = shops?.[0]
        if (!shop) throw new Error('トレカラウンジがpurchase_shopsに未登録')

        // ② card_purchase_linksから紐付け済みを取得
        const { data: links, error: linksError } = await supabase
            .from('card_purchase_links')
            .select('id, card_id, external_key, label, condition, card:card_id(name)')
            .eq('shop_id', shop.id)

        if (linksError) throw linksError

        if (!links || links.length === 0) {
            return NextResponse.json({ success: true, message: 'No linked cards', synced: 0 })
        }

        // ③ トレカラウンジから全カードを取得
        const loungeCards = await fetchAllLoungeCards()
        const loungeMap = new Map(loungeCards.map(c => [c.key, c]))

        // ④ 各紐付けの価格を毎回記録（バッチINSERT）
        let updatedCount = 0
        let skippedCount = 0
        const errors: string[] = []
        const inserts: any[] = []

        for (const link of links) {
            try {
                const loungeCard = loungeMap.get(link.external_key)
                if (!loungeCard || loungeCard.price === 0) {
                    skippedCount++
                    continue
                }

                // 毎回INSERTリストに追加（価格変動の有無に関係なく）
                inserts.push({
                    card_id: link.card_id,
                    shop_id: shop.id,
                    price: loungeCard.price,
                    condition: link.condition || 'normal',
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
            scraped: loungeCards.length,
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
