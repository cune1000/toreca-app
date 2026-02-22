import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// アイテム持ち出し（在庫から引いてフォルダに追加）
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { folder_id, inventory_id, quantity, lot_id } = body

        if (!folder_id || !inventory_id || !quantity || quantity <= 0 || !Number.isInteger(quantity)) {
            return NextResponse.json({ success: false, error: '入力値が不正です' }, { status: 400 })
        }

        // フォルダ存在確認
        const { data: folder, error: folderError } = await supabase
            .from('pos_checkout_folders')
            .select('id, name, status')
            .eq('id', folder_id)
            .single()

        if (folderError || !folder) {
            return NextResponse.json({ success: false, error: 'フォルダが見つかりません' }, { status: 404 })
        }
        if (folder.status === 'closed') {
            return NextResponse.json({ success: false, error: 'クローズ済みのフォルダです' }, { status: 400 })
        }

        // 在庫取得
        const { data: inventory, error: invError } = await supabase
            .from('pos_inventory')
            .select('*, catalog:pos_catalogs(tracking_mode)')
            .eq('id', inventory_id)
            .single()

        if (invError || !inventory) {
            return NextResponse.json({ success: false, error: '在庫が見つかりません' }, { status: 404 })
        }

        if (inventory.quantity < quantity) {
            return NextResponse.json({ success: false, error: `在庫不足です（在庫: ${inventory.quantity}点）` }, { status: 400 })
        }

        // LOTモードではlot_idが必須
        const isLotMode = inventory.catalog?.tracking_mode === 'lot'
        if (isLotMode && !lot_id) {
            return NextResponse.json({ success: false, error: 'LOTモードではロットを選択してください' }, { status: 400 })
        }

        // LOTモードの場合: 在庫減算の前にロットを検証（失敗時に在庫が壊れないようにする）
        let unitCost = inventory.avg_purchase_price
        let unitExpense = inventory.avg_expense_per_unit || 0
        let lotRemainingQty = 0
        if (lot_id) {
            const { data: lot, error: lotError } = await supabase
                .from('pos_lots')
                .select('*')
                .eq('id', lot_id)
                .single()
            if (lotError || !lot) {
                return NextResponse.json({ success: false, error: 'ロットが見つかりません' }, { status: 404 })
            }
            if (lot.remaining_qty < quantity) {
                return NextResponse.json({ success: false, error: `ロット残数不足です（残: ${lot.remaining_qty}点）` }, { status: 400 })
            }
            unitCost = lot.unit_cost
            unitExpense = lot.unit_expense
            lotRemainingQty = lot.remaining_qty
        }

        // 在庫から引く
        const newQuantity = inventory.quantity - quantity
        const { error: updateError } = await supabase
            .from('pos_inventory')
            .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
            .eq('id', inventory_id)
        if (updateError) throw updateError

        // 在庫減算成功後の操作はロールバック付きで実行
        try {
            // 履歴記録
            const { error: historyError } = await supabase
                .from('pos_history')
                .insert({
                    inventory_id,
                    action_type: 'adjustment',
                    quantity_change: -quantity,
                    quantity_before: inventory.quantity,
                    quantity_after: newQuantity,
                    reason: `持ち出し: ${folder.name}`,
                })
            if (historyError) throw historyError

            // LOTモード: ロットのremaining_qtyを減らす（バリデーション済み）
            if (lot_id) {
                const { error: lotUpdateError } = await supabase
                    .from('pos_lots')
                    .update({ remaining_qty: lotRemainingQty - quantity })
                    .eq('id', lot_id)
                if (lotUpdateError) throw lotUpdateError
            }

            // チェックアウトアイテム作成
            const { data: item, error: itemError } = await supabase
                .from('pos_checkout_items')
                .insert({
                    folder_id,
                    inventory_id,
                    quantity,
                    unit_cost: unitCost,
                    unit_expense: unitExpense,
                    lot_id: lot_id || null,
                })
                .select()
                .single()

            if (itemError) throw itemError

            return NextResponse.json({ success: true, data: item })
        } catch (innerError: any) {
            // ロールバック: 在庫を元に戻す
            await supabase
                .from('pos_inventory')
                .update({ quantity: inventory.quantity, updated_at: new Date().toISOString() })
                .eq('id', inventory_id)
            // ロールバック: ロットのremaining_qtyを元に戻す
            if (lot_id) {
                await supabase
                    .from('pos_lots')
                    .update({ remaining_qty: lotRemainingQty })
                    .eq('id', lot_id)
            }
            throw innerError
        }
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
