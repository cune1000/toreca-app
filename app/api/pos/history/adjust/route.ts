import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// 在庫調整
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { inventory_id, quantity_change, reason, notes } = body

        if (!inventory_id || quantity_change === undefined || !reason) {
            return NextResponse.json({ success: false, error: '必須項目が不足しています' }, { status: 400 })
        }

        const { data: inventory, error: invError } = await supabase
            .from('pos_inventory')
            .select('*, catalog:pos_catalogs(tracking_mode)')
            .eq('id', inventory_id)
            .single()

        if (invError || !inventory) {
            return NextResponse.json({ success: false, error: '在庫が見つかりません' }, { status: 404 })
        }

        // LOTモードの在庫は調整禁止（ロットのremaining_qtyとの整合性が崩れるため）
        if (inventory.catalog?.tracking_mode === 'lot') {
            return NextResponse.json({ success: false, error: 'LOTモードの在庫は直接調整できません。ロット経由で操作してください' }, { status: 400 })
        }

        const newQuantity = inventory.quantity + quantity_change
        if (newQuantity < 0) {
            return NextResponse.json({ success: false, error: '在庫数がマイナスになります' }, { status: 400 })
        }

        // 在庫更新
        await supabase
            .from('pos_inventory')
            .update({ quantity: newQuantity, updated_at: new Date().toISOString() })
            .eq('id', inventory_id)

        // 履歴作成
        await supabase
            .from('pos_history')
            .insert({
                inventory_id,
                action_type: quantity_change < 0 ? 'dispose' : 'adjustment',
                quantity_change,
                quantity_before: inventory.quantity,
                quantity_after: newQuantity,
                reason,
                notes: notes || null,
            })

        return NextResponse.json({
            success: true,
            inventory: { id: inventory_id, quantity: newQuantity },
        })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
