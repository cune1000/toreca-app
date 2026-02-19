import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// 持ち出し統計（資金ロック額等）
export async function GET() {
    try {
        // pending アイテムの集計
        const { data: pendingItems, error: itemsError } = await supabase
            .from('pos_checkout_items')
            .select('quantity, unit_cost, unit_expense')
            .eq('status', 'pending')

        if (itemsError) throw itemsError

        const items = pendingItems || []
        const lockedAmount = items.reduce((sum, i) => sum + i.unit_cost * i.quantity, 0)
        const lockedExpenses = items.reduce((sum, i) => sum + i.unit_expense * i.quantity, 0)

        // open フォルダ数
        const { count: openFolders } = await supabase
            .from('pos_checkout_folders')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'open')

        return NextResponse.json({
            success: true,
            data: {
                lockedAmount,
                lockedExpenses,
                totalLockedValue: lockedAmount + lockedExpenses,
                pendingItems: items.length,
                openFolders: openFolders || 0,
            },
        })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
