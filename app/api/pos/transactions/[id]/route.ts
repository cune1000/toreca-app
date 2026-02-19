import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// 在庫を全取引から再計算する（full replay方式）
async function recalculateInventory(inventoryId: string) {
    const { data: allTxs } = await supabase
        .from('pos_transactions')
        .select('*')
        .eq('inventory_id', inventoryId)
        .order('transaction_date', { ascending: true })
        .order('created_at', { ascending: true })

    let quantity = 0
    let avgPurchasePrice = 0
    let totalPurchaseCost = 0
    let totalPurchased = 0
    let totalExpenses = 0

    for (const tx of (allTxs || [])) {
        if (tx.type === 'purchase') {
            const newTotalPurchased = totalPurchased + tx.quantity
            avgPurchasePrice = newTotalPurchased > 0
                ? Math.round((avgPurchasePrice * totalPurchased + tx.unit_price * tx.quantity) / newTotalPurchased)
                : 0
            totalPurchased = newTotalPurchased
            totalPurchaseCost += tx.unit_price * tx.quantity
            totalExpenses += tx.expenses || 0
            quantity += tx.quantity
        } else if (tx.type === 'sale') {
            const avgExpense = totalPurchased > 0 ? Math.round(totalExpenses / totalPurchased) : 0
            const profit = (tx.unit_price - avgPurchasePrice) * tx.quantity
            const profitRate = avgPurchasePrice > 0
                ? Math.round((tx.unit_price - avgPurchasePrice) / avgPurchasePrice * 10000) / 100
                : 0

            // 販売取引の利益と経費按分を再計算
            await supabase.from('pos_transactions').update({
                profit,
                profit_rate: profitRate,
                expenses: avgExpense * tx.quantity,
            }).eq('id', tx.id)

            quantity -= tx.quantity
        }
    }

    const avgExpensePerUnit = totalPurchased > 0 ? Math.round(totalExpenses / totalPurchased) : 0

    await supabase.from('pos_inventory').update({
        quantity,
        avg_purchase_price: avgPurchasePrice,
        total_purchase_cost: totalPurchaseCost,
        total_purchased: totalPurchased,
        total_expenses: totalExpenses,
        avg_expense_per_unit: avgExpensePerUnit,
        updated_at: new Date().toISOString(),
    }).eq('id', inventoryId)

    return { quantity }
}

// GET: 取引1件取得
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    try {
        const { data, error } = await supabase
            .from('pos_transactions')
            .select('*, inventory:pos_inventory(*, catalog:pos_catalogs(*))')
            .eq('id', id)
            .single()

        if (error || !data) {
            return NextResponse.json({ success: false, error: '取引が見つかりません' }, { status: 404 })
        }
        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}

// PUT: 取引編集
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    try {
        const body = await request.json()
        const { quantity, unit_price, expenses, notes, transaction_date, reason } = body

        // 対象取引を取得
        const { data: tx, error: txError } = await supabase
            .from('pos_transactions')
            .select('*')
            .eq('id', id)
            .single()

        if (txError || !tx) {
            return NextResponse.json({ success: false, error: '取引が見つかりません' }, { status: 404 })
        }

        // 更新値を組み立て
        const updates: any = {}
        if (quantity !== undefined) updates.quantity = quantity
        if (unit_price !== undefined) updates.unit_price = unit_price
        if (expenses !== undefined) updates.expenses = expenses
        if (notes !== undefined) updates.notes = notes
        if (transaction_date !== undefined) updates.transaction_date = transaction_date

        // total_price を再計算
        const newQty = updates.quantity ?? tx.quantity
        const newPrice = updates.unit_price ?? tx.unit_price
        updates.total_price = newQty * newPrice

        // 取引を更新
        const { error: updateError } = await supabase
            .from('pos_transactions')
            .update(updates)
            .eq('id', id)

        if (updateError) throw updateError

        // 在庫を再計算
        const result = await recalculateInventory(tx.inventory_id)

        // 在庫がマイナスになっていないかチェック
        if (result.quantity < 0) {
            // ロールバック: 元の値に戻す
            await supabase.from('pos_transactions').update({
                quantity: tx.quantity,
                unit_price: tx.unit_price,
                total_price: tx.total_price,
                expenses: tx.expenses,
                notes: tx.notes,
                transaction_date: tx.transaction_date,
            }).eq('id', id)
            await recalculateInventory(tx.inventory_id)
            return NextResponse.json({ success: false, error: '在庫がマイナスになるため変更できません' }, { status: 400 })
        }

        // 修正履歴を記録
        const quantityDiff = (updates.quantity ?? tx.quantity) - tx.quantity
        const { data: inv } = await supabase
            .from('pos_inventory')
            .select('quantity')
            .eq('id', tx.inventory_id)
            .single()

        await supabase.from('pos_history').insert({
            inventory_id: tx.inventory_id,
            action_type: tx.type,
            quantity_change: quantityDiff,
            quantity_before: (inv?.quantity || 0) - quantityDiff,
            quantity_after: inv?.quantity || 0,
            transaction_id: id,
            is_modified: true,
            modified_at: new Date().toISOString(),
            modified_reason: reason || '取引を修正',
        })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}

// DELETE: 取引削除
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    try {
        const body = await request.json().catch(() => ({}))

        // 対象取引を取得
        const { data: tx, error: txError } = await supabase
            .from('pos_transactions')
            .select('*')
            .eq('id', id)
            .single()

        if (txError || !tx) {
            return NextResponse.json({ success: false, error: '取引が見つかりません' }, { status: 404 })
        }

        // 削除前プレチェック: 仕入れ削除の場合は在庫がマイナスにならないか確認
        if (tx.type === 'purchase') {
            const { data: inv } = await supabase
                .from('pos_inventory')
                .select('quantity')
                .eq('id', tx.inventory_id)
                .single()
            if ((inv?.quantity ?? 0) - tx.quantity < 0) {
                return NextResponse.json({ success: false, error: '在庫がマイナスになるため削除できません' }, { status: 400 })
            }
        }

        // 現在の在庫を取得（履歴記録用）
        const { data: invBefore } = await supabase
            .from('pos_inventory')
            .select('quantity')
            .eq('id', tx.inventory_id)
            .single()

        // 取引を削除
        const { error: deleteError } = await supabase
            .from('pos_transactions')
            .delete()
            .eq('id', id)

        if (deleteError) throw deleteError

        // 在庫を再計算
        const result = await recalculateInventory(tx.inventory_id)

        // 削除履歴を記録
        const reason = (body as any).reason || '取引削除'
        await supabase.from('pos_history').insert({
            inventory_id: tx.inventory_id,
            action_type: 'adjustment',
            quantity_change: tx.type === 'purchase' ? -tx.quantity : tx.quantity,
            quantity_before: invBefore?.quantity || 0,
            quantity_after: result.quantity,
            reason,
            is_modified: true,
            modified_at: new Date().toISOString(),
            modified_reason: reason,
        })

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
