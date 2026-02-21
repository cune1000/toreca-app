import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// pendingアイテムの取消（在庫に戻して完全削除）
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params

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
            return NextResponse.json({ success: false, error: '保留中のアイテムのみ取消できます。解決済みの場合は「やり直し」を使ってください' }, { status: 400 })
        }

        // 在庫に戻す
        const { data: inventory } = await supabase
            .from('pos_inventory')
            .select('quantity')
            .eq('id', item.inventory_id)
            .single()

        const currentQty = inventory?.quantity ?? 0
        const newQuantity = currentQty + item.quantity

        const { error: updateError } = await supabase
            .from('pos_inventory')
            .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
            .eq('id', item.inventory_id)

        if (updateError) throw updateError

        // LOTモード: ロットのremaining_qtyを復元
        if (item.lot_id) {
            const { data: lot } = await supabase
                .from('pos_lots')
                .select('remaining_qty')
                .eq('id', item.lot_id)
                .single()
            if (lot) {
                const { error: lotUpdateError } = await supabase
                    .from('pos_lots')
                    .update({ remaining_qty: lot.remaining_qty + item.quantity })
                    .eq('id', item.lot_id)
                if (lotUpdateError) throw lotUpdateError
            }
        }

        // 履歴記録
        const { error: historyError } = await supabase
            .from('pos_history')
            .insert({
                inventory_id: item.inventory_id,
                action_type: 'adjustment',
                quantity_change: item.quantity,
                quantity_before: currentQty,
                quantity_after: newQuantity,
                reason: `持ち出し取消: ${item.folder?.name || ''}`,
            })

        if (historyError) throw historyError

        // アイテムを物理削除
        const { error: deleteError } = await supabase
            .from('pos_checkout_items')
            .delete()
            .eq('id', id)

        if (deleteError) throw deleteError

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
