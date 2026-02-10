import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const maxDuration = 60

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const start = Date.now()

    try {
        // ① シンソクのshop_idを取得
        const { data: shop } = await supabase
            .from('purchase_shops')
            .select('id')
            .eq('name', 'シンソク（郵送買取）')
            .single()

        if (!shop) throw new Error('シンソクがpurchase_shopsに未登録')

        // ② card_purchase_linksから紐付け済みカードを取得
        const { data: links, error: linksError } = await supabase
            .from('card_purchase_links')
            .select('id, card_id, external_key, label, condition, card:card_id(name)')
            .eq('shop_id', shop.id)

        if (linksError) throw linksError

        if (!links || links.length === 0) {
            return NextResponse.json({ success: true, message: 'No linked cards', synced: 0 })
        }

        let updatedCount = 0
        let skippedCount = 0
        const errors: string[] = []

        // ③ 各紐付けの価格を取得
        for (const link of links) {
            try {
                const itemId = link.external_key
                const condition = link.condition || 'S'

                // シンソクAPIから価格取得
                const res = await fetch(`https://shinsoku-tcg.com/api/items/${itemId}`)
                if (!res.ok) {
                    skippedCount++
                    continue
                }

                const itemData = await res.json()
                const prices = itemData?.prices || {}
                const conditionMap: Record<string, string> = { S: 's', A: 'a', 'A-': 'am', B: 'b', C: 'c' }
                const priceKey = conditionMap[condition] || 's'
                const priceYen = prices[priceKey]

                if (!priceYen || priceYen === 0) {
                    skippedCount++
                    continue
                }

                // 前回の価格を取得
                const { data: lastPrice } = await supabase
                    .from('purchase_prices')
                    .select('price')
                    .eq('card_id', link.card_id)
                    .eq('shop_id', shop.id)
                    .eq('condition', condition)
                    .eq('link_id', link.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single()

                // 価格変動があればINSERT
                if (!lastPrice || lastPrice.price !== priceYen) {
                    await supabase.from('purchase_prices').insert({
                        card_id: link.card_id,
                        shop_id: shop.id,
                        price: priceYen,
                        condition: condition,
                        link_id: link.id,
                    })
                    updatedCount++
                } else {
                    skippedCount++
                }
            } catch (err: any) {
                const cardName = (link as any).card?.name || link.card_id
                errors.push(`${cardName}(${link.label}): ${err.message}`)
            }
        }

        const elapsed = ((Date.now() - start) / 1000).toFixed(1)

        await supabase.from('cron_logs').insert({
            job_name: 'shinsoku_kaitori',
            status: 'success',
            details: {
                total_links: links.length,
                updated: updatedCount,
                skipped: skippedCount,
                elapsed: `${elapsed}s`,
                errors: errors.length > 0 ? errors : undefined,
            },
        })

        return NextResponse.json({
            success: true,
            total_links: links.length,
            updated: updatedCount,
            skipped: skippedCount,
            elapsed: `${elapsed}s`,
            errors: errors.length > 0 ? errors : undefined,
        })
    } catch (error: any) {
        const elapsed = ((Date.now() - start) / 1000).toFixed(1)

        await supabase.from('cron_logs').insert({
            job_name: 'shinsoku_kaitori',
            status: 'error',
            details: { error: error.message, elapsed: `${elapsed}s` },
        })

        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
