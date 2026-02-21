import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// アイテム返却（在庫に戻す）— 部分返却対応
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const body = await request.json().catch(() => ({}))
        const { notes, resolve_quantity } = body

        // アイテム取得
        const { data: item, error: itemError } = await supabase
            .from('pos_checkout_items')
            .select('*, folder:pos_checkout_folders(name)')
            .eq('id', id)
            .single()

        if (itemError || !item) {
            return NextResponse.json({ success: false, error: 'アイテムが見つかりません' }, { status: 404 })
        }
        if (item.status !== 'pending') {
            return NextResponse.json({ success: false, error: '既に処理済みです' }, { status: 400 })
        }

        const qty = resolve_quantity && Number.isInteger(resolve_quantity) && resolve_quantity > 0
            ? Math.min(resolve_quantity, item.quantity)
            : item.quantity
        const isPartial = qty < item.quantity

        // 在庫に戻す
        const { data: inventory } = await supabase
            .from('pos_inventory')
            .select('quantity')
            .eq('id', item.inventory_id)
            .single()

        const currentQty = inventory?.quantity ?? 0
        const newQuantity = currentQty + qty

        const { error: updateError } = await supabase
            .from('pos_inventory')
            .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
            .eq('id', item.inventory_id)
        if (updateError) throw updateError

        // LOTモード: ロットのremaining_qtyを戻す
        if (item.lot_id) {
            const { data: lot } = await supabase
                .from('pos_lots')
                .select('remaining_qty')
                .eq('id', item.lot_id)
                .single()
            if (lot) {
                const { error: lotUpdateError } = await supabase
                    .from('pos_lots')
                    .update({ remaining_qty: lot.remaining_qty + qty })
                    .eq('id', item.lot_id)
                if (lotUpdateError) throw lotUpdateError
            }
        }

        // 履歴記録
        const { error: historyError } = await supabase
            .from('pos_history')
            .insert({
                inventory_id: item.inventory_id,
                action_type: 'return',
                quantity_change: qty,
                quantity_before: currentQty,
                quantity_after: newQuantity,
                reason: `持ち出し返却: ${item.folder?.name || ''}`,
                notes: notes || null,
            })
        if (historyError) throw historyError

        if (isPartial) {
            // 部分返却: 元アイテムの数量を減らし、解決分を新しいアイテムとして作成
            const { error: partialUpdateError } = await supabase
                .from('pos_checkout_items')
                .update({ quantity: item.quantity - qty, updated_at: new Date().toISOString() })
                .eq('id', id)
            if (partialUpdateError) throw partialUpdateError

            const { error: partialInsertError } = await supabase
                .from('pos_checkout_items')
                .insert({
                    folder_id: item.folder_id,
                    inventory_id: item.inventory_id,
                    quantity: qty,
                    unit_cost: item.unit_cost,
                    unit_expense: item.unit_expense,
                    status: 'returned',
                    resolved_at: new Date().toISOString(),
                    resolution_notes: notes || null,
                })
            if (partialInsertError) throw partialInsertError
        } else {
            // 全量返却
            const { error: fullUpdateError } = await supabase
                .from('pos_checkout_items')
                .update({
                    status: 'returned',
                    resolved_at: new Date().toISOString(),
                    resolution_notes: notes || null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', id)
            if (fullUpdateError) throw fullUpdateError
        }

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
