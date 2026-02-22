import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// アイテムの解決を取消し、pendingに戻す
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params

        // アイテム取得
        const { data: item, error: itemError } = await supabase
            .from('pos_checkout_items')
            .select('*, folder:pos_checkout_folders(name, status), inventory:pos_inventory(*, catalog:pos_catalogs(*))')
            .eq('id', id)
            .single()

        if (itemError || !item) {
            return NextResponse.json({ success: false, error: 'アイテムが見つかりません' }, { status: 404 })
        }
        if (item.status === 'pending') {
            return NextResponse.json({ success: false, error: '既に保留中です' }, { status: 400 })
        }
        if (item.folder?.status === 'closed') {
            return NextResponse.json({ success: false, error: 'フォルダがクローズ済みのため取消できません。先にフォルダを再開してください' }, { status: 400 })
        }

        const status = item.status as string

        // === 返却の取消 ===
        if (status === 'returned') {
            // 在庫を再び減らす
            const { data: inventory } = await supabase
                .from('pos_inventory')
                .select('quantity')
                .eq('id', item.inventory_id)
                .single()

            const currentQty = inventory?.quantity ?? 0
            if (currentQty < item.quantity) {
                return NextResponse.json({
                    success: false,
                    error: `在庫が不足しています（現在 ${currentQty}点、必要 ${item.quantity}点）。返却後に販売等で在庫が減った可能性があります`,
                }, { status: 400 })
            }

            // LOTモード: ロットのバリデーションを在庫減算の前に実行（失敗時に在庫が壊れないようにする）
            let lotRemainingQty = 0
            if (item.lot_id) {
                const { data: lot } = await supabase.from('pos_lots').select('remaining_qty').eq('id', item.lot_id).single()
                if (lot) {
                    if (lot.remaining_qty < item.quantity) {
                        return NextResponse.json({
                            success: false,
                            error: `ロットの残数が不足しています（残: ${lot.remaining_qty}点、必要: ${item.quantity}点）。返却後に同ロットから販売・持ち出しが行われた可能性があります`,
                        }, { status: 400 })
                    }
                    lotRemainingQty = lot.remaining_qty
                }
            }

            const newQty = currentQty - item.quantity
            const { error: invUpdateError } = await supabase
                .from('pos_inventory')
                .update({ quantity: newQty, updated_at: new Date().toISOString() })
                .eq('id', item.inventory_id)
            if (invUpdateError) throw invUpdateError

            // LOTモード: ロットのremaining_qtyを再び減らす（バリデーション済み）
            if (item.lot_id && lotRemainingQty > 0) {
                const { error: lotErr } = await supabase.from('pos_lots').update({ remaining_qty: lotRemainingQty - item.quantity }).eq('id', item.lot_id)
                if (lotErr) throw lotErr
            }

            // 履歴記録
            const { error: histError } = await supabase
                .from('pos_history')
                .insert({
                    inventory_id: item.inventory_id,
                    action_type: 'adjustment',
                    quantity_change: -item.quantity,
                    quantity_before: currentQty,
                    quantity_after: newQty,
                    reason: `取消: 返却を元に戻し（${item.folder?.name || ''})`,
                })
            if (histError) throw histError
        }

        // === 売却の取消 ===
        if (status === 'sold') {
            // transaction_idがあれば削除
            if (item.transaction_id) {
                // 関連する履歴も削除
                const { error: histDelError } = await supabase
                    .from('pos_history')
                    .delete()
                    .eq('transaction_id', item.transaction_id)
                if (histDelError) throw histDelError

                const { error: txDelError } = await supabase
                    .from('pos_transactions')
                    .delete()
                    .eq('id', item.transaction_id)
                if (txDelError) throw txDelError
            }

            // LOTモード: 売却取消なのでロットのremaining_qtyを戻す（pending状態に戻すため）
            // ※ pendingに戻した後、再度持ち出し中扱いなのでremaining_qtyは増やさない
            // （recalculateInventoryがcheckout pendingを考慮済み）
        }

        // === 変換の取消 ===
        if (status === 'converted' && item.converted_condition) {
            const catalogId = item.inventory?.catalog_id
            if (catalogId) {
                // 変換先の在庫を巻き戻す
                const { data: targetInv } = await supabase
                    .from('pos_inventory')
                    .select('*')
                    .eq('catalog_id', catalogId)
                    .eq('condition', item.converted_condition)
                    .maybeSingle()

                if (targetInv) {
                    // 変換先の在庫不足チェック
                    if (targetInv.quantity < item.quantity) {
                        return NextResponse.json({
                            success: false,
                            error: `変換先（${item.converted_condition}）の在庫が不足しています（現在 ${targetInv.quantity}点、必要 ${item.quantity}点）。変換後に販売等で在庫が減った可能性があります`,
                        }, { status: 400 })
                    }

                    const newQty = targetInv.quantity - item.quantity
                    const newTotalPurchased = targetInv.total_purchased - item.quantity
                    const newTotalCost = targetInv.total_purchase_cost - (item.unit_cost * item.quantity)
                    const newAvg = newTotalPurchased > 0 ? Math.round(newTotalCost / newTotalPurchased) : 0

                    const originalExpenses = item.unit_expense * item.quantity
                    const convertExpenses = item.converted_expenses || 0
                    const newTotalExpenses = (targetInv.total_expenses || 0) - originalExpenses - convertExpenses
                    const newAvgExpense = newTotalPurchased > 0 ? Math.round(Math.max(0, newTotalExpenses) / newTotalPurchased) : 0

                    const { error: targetUpdateError } = await supabase
                        .from('pos_inventory')
                        .update({
                            quantity: newQty,
                            avg_purchase_price: Math.max(0, newAvg),
                            total_purchase_cost: Math.max(0, newTotalCost),
                            total_purchased: Math.max(0, newTotalPurchased),
                            avg_expense_per_unit: newAvgExpense,
                            total_expenses: Math.max(0, newTotalExpenses),
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', targetInv.id)
                    if (targetUpdateError) throw targetUpdateError
                }
            }

            // transaction_idがあれば削除
            if (item.transaction_id) {
                const { error: convHistDelError } = await supabase
                    .from('pos_history')
                    .delete()
                    .eq('transaction_id', item.transaction_id)
                if (convHistDelError) throw convHistDelError

                const { error: convTxDelError } = await supabase
                    .from('pos_transactions')
                    .delete()
                    .eq('id', item.transaction_id)
                if (convTxDelError) throw convTxDelError
            }
        }

        // アイテムをpendingに戻す
        const { error: resetError } = await supabase
            .from('pos_checkout_items')
            .update({
                status: 'pending',
                resolved_at: null,
                resolution_notes: null,
                sale_unit_price: null,
                sale_expenses: null,
                sale_profit: null,
                converted_condition: null,
                converted_expenses: null,
                transaction_id: null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', id)
        if (resetError) throw resetError

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
