import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { catalog_id, condition, quantity, unit_price, transaction_date, notes } = body

        if (!catalog_id || !condition || !quantity || !unit_price) {
            return NextResponse.json({ success: false, error: '必須項目が不足しています' }, { status: 400 })
        }

        // 1. 在庫レコードを検索（なければ作成）
        let { data: inventory } = await supabase
            .from('pos_inventory')
            .select('*')
            .eq('catalog_id', catalog_id)
            .eq('condition', condition)
            .single()

        if (!inventory) {
            const { data: newInv, error } = await supabase
                .from('pos_inventory')
                .insert({
                    catalog_id,
                    condition,
                    quantity: 0,
                    avg_purchase_price: 0,
                    total_purchase_cost: 0,
                    total_purchased: 0,
                })
                .select()
                .single()
            if (error) throw error
            inventory = newInv
        }

        // 2. 移動平均を再計算
        const newTotalPurchased = inventory.total_purchased + quantity
        const newAvg = Math.round(
            (inventory.avg_purchase_price * inventory.total_purchased + unit_price * quantity)
            / newTotalPurchased
        )
        const newTotalCost = inventory.total_purchase_cost + (unit_price * quantity)
        const newQuantity = inventory.quantity + quantity

        // 3. 在庫を更新
        const { error: updateError } = await supabase
            .from('pos_inventory')
            .update({
                quantity: newQuantity,
                avg_purchase_price: newAvg,
                total_purchase_cost: newTotalCost,
                total_purchased: newTotalPurchased,
                updated_at: new Date().toISOString(),
            })
            .eq('id', inventory.id)

        if (updateError) throw updateError

        // 4. 取引レコード作成
        const { data: transaction, error: txError } = await supabase
            .from('pos_transactions')
            .insert({
                inventory_id: inventory.id,
                type: 'purchase',
                quantity,
                unit_price,
                total_price: unit_price * quantity,
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
            },
        })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
