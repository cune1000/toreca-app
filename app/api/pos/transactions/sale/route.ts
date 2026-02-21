import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { inventory_id, quantity, unit_price, transaction_date, notes, lot_id } = body

        if (!inventory_id || !quantity || quantity <= 0 || !Number.isInteger(quantity) || unit_price === undefined || unit_price === null || unit_price < 0) {
            return NextResponse.json({ success: false, error: '入力値が不正です' }, { status: 400 })
        }

        // 1. 在庫を取得
        const { data: inventory, error: invError } = await supabase
            .from('pos_inventory')
            .select('*, catalog:pos_catalogs(tracking_mode)')
            .eq('id', inventory_id)
            .single()

        if (invError || !inventory) {
            return NextResponse.json({ success: false, error: '在庫が見つかりません' }, { status: 404 })
        }

        const isLotMode = inventory.catalog?.tracking_mode === 'lot'

        // LOTモードではlot_idが必須
        let lot: any = null
        if (isLotMode) {
            if (!lot_id) {
                return NextResponse.json({ success: false, error: 'LOTモードではロットを選択してください' }, { status: 400 })
            }
            const { data: lotData, error: lotError } = await supabase
                .from('pos_lots')
                .select('*')
                .eq('id', lot_id)
                .single()
            if (lotError || !lotData) {
                return NextResponse.json({ success: false, error: 'ロットが見つかりません' }, { status: 404 })
            }
            if (lotData.remaining_qty < quantity) {
                return NextResponse.json({ success: false, error: `ロット残数不足です（残: ${lotData.remaining_qty}点）` }, { status: 400 })
            }
            lot = lotData
        }

        if (inventory.quantity < quantity) {
            return NextResponse.json({ success: false, error: `在庫不足です（在庫: ${inventory.quantity}点）` }, { status: 400 })
        }

        // 2. 利益計算
        let profit: number
        let profitRate: number
        let expenseTotal: number

        if (lot) {
            // LOTモード: ロット原価ベースで計算
            profit = (unit_price - lot.unit_cost) * quantity
            profitRate = lot.unit_cost > 0
                ? Math.round((unit_price - lot.unit_cost) / lot.unit_cost * 10000) / 100
                : 0
            expenseTotal = lot.unit_expense * quantity
        } else {
            // AVERAGEモード: 移動平均ベースで計算（既存）
            profit = (unit_price - inventory.avg_purchase_price) * quantity
            profitRate = inventory.avg_purchase_price > 0
                ? Math.round((unit_price - inventory.avg_purchase_price) / inventory.avg_purchase_price * 10000) / 100
                : 0
            const avgExpense = inventory.avg_expense_per_unit || 0
            expenseTotal = avgExpense * quantity
        }

        const newQuantity = inventory.quantity - quantity

        // 3. 在庫を更新
        const { error: updateError } = await supabase
            .from('pos_inventory')
            .update({
                quantity: newQuantity,
                updated_at: new Date().toISOString(),
            })
            .eq('id', inventory_id)

        if (updateError) throw updateError

        // 4. LOTモードの場合、ロットのremaining_qtyを減少
        if (lot) {
            const { error: lotUpdateError } = await supabase
                .from('pos_lots')
                .update({ remaining_qty: lot.remaining_qty - quantity })
                .eq('id', lot.id)
            if (lotUpdateError) throw lotUpdateError
        }

        // 5. 取引レコード作成
        const { data: transaction, error: txError } = await supabase
            .from('pos_transactions')
            .insert({
                inventory_id,
                type: 'sale',
                quantity,
                unit_price,
                total_price: unit_price * quantity,
                expenses: expenseTotal,
                profit,
                profit_rate: profitRate,
                transaction_date: transaction_date || new Date().toISOString().split('T')[0],
                notes: notes || null,
                lot_id: lot?.id || null,
            })
            .select()
            .single()

        if (txError) throw txError

        // 6. 履歴レコード作成
        const { error: historyError } = await supabase
            .from('pos_history')
            .insert({
                inventory_id,
                action_type: 'sale',
                quantity_change: -quantity,
                quantity_before: inventory.quantity,
                quantity_after: newQuantity,
                transaction_id: transaction?.id,
            })
        if (historyError) throw historyError

        return NextResponse.json({
            success: true,
            transaction,
            inventory: { id: inventory_id, quantity: newQuantity },
        })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
