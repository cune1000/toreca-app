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
        const { data: shop } = await supabase
            .from('purchase_shops')
            .select('id')
            .eq('name', 'トレカラウンジ（郵送買取）')
            .single()

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

        let updatedCount = 0
        const errors: string[] = []

        // ④ 各紐付けの価格を記録
        for (const link of links) {
            try {
                const loungeCard = loungeMap.get(link.external_key)
                if (!loungeCard || loungeCard.price === 0) continue

                // 前回の価格を取得
                const { data: lastPrice } = await supabase
                    .from('purchase_prices')
                    .select('price')
                    .eq('card_id', link.card_id)
                    .eq('shop_id', shop.id)
                    .eq('link_id', link.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single()

                // 価格変動があればINSERT
                if (!lastPrice || lastPrice.price !== loungeCard.price) {
                    await supabase.from('purchase_prices').insert({
                        card_id: link.card_id,
                        shop_id: shop.id,
                        price: loungeCard.price,
                        condition: link.condition || 'normal',
                        link_id: link.id,
                    })
                    updatedCount++
                }
            } catch (err: any) {
                const cardName = (link as any).card?.name || link.card_id
                errors.push(`${cardName}(${link.label}): ${err.message}`)
            }
        }

        const elapsed = ((Date.now() - start) / 1000).toFixed(1)

        await supabase.from('cron_logs').insert({
            job_name: 'toreca_lounge_kaitori',
            status: 'success',
            details: {
                total_links: links.length,
                scraped_cards: loungeCards.length,
                updated: updatedCount,
                elapsed: `${elapsed}s`,
                errors: errors.length > 0 ? errors : undefined,
            },
        })

        return NextResponse.json({
            success: true,
            total_links: links.length,
            scraped: loungeCards.length,
            updated: updatedCount,
            elapsed: `${elapsed}s`,
            errors: errors.length > 0 ? errors : undefined,
        })
    } catch (error: any) {
        const elapsed = ((Date.now() - start) / 1000).toFixed(1)

        await supabase.from('cron_logs').insert({
            job_name: 'toreca_lounge_kaitori',
            status: 'error',
            details: { error: error.message, elapsed: `${elapsed}s` },
        })

        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
