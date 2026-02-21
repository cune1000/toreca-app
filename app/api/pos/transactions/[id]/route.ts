import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// 在庫を全取引から再計算する（full replay方式）
async function recalculateInventory(inventoryId: string) {
    const { data: allTxs, error: txFetchError } = await supabase
        .from('pos_transactions')
        .select('*')
        .eq('inventory_id', inventoryId)
        .order('transaction_date', { ascending: true })
        .order('created_at', { ascending: true })

    if (txFetchError) throw txFetchError

    let quantity = 0
    let avgPurchasePrice = 0
    let totalPurchaseCost = 0
    let totalPurchased = 0
    let totalExpenses = 0

    // ロット別の販売数量を追跡（remaining_qty 再計算用）
    const lotSoldQty: Record<string, number> = {}

    for (const tx of (allTxs || [])) {
        if (tx.type === 'purchase') {
            // convert入庫（is_checkout=true）も含めて通常処理
            const newTotalPurchased = totalPurchased + tx.quantity
            avgPurchasePrice = newTotalPurchased > 0
                ? Math.round((avgPurchasePrice * totalPurchased + tx.unit_price * tx.quantity) / newTotalPurchased)
                : 0
            totalPurchased = newTotalPurchased
            totalPurchaseCost += tx.unit_price * tx.quantity
            totalExpenses += tx.expenses || 0
            quantity += tx.quantity
        } else if (tx.type === 'sale') {
            // チェックアウト売却はスキップ（持ち出し時に在庫から直接減算済み）
            if (tx.is_checkout) continue

            // ロット紐付きの販売はロット原価で利益計算
            let profit: number
            let profitRate: number
            let expenseAmount: number

            if (tx.lot_id) {
                // LOTモード: ロット原価を取得して利益計算
                const { data: lot } = await supabase.from('pos_lots').select('unit_cost, unit_expense').eq('id', tx.lot_id).single()
                if (lot) {
                    profit = (tx.unit_price - lot.unit_cost) * tx.quantity
                    profitRate = lot.unit_cost > 0
                        ? Math.round((tx.unit_price - lot.unit_cost) / lot.unit_cost * 10000) / 100
                        : 0
                    expenseAmount = lot.unit_expense * tx.quantity
                } else {
                    // ロットが見つからない場合はフォールバック
                    profit = (tx.unit_price - avgPurchasePrice) * tx.quantity
                    profitRate = avgPurchasePrice > 0
                        ? Math.round((tx.unit_price - avgPurchasePrice) / avgPurchasePrice * 10000) / 100
                        : 0
                    expenseAmount = (totalPurchased > 0 ? Math.round(totalExpenses / totalPurchased) : 0) * tx.quantity
                }
                lotSoldQty[tx.lot_id] = (lotSoldQty[tx.lot_id] || 0) + tx.quantity
            } else {
                // AVERAGEモード: 移動平均で利益計算（既存）
                const avgExpense = totalPurchased > 0 ? Math.round(totalExpenses / totalPurchased) : 0
                profit = (tx.unit_price - avgPurchasePrice) * tx.quantity
                profitRate = avgPurchasePrice > 0
                    ? Math.round((tx.unit_price - avgPurchasePrice) / avgPurchasePrice * 10000) / 100
                    : 0
                expenseAmount = avgExpense * tx.quantity
            }

            // 販売取引の利益と経費按分を再計算
            const { error: txUpdateError } = await supabase.from('pos_transactions').update({
                profit,
                profit_rate: profitRate,
                expenses: expenseAmount,
            }).eq('id', tx.id)
            if (txUpdateError) throw txUpdateError

            quantity -= tx.quantity
        }
    }

    // ロットの remaining_qty を再計算
    // チェックアウトでロットから持ち出されている分も考慮
    const { data: checkoutLotItems } = await supabase
        .from('pos_checkout_items')
        .select('lot_id, quantity')
        .eq('inventory_id', inventoryId)
        .in('status', ['pending', 'sold', 'converted'])
        .not('lot_id', 'is', null)

    const lotCheckoutQty: Record<string, number> = {}
    for (const ci of (checkoutLotItems || [])) {
        if (ci.lot_id) {
            lotCheckoutQty[ci.lot_id] = (lotCheckoutQty[ci.lot_id] || 0) + ci.quantity
        }
    }

    // 影響のあるロットの remaining_qty を一括更新
    const allLotIds = new Set([...Object.keys(lotSoldQty), ...Object.keys(lotCheckoutQty)])
    for (const lotId of allLotIds) {
        const { data: lot } = await supabase.from('pos_lots').select('quantity').eq('id', lotId).single()
        if (lot) {
            const sold = lotSoldQty[lotId] || 0
            const checkedOut = lotCheckoutQty[lotId] || 0
            const remaining = lot.quantity - sold - checkedOut
            const { error: lotUpdateError } = await supabase.from('pos_lots').update({
                remaining_qty: Math.max(0, remaining),
            }).eq('id', lotId)
            if (lotUpdateError) throw lotUpdateError
        }
    }

    // チェックアウトで持ち出されて在庫に戻っていない分を差し引く
    // pending: 持ち出し中 / sold: 売却済み / converted: 変換済み
    // returned は在庫に戻されているので差し引き不要
    const { data: activeCheckouts, error: checkoutError } = await supabase
        .from('pos_checkout_items')
        .select('quantity')
        .eq('inventory_id', inventoryId)
        .in('status', ['pending', 'sold', 'converted'])

    if (checkoutError) throw checkoutError

    const checkoutQty = (activeCheckouts || []).reduce((sum: number, ci: any) => sum + ci.quantity, 0)
    quantity -= checkoutQty

    const avgExpensePerUnit = totalPurchased > 0 ? Math.round(totalExpenses / totalPurchased) : 0

    const { error: invUpdateError } = await supabase.from('pos_inventory').update({
        quantity,
        avg_purchase_price: avgPurchasePrice,
        total_purchase_cost: totalPurchaseCost,
        total_purchased: totalPurchased,
        total_expenses: totalExpenses,
        avg_expense_per_unit: avgExpensePerUnit,
        updated_at: new Date().toISOString(),
    }).eq('id', inventoryId)
    if (invUpdateError) throw invUpdateError

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

        const { error: histError } = await supabase.from('pos_history').insert({
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
        if (histError) throw histError

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

        // LOT: 仕入れ取引に紐づくロットを削除（ロットから参照されているチェックアウトがないか確認）
        if (tx.type === 'purchase' && tx.lot_id) {
            // ロットを参照しているチェックアウトアイテムがある場合は削除不可
            const { data: lotCheckouts } = await supabase
                .from('pos_checkout_items')
                .select('id')
                .eq('lot_id', tx.lot_id)
                .limit(1)
            if (lotCheckouts && lotCheckouts.length > 0) {
                return NextResponse.json({
                    success: false,
                    error: 'このロットは持ち出しで使用中のため、取引を削除できません',
                }, { status: 400 })
            }

            // ロットを参照している他の販売取引があるか確認
            const { data: lotSales } = await supabase
                .from('pos_transactions')
                .select('id')
                .eq('lot_id', tx.lot_id)
                .neq('id', id)
                .limit(1)
            if (lotSales && lotSales.length > 0) {
                return NextResponse.json({
                    success: false,
                    error: 'このロットは販売取引で使用中のため、取引を削除できません',
                }, { status: 400 })
            }

            // ロットを削除
            const { error: lotDelError } = await supabase
                .from('pos_lots')
                .delete()
                .eq('id', tx.lot_id)
            if (lotDelError) throw lotDelError
        }

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
        const { error: delHistError } = await supabase.from('pos_history').insert({
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
        if (delHistError) throw delHistError

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
