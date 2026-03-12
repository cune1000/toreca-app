/**
 * 買取価格同期の共通ロジック
 *
 * shinsoku / toreca-lounge の cron ルートで共有する。
 * 各ルートは「外部ソースから価格を引く関数」だけを実装すれば良い。
 */

import { SupabaseClient } from '@supabase/supabase-js'
import { fetchAllPaginated } from '@/lib/supabase'

// ---------------------------------------------------------------------------
// 型定義
// ---------------------------------------------------------------------------

/** link 1 件に対して返す価格情報 */
export interface PriceLookupResult {
    price: number
    condition: string
}

/** lookupPrices に渡される link 情報 */
export interface LinkInfo {
    id: string
    card_id: string
    external_key: string
    label: string
    condition: string | null
    card: { name?: string } | null
}

/** syncPurchasePrices の戻り値 */
export interface SyncResult {
    shopId: string
    totalLinks: number
    updated: number
    unchanged: number
    skipped: number
    errors: string[]
    /** 呼び出し元が追加のレスポンスフィールドを載せるための自由領域 */
    extra: Record<string, unknown>
}

/**
 * 価格ルックアップ関数の型。
 *
 * links の配列を受け取り、各 link に対して
 * - 価格が見つかれば PriceLookupResult を返す
 * - 見つからなければ null を返す
 *
 * また extra フィールドでレスポンスに載せたい追加情報を返せる。
 */
export type LookupPricesFn = (
    links: LinkInfo[],
    supabase: SupabaseClient,
) => Promise<{
    /** link.id → PriceLookupResult | null */
    prices: Map<string, PriceLookupResult | null>
    /** レスポンスに追加したいフィールド */
    extra?: Record<string, unknown>
}>

// ---------------------------------------------------------------------------
// メイン関数
// ---------------------------------------------------------------------------

export async function syncPurchasePrices(
    supabase: SupabaseClient,
    shopName: string,
    lookupPrices: LookupPricesFn,
): Promise<SyncResult> {
    // ① shop_id を取得
    const { data: shops } = await supabase
        .from('purchase_shops')
        .select('id')
        .eq('name', shopName)
        .limit(1)

    const shop = shops?.[0]
    if (!shop) throw new Error(`${shopName}がpurchase_shopsに未登録`)

    // ② card_purchase_links から紐付け済みカードを一括取得（ページネーション）
    const links = await fetchAllPaginated<LinkInfo>(
        () =>
            supabase
                .from('card_purchase_links')
                .select('id, card_id, external_key, label, condition, card:card_id(name)')
                .eq('shop_id', shop.id),
        1000,
    )

    if (!links || links.length === 0) {
        return {
            shopId: shop.id,
            totalLinks: 0,
            updated: 0,
            unchanged: 0,
            skipped: 0,
            errors: [],
            extra: { message: 'No linked cards' },
        }
    }

    // ③ 外部ソースから価格を取得（ルート固有ロジック）
    const { prices: priceMap, extra: lookupExtra } = await lookupPrices(links, supabase)

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

    // ⑤ 差分チェック → INSERT 配列を構築
    let updatedCount = 0
    let skippedCount = 0
    let unchangedCount = 0
    const errors: string[] = []
    const inserts: { card_id: string; shop_id: string; price: number; condition: string; link_id: string }[] = []

    for (const link of links) {
        try {
            const result = priceMap.get(link.id)

            if (!result || result.price === 0) {
                skippedCount++
                continue
            }

            // 前回と同じ価格ならスキップ（データ肥大化防止）
            const lastPrice = latestPriceMap.get(link.id)
            if (lastPrice === result.price) {
                unchangedCount++
                continue
            }

            inserts.push({
                card_id: link.card_id,
                shop_id: shop.id,
                price: result.price,
                condition: result.condition,
                link_id: link.id,
            })
            updatedCount++
        } catch (err: unknown) {
            const errMsg = err instanceof Error ? err.message : String(err)
            const cardName = (link as { card?: { name?: string } }).card?.name || link.card_id
            errors.push(`${cardName}(${link.label}): ${errMsg}`)
        }
    }

    // ⑥ バッチ INSERT（100 件ずつ）
    for (let i = 0; i < inserts.length; i += 100) {
        const batch = inserts.slice(i, i + 100)
        const { error: insertError } = await supabase
            .from('purchase_prices')
            .insert(batch)
        if (insertError) {
            errors.push(`Batch insert error: ${insertError.message}`)
        }
    }

    return {
        shopId: shop.id,
        totalLinks: links.length,
        updated: updatedCount,
        unchanged: unchangedCount,
        skipped: skippedCount,
        errors,
        extra: lookupExtra ?? {},
    }
}
