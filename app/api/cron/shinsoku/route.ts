import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { shouldRunCronJob, markCronJobRun } from '@/lib/cron-gate'

export const maxDuration = 60

export async function GET(request: NextRequest) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const force = request.nextUrl.searchParams.get('force') === '1'
    const gate = await shouldRunCronJob('shinsoku', { force })
    if (!gate.shouldRun) {
        return NextResponse.json({ skipped: true, reason: gate.reason })
    }

    const start = Date.now()
    const supabase = createServiceClient()

    try {
        // ① シンソクのshop_idを取得
        const { data: shops } = await supabase
            .from('purchase_shops')
            .select('id')
            .eq('name', 'シンソク（郵送買取）')
            .limit(1)

        const shop = shops?.[0]
        if (!shop) throw new Error('シンソクがpurchase_shopsに未登録')

        // ② card_purchase_linksから紐付け済みカードを一括取得（ページネーション）
        let links: { id: string; card_id: string; external_key: string; label: string; condition: string | null; card: { name?: string } | null }[] = []
        let linkOffset = 0
        const LINK_PAGE = 1000
        while (true) {
            const { data: linkPage, error: linksError } = await supabase
                .from('card_purchase_links')
                .select('id, card_id, external_key, label, condition, card:card_id(name)')
                .eq('shop_id', shop.id)
                .range(linkOffset, linkOffset + LINK_PAGE - 1)
            if (linksError) throw linksError
            if (!linkPage || linkPage.length === 0) break
            links = links.concat(linkPage as typeof links)
            if (linkPage.length < LINK_PAGE) break
            linkOffset += LINK_PAGE
        }

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

        // ④ 各紐付けの最新価格を取得（差分チェック用・ページネーション）
        const linkIds = links.map(l => l.id)
        const latestPriceMap = new Map<string, number>()
        for (let i = 0; i < linkIds.length; i += 100) {
            const batch = linkIds.slice(i, i + 100)
            let priceOffset = 0
            while (true) {
                const { data: latestPrices } = await supabase
                    .from('purchase_prices')
                    .select('link_id, price')
                    .in('link_id', batch)
                    .order('created_at', { ascending: false })
                    .range(priceOffset, priceOffset + 999)
                if (!latestPrices || latestPrices.length === 0) break
                for (const p of latestPrices) {
                    if (!latestPriceMap.has(p.link_id)) {
                        latestPriceMap.set(p.link_id, p.price)
                    }
                }
                if (latestPrices.length < 1000) break
                priceOffset += 1000
            }
        }

        // ⑤ 各紐付けの価格を計算して差分があればINSERT
        let updatedCount = 0
        let skippedCount = 0
        let unchangedCount = 0
        const errors: string[] = []
        const inserts: { card_id: string; shop_id: string; price: number; condition: string; link_id: string }[] = []

        for (const link of links) {
            try {
                const itemId = link.external_key
                const rawCondition = link.condition || '未開封'
                const itemRow = itemMap.get(itemId)

                if (!itemRow) {
                    skippedCount++
                    continue
                }

                // condition正規化（英語→日本語）
                const conditionNormalize: Record<string, string> = {
                    'S': '未開封', 'sealed': '未開封', 'normal': '素体',
                }
                const condition = conditionNormalize[rawCondition] || rawCondition

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
                    skippedCount++
                    continue
                }

                // 前回と同じ価格ならスキップ（データ肥大化防止）
                const lastPrice = latestPriceMap.get(link.id)
                if (lastPrice === priceYen) {
                    unchangedCount++
                    continue
                }

                inserts.push({
                    card_id: link.card_id,
                    shop_id: shop.id,
                    price: priceYen,
                    condition: condition,
                    link_id: link.id,
                })
                updatedCount++
            } catch (err: unknown) {
                const errMsg = err instanceof Error ? err.message : String(err)
                const cardName = (link as { card?: { name?: string } }).card?.name || link.card_id
                errors.push(`${cardName}(${link.label}): ${errMsg}`)
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

        await markCronJobRun('shinsoku', 'success')
        return NextResponse.json({
            success: true,
            total_links: links.length,
            items_found: itemMap.size,
            items_missing: externalKeys.length - itemMap.size,
            updated: updatedCount,
            unchanged: unchangedCount,
            skipped: skippedCount,
            elapsed: `${elapsed}s`,
            errors: errors.length > 0 ? errors : undefined,
        })
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error)
        const elapsed = ((Date.now() - start) / 1000).toFixed(1)
        await markCronJobRun('shinsoku', 'error', message).catch(() => {})

        return NextResponse.json({
            error: message,
            elapsed: `${elapsed}s`,
        }, { status: 500 })
    }
}
