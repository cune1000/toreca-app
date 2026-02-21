import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// アイテム売却（pos_transactionsにsale記録）— 部分売却対応
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const body = await request.json()
        const { unit_price, sale_expenses, notes, resolve_quantity } = body

        if (unit_price === undefined || unit_price === null || unit_price < 0) {
            return NextResponse.json({ success: false, error: '売却単価を入力してください' }, { status: 400 })
        }
        if (sale_expenses !== undefined && sale_expenses !== null && sale_expenses < 0) {
            return NextResponse.json({ success: false, error: '手数料は0以上を入力してください' }, { status: 400 })
        }

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

        const totalSaleExpenses = sale_expenses || 0
        const expenseFromPurchase = item.unit_expense * qty

        // 利益計算（粗利 = 売上 - 仕入原価。通常販売と統一）
        const profit = (unit_price - item.unit_cost) * qty
        const profitRate = item.unit_cost > 0
            ? Math.round((unit_price - item.unit_cost) / item.unit_cost * 10000) / 100
            : 0

        // pos_transactions にsale記録
        const { data: transaction, error: txError } = await supabase
            .from('pos_transactions')
            .insert({
                inventory_id: item.inventory_id,
                type: 'sale',
                quantity: qty,
                unit_price,
                total_price: unit_price * qty,
                expenses: totalSaleExpenses + expenseFromPurchase,
                profit,
                profit_rate: profitRate,
                transaction_date: new Date().toISOString().split('T')[0],
                notes: notes ? `持ち出し売却: ${notes}` : `持ち出し売却（${item.folder?.name || ''})`,
                is_checkout: true,
            })
            .select()
            .single()

        if (txError) throw txError

        // 履歴記録（持ち出し時に在庫減算済みのため quantity_change は 0）
        const { data: currentInv } = await supabase
            .from('pos_inventory')
            .select('quantity')
            .eq('id', item.inventory_id)
            .single()
        const currentQty = currentInv?.quantity ?? 0

        const { error: historyError } = await supabase
            .from('pos_history')
            .insert({
                inventory_id: item.inventory_id,
                action_type: 'sale',
                quantity_change: 0,
                quantity_before: currentQty,
                quantity_after: currentQty,
                transaction_id: transaction?.id,
                reason: `持ち出し売却: ${item.folder?.name || ''}`,
                notes: notes || null,
            })
        if (historyError) throw historyError

        if (isPartial) {
            // 部分売却: 元アイテムの数量を減らし、解決分を新しいアイテムとして作成
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
                    status: 'sold',
                    sale_unit_price: unit_price,
                    sale_expenses: totalSaleExpenses,
                    sale_profit: profit,
                    transaction_id: transaction?.id || null,
                    resolved_at: new Date().toISOString(),
                    resolution_notes: notes || null,
                })
            if (partialInsertError) throw partialInsertError
        } else {
            // 全量売却
            const { error: fullUpdateError } = await supabase
                .from('pos_checkout_items')
                .update({
                    status: 'sold',
                    sale_unit_price: unit_price,
                    sale_expenses: totalSaleExpenses,
                    sale_profit: profit,
                    transaction_id: transaction?.id || null,
                    resolved_at: new Date().toISOString(),
                    resolution_notes: notes || null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', id)
            if (fullUpdateError) throw fullUpdateError
        }

        return NextResponse.json({ success: true, data: { transaction, profit } })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
