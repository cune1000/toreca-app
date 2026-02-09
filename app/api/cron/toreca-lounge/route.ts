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
        // ① 紐付け済みカードを取得
        const { data: linkedCards, error: cardsError } = await supabase
            .from('cards')
            .select('id, name, lounge_card_key')
            .not('lounge_card_key', 'is', null)

        if (cardsError) throw cardsError

        if (!linkedCards || linkedCards.length === 0) {
            return NextResponse.json({ success: true, message: 'No linked cards', synced: 0 })
        }

        // ② トレカラウンジから全カードを取得
        const loungeCards = await fetchAllLoungeCards()
        const loungeMap = new Map(loungeCards.map(c => [c.key, c]))

        // ③ トレカラウンジの shop_id を取得
        const { data: shop } = await supabase
            .from('purchase_shops')
            .select('id')
            .eq('name', 'トレカラウンジ（郵送買取）')
            .single()

        if (!shop) throw new Error('トレカラウンジがpurchase_shopsに未登録')

        let updatedCount = 0
        const errors: string[] = []

        // ④ 各カードの価格を記録
        for (const card of linkedCards) {
            try {
                const loungeCard = loungeMap.get(card.lounge_card_key)
                if (!loungeCard || loungeCard.price === 0) continue

                // 前回の価格を取得
                const { data: lastPrice } = await supabase
                    .from('purchase_prices')
                    .select('price')
                    .eq('card_id', card.id)
                    .eq('shop_id', shop.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single()

                // 価格変動があればINSERT
                if (!lastPrice || lastPrice.price !== loungeCard.price) {
                    await supabase.from('purchase_prices').insert({
                        card_id: card.id,
                        shop_id: shop.id,
                        price: loungeCard.price,
                        condition: 'normal',
                    })
                    updatedCount++
                }
            } catch (err: any) {
                errors.push(`${card.name}: ${err.message}`)
            }
        }

        const elapsed = ((Date.now() - start) / 1000).toFixed(1)

        // ⑤ ログ記録
        await supabase.from('cron_logs').insert({
            job_name: 'toreca_lounge_kaitori',
            status: 'success',
            details: {
                linked_cards: linkedCards.length,
                scraped_cards: loungeCards.length,
                updated: updatedCount,
                elapsed: `${elapsed}s`,
                errors: errors.length > 0 ? errors : undefined,
            },
        })

        return NextResponse.json({
            success: true,
            linked: linkedCards.length,
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
