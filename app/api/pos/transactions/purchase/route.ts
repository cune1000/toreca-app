import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { catalog_id, condition, quantity, unit_price, expenses, transaction_date, notes } = body

        if (!catalog_id || !condition || !quantity || quantity <= 0 || !Number.isInteger(quantity) || unit_price === undefined || unit_price === null || unit_price < 0) {
            return NextResponse.json({ success: false, error: '入力値が不正です' }, { status: 400 })
        }

        const totalExpenses = expenses || 0
        const expensePerUnit = quantity > 0 ? Math.round(totalExpenses / quantity) : 0

        // 1. 在庫レコードを検索（なければ作成）
        let { data: inventory, error: selectError } = await supabase
            .from('pos_inventory')
            .select('*')
            .eq('catalog_id', catalog_id)
            .eq('condition', condition)
            .maybeSingle()

        if (selectError) throw selectError

        if (!inventory) {
            // upsert的に挿入（重複時はselect fallback）
            const { data: newInv, error: insertError } = await supabase
                .from('pos_inventory')
                .insert({
                    catalog_id,
                    condition,
                    quantity: 0,
                    avg_purchase_price: 0,
                    total_purchase_cost: 0,
                    total_purchased: 0,
                    avg_expense_per_unit: 0,
                    total_expenses: 0,
                })
                .select()
                .single()

            if (insertError) {
                // 競合で挿入失敗した場合は再取得
                const { data: existing } = await supabase
                    .from('pos_inventory')
                    .select('*')
                    .eq('catalog_id', catalog_id)
                    .eq('condition', condition)
                    .maybeSingle()
                if (!existing) throw insertError
                inventory = existing
            } else {
                inventory = newInv
            }
        }

        // 2. 移動平均を再計算（仕入れ単価）
        const newTotalPurchased = inventory.total_purchased + quantity
        const newAvg = Math.round(
            (inventory.avg_purchase_price * inventory.total_purchased + unit_price * quantity)
            / newTotalPurchased
        )
        const newTotalCost = inventory.total_purchase_cost + (unit_price * quantity)
        const newQuantity = inventory.quantity + quantity

        // 3. 経費の移動平均を再計算（在庫原価には含めない）
        const newTotalExpenses = (inventory.total_expenses || 0) + totalExpenses
        const newAvgExpense = newTotalPurchased > 0
            ? Math.round(newTotalExpenses / newTotalPurchased)
            : 0

        // 4. 在庫を更新
        const { error: updateError } = await supabase
            .from('pos_inventory')
            .update({
                quantity: newQuantity,
                avg_purchase_price: newAvg,
                total_purchase_cost: newTotalCost,
                total_purchased: newTotalPurchased,
                avg_expense_per_unit: newAvgExpense,
                total_expenses: newTotalExpenses,
                updated_at: new Date().toISOString(),
            })
            .eq('id', inventory.id)

        if (updateError) throw updateError

        // 5. 取引レコード作成
        const { data: transaction, error: txError } = await supabase
            .from('pos_transactions')
            .insert({
                inventory_id: inventory.id,
                type: 'purchase',
                quantity,
                unit_price,
                total_price: unit_price * quantity,
                expenses: totalExpenses,
                transaction_date: transaction_date || new Date().toISOString().split('T')[0],
                notes: notes || null,
            })
            .select()
            .single()

        if (txError) throw txError

        // 6. 履歴レコード作成
        await supabase
            .from('pos_history')
            .insert({
                inventory_id: inventory.id,
                action_type: 'purchase',
                quantity_change: quantity,
                quantity_before: inventory.quantity,
                quantity_after: newQuantity,
                transaction_id: transaction?.id,
            })

        return NextResponse.json({
            success: true,
            transaction,
            inventory: {
                id: inventory.id,
                quantity: newQuantity,
                avg_purchase_price: newAvg,
                avg_expense_per_unit: newAvgExpense,
            },
        })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
