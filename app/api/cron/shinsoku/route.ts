import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchShinsokuItems, toYen } from '@/lib/shinsoku'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// シンソク買取価格 定期取得cron
// GET /api/cron/shinsoku
export async function GET(request: NextRequest) {
    // cron認証チェック
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        if (process.env.NODE_ENV !== 'development') {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }
    }

    const startTime = Date.now()

    try {
        // ① shinsoku_item_idが設定されているカードを取得
        const { data: linkedCards, error: cardsError } = await supabase
            .from('cards')
            .select('id, name, shinsoku_item_id, shinsoku_condition')
            .not('shinsoku_item_id', 'is', null)

        if (cardsError) throw cardsError

        if (!linkedCards || linkedCards.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No linked cards',
                linked: 0,
                updated: 0,
                duration: Date.now() - startTime,
            })
        }

        // ② シンソクAPIから全商品を取得（ポケモン）
        const allItems = await fetchShinsokuItems('ポケモン', 'ALL')
        const itemMap = new Map(allItems.map(item => [item.item_id, item]))

        // ③ シンソクのshop_idを取得
        const { data: shop } = await supabase
            .from('purchase_shops')
            .select('id')
            .eq('name', 'シンソク（郵送買取）')
            .single()

        if (!shop) {
            throw new Error('シンソクがpurchase_shopsに未登録。マイグレーションSQLを実行してください。')
        }

        let updatedCount = 0
        let skippedCount = 0
        const errors: string[] = []

        // ④ 各カードの価格を記録
        for (const card of linkedCards) {
            try {
                const item = itemMap.get(card.shinsoku_item_id)
                if (!item) {
                    skippedCount++
                    continue
                }

                // 選択ランクの価格を取得
                const condition = card.shinsoku_condition || 'S'
                const conditionMap: Record<string, string> = {
                    'S': 'postal_purchase_price_s',
                    'A': 'postal_purchase_price_a',
                    'A-': 'postal_purchase_price_am',
                    'B': 'postal_purchase_price_b',
                    'C': 'postal_purchase_price_c',
                }
                const priceField = conditionMap[condition] || 'postal_purchase_price_s'
                const priceYen = item[priceField as keyof typeof item] as number | null
                if (priceYen === null || priceYen === undefined || priceYen <= 0) {
                    skippedCount++
                    continue
                }

                // 前回の価格を取得（同じshop_idの最新レコード）
                const { data: lastPrice } = await supabase
                    .from('purchase_prices')
                    .select('price')
                    .eq('card_id', card.id)
                    .eq('shop_id', shop.id)
                    .order('created_at', { ascending: false })
                    .limit(1)
                    .single()

                // 価格変動があればINSERT
                if (!lastPrice || lastPrice.price !== priceYen) {
                    await supabase.from('purchase_prices').insert({
                        card_id: card.id,
                        shop_id: shop.id,
                        price: priceYen,
                    })
                    updatedCount++
                } else {
                    skippedCount++
                }
            } catch (err: any) {
                errors.push(`${card.name}: ${err.message}`)
            }
        }

        // ⑤ ログ記録
        await supabase.from('cron_logs').insert({
            job_name: 'shinsoku_kaitori',
            status: errors.length > 0 ? 'partial' : 'success',
            details: {
                linked_cards: linkedCards.length,
                api_items: allItems.length,
                updated: updatedCount,
                skipped: skippedCount,
                errors: errors.length > 0 ? errors : undefined,
            },
            executed_at: new Date().toISOString(),
        })

        return NextResponse.json({
            success: true,
            linked: linkedCards.length,
            fetched: allItems.length,
            updated: updatedCount,
            skipped: skippedCount,
            errors: errors.length,
            duration: Date.now() - startTime,
        })
    } catch (error: any) {
        // エラーログ
        try {
            await supabase.from('cron_logs').insert({
                job_name: 'shinsoku_kaitori',
                status: 'error',
                details: { error: error.message },
                executed_at: new Date().toISOString(),
            })
        } catch { }

        return NextResponse.json({
            success: false,
            error: error.message,
            duration: Date.now() - startTime,
        }, { status: 500 })
    }
}
