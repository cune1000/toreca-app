import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ロット番号を自動生成（L-YYYYMMDD-NNN）
async function generateLotNumber(): Promise<string> {
    const now = new Date()
    const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
    const today = jst.toISOString().split('T')[0].replace(/-/g, '')
    const prefix = `L-${today}-`
    const { data: latest } = await supabase
        .from('pos_lots')
        .select('lot_number')
        .like('lot_number', `${prefix}%`)
        .order('lot_number', { ascending: false })
        .limit(1)
        .maybeSingle()
    let seq = 1
    if (latest?.lot_number) {
        const lastSeq = parseInt(latest.lot_number.replace(prefix, ''), 10)
        if (!isNaN(lastSeq)) seq = lastSeq + 1
    }
    return `${prefix}${String(seq).padStart(3, '0')}`
}

// アイテム変換（状態変更 + 新conditionに入庫）
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const body = await request.json()
        const { new_condition, expenses, notes, resolve_quantity } = body

        if (!new_condition?.trim()) {
            return NextResponse.json({ success: false, error: '変換先の状態を選択してください' }, { status: 400 })
        }
        if (expenses !== undefined && expenses !== null && expenses < 0) {
            return NextResponse.json({ success: false, error: '経費は0以上を入力してください' }, { status: 400 })
        }

        // アイテム取得
        const { data: item, error: itemError } = await supabase
            .from('pos_checkout_items')
            .select('*, folder:pos_checkout_folders(name), inventory:pos_inventory(*, catalog:pos_catalogs(*))')
            .eq('id', id)
            .single()

        if (itemError || !item) {
            return NextResponse.json({ success: false, error: 'アイテムが見つかりません' }, { status: 404 })
        }
        if (item.status !== 'pending') {
            return NextResponse.json({ success: false, error: '既に処理済みです' }, { status: 400 })
        }

        const catalogId = item.inventory?.catalog_id
        if (!catalogId) {
            return NextResponse.json({ success: false, error: 'カタログ情報が見つかりません' }, { status: 400 })
        }

        const isTargetLotMode = item.inventory?.catalog?.tracking_mode === 'lot'
        const totalExpenses = expenses || 0
        const unitCost = item.unit_cost
        const requestedQty = resolve_quantity && Number.isInteger(resolve_quantity) && resolve_quantity > 0
            ? Math.min(resolve_quantity, item.quantity)
            : item.quantity
        const quantity = requestedQty
        const isPartial = quantity < item.quantity

        // 変換先の在庫を検索・作成（registerPurchaseと同じパターン）
        let { data: targetInv } = await supabase
            .from('pos_inventory')
            .select('*')
            .eq('catalog_id', catalogId)
            .eq('condition', new_condition.trim())
            .maybeSingle()

        if (!targetInv) {
            const { data: newInv, error: insertError } = await supabase
                .from('pos_inventory')
                .insert({
                    catalog_id: catalogId,
                    condition: new_condition.trim(),
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
                const { data: existing } = await supabase
                    .from('pos_inventory')
                    .select('*')
                    .eq('catalog_id', catalogId)
                    .eq('condition', new_condition.trim())
                    .maybeSingle()
                if (!existing) throw insertError
                targetInv = existing
            } else {
                targetInv = newInv
            }
        }

        // 移動平均再計算（元の仕入原価を引き継ぎ + 変換経費を経費に加算）
        const newTotalPurchased = targetInv.total_purchased + quantity
        const newAvg = Math.round(
            (targetInv.avg_purchase_price * targetInv.total_purchased + unitCost * quantity) / newTotalPurchased
        )
        const newTotalCost = targetInv.total_purchase_cost + (unitCost * quantity)
        const newQuantity = targetInv.quantity + quantity

        // 経費: 元の経費 + 変換経費
        const originalExpenses = item.unit_expense * quantity
        const newTotalExpenses = (targetInv.total_expenses || 0) + originalExpenses + totalExpenses
        const newAvgExpense = newTotalPurchased > 0 ? Math.round(newTotalExpenses / newTotalPurchased) : 0

        // 変換先在庫を更新
        const { error: targetUpdateError } = await supabase
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
            .eq('id', targetInv.id)
        if (targetUpdateError) throw targetUpdateError

        // 取引レコード（purchaseとして記録）
        const { data: transaction, error: txError } = await supabase
            .from('pos_transactions')
            .insert({
                inventory_id: targetInv.id,
                type: 'purchase',
                quantity,
                unit_price: unitCost,
                total_price: unitCost * quantity,
                expenses: originalExpenses + totalExpenses,
                transaction_date: new Date().toISOString().split('T')[0],
                notes: notes
                    ? `持ち出し変換: ${item.inventory?.condition} → ${new_condition.trim()} (${notes})`
                    : `持ち出し変換: ${item.inventory?.condition} → ${new_condition.trim()} (${item.folder?.name || ''})`,
                is_checkout: true,
            })
            .select()
            .single()

        if (txError) throw txError

        // LOTモード: 変換先にロットを自動作成
        let convertLotId: string | null = null
        if (isTargetLotMode) {
            const lotNumber = await generateLotNumber()
            const unitExpense = quantity > 0 ? Math.round((originalExpenses + totalExpenses) / quantity) : 0
            const { data: newLot, error: lotError } = await supabase
                .from('pos_lots')
                .insert({
                    lot_number: lotNumber,
                    source_id: null,
                    inventory_id: targetInv.id,
                    quantity,
                    remaining_qty: quantity,
                    unit_cost: unitCost,
                    expenses: originalExpenses + totalExpenses,
                    unit_expense: unitExpense,
                    purchase_date: new Date().toISOString().split('T')[0],
                    transaction_id: transaction?.id || null,
                    notes: `持ち出し変換: ${item.inventory?.condition} → ${new_condition.trim()}`,
                })
                .select()
                .single()
            if (lotError) throw lotError
            convertLotId = newLot?.id || null

            // 取引にlot_idを記録
            if (convertLotId) {
                await supabase.from('pos_transactions').update({ lot_id: convertLotId }).eq('id', transaction.id)
            }
        }

        // 履歴記録
        const { error: historyError } = await supabase
            .from('pos_history')
            .insert({
                inventory_id: targetInv.id,
                action_type: 'purchase',
                quantity_change: quantity,
                quantity_before: targetInv.quantity,
                quantity_after: newQuantity,
                transaction_id: transaction?.id,
                reason: `持ち出し変換: ${item.inventory?.condition} → ${new_condition.trim()}`,
                notes: notes || null,
            })
        if (historyError) throw historyError

        if (isPartial) {
            // 部分変換: 元アイテムの数量を減らし、解決分を新しいアイテムとして作成
            const { error: partialUpdateError } = await supabase
                .from('pos_checkout_items')
                .update({ quantity: item.quantity - quantity, updated_at: new Date().toISOString() })
                .eq('id', id)
            if (partialUpdateError) throw partialUpdateError

            const { error: partialInsertError } = await supabase
                .from('pos_checkout_items')
                .insert({
                    folder_id: item.folder_id,
                    inventory_id: item.inventory_id,
                    quantity,
                    unit_cost: item.unit_cost,
                    unit_expense: item.unit_expense,
                    lot_id: item.lot_id || null,
                    status: 'converted',
                    converted_condition: new_condition.trim(),
                    converted_expenses: totalExpenses,
                    transaction_id: transaction?.id || null,
                    resolved_at: new Date().toISOString(),
                    resolution_notes: notes || null,
                })
            if (partialInsertError) throw partialInsertError
        } else {
            // 全量変換
            const { error: fullUpdateError } = await supabase
                .from('pos_checkout_items')
                .update({
                    status: 'converted',
                    converted_condition: new_condition.trim(),
                    converted_expenses: totalExpenses,
                    transaction_id: transaction?.id || null,
                    resolved_at: new Date().toISOString(),
                    resolution_notes: notes || null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', id)
            if (fullUpdateError) throw fullUpdateError
        }

        return NextResponse.json({ success: true, data: { transaction, new_condition: new_condition.trim() } })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
