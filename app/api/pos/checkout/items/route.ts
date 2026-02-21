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
        const { folder_id, inventory_id, quantity } = body

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
            .select('*')
            .eq('id', inventory_id)
            .single()

        if (invError || !inventory) {
            return NextResponse.json({ success: false, error: '在庫が見つかりません' }, { status: 404 })
        }

        if (inventory.quantity < quantity) {
            return NextResponse.json({ success: false, error: `在庫不足です（在庫: ${inventory.quantity}点）` }, { status: 400 })
        }

        // 在庫から引く
        const newQuantity = inventory.quantity - quantity
        const { error: updateError } = await supabase
            .from('pos_inventory')
            .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
            .eq('id', inventory_id)
        if (updateError) throw updateError

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

        // チェックアウトアイテム作成
        const { data: item, error: itemError } = await supabase
            .from('pos_checkout_items')
            .insert({
                folder_id,
                inventory_id,
                quantity,
                unit_cost: inventory.avg_purchase_price,
                unit_expense: inventory.avg_expense_per_unit || 0,
            })
            .select()
            .single()

        if (itemError) throw itemError

        return NextResponse.json({ success: true, data: item })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
