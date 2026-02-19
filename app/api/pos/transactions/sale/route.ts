import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { inventory_id, quantity, unit_price, transaction_date, notes } = body

        if (!inventory_id || !quantity || quantity <= 0 || !Number.isInteger(quantity) || unit_price === undefined || unit_price === null || unit_price < 0) {
            return NextResponse.json({ success: false, error: '入力値が不正です' }, { status: 400 })
        }

        // 1. 在庫を取得
        const { data: inventory, error: invError } = await supabase
            .from('pos_inventory')
            .select('*')
            .eq('id', inventory_id)
            .single()

        if (invError || !inventory) {
            return NextResponse.json({ success: false, error: '在庫が見つかりません' }, { status: 404 })
        }

        if (inventory.quantity < quantity) {
            return NextResponse.json({ success: false, error: `在庫不足です（在庫: ${inventory.quantity}点）` }, { status: 400 })
        }

        // 2. 利益計算（粗利 = 販売価格 - 仕入原価）
        const profit = (unit_price - inventory.avg_purchase_price) * quantity
        const profitRate = inventory.avg_purchase_price > 0
            ? Math.round((unit_price - inventory.avg_purchase_price) / inventory.avg_purchase_price * 10000) / 100
            : 0

        // 経費を含めた実利益（expenses フィールドに経費合計を記録）
        const avgExpense = inventory.avg_expense_per_unit || 0
        const expenseTotal = avgExpense * quantity

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

        // 4. 取引レコード作成（expensesに販売時の経費按分額を記録）
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
            })
            .select()
            .single()

        if (txError) throw txError

        // 5. 履歴レコード作成
        await supabase
            .from('pos_history')
            .insert({
                inventory_id,
                action_type: 'sale',
                quantity_change: -quantity,
                quantity_before: inventory.quantity,
                quantity_after: newQuantity,
                transaction_id: transaction?.id,
            })

        return NextResponse.json({
            success: true,
            transaction,
            inventory: { id: inventory_id, quantity: newQuantity },
        })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
