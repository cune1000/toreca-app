import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ロット一覧
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const inventoryId = searchParams.get('inventory_id')
        const hasRemaining = searchParams.get('has_remaining')
        const catalogId = searchParams.get('catalog_id')

        let query = supabase
            .from('pos_lots')
            .select('*, source:pos_sources(*), inventory:pos_inventory(*, catalog:pos_catalogs(*))')
            .order('created_at', { ascending: false })

        if (inventoryId) {
            query = query.eq('inventory_id', inventoryId)
        }
        if (hasRemaining === 'true') {
            query = query.gt('remaining_qty', 0)
        }
        if (catalogId) {
            query = query.eq('inventory.catalog_id', catalogId)
        }

        const { data, error } = await query

        if (error) throw error

        // catalogId フィルタの場合、JOINフィルタで null になった行を除外
        const filtered = catalogId
            ? (data || []).filter((lot: any) => lot.inventory !== null)
            : (data || [])

        return NextResponse.json({ success: true, data: filtered })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
