import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// 履歴一覧
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const inventoryId = searchParams.get('inventory_id')
        const limit = parseInt(searchParams.get('limit') || '50')

        let query = supabase
            .from('pos_history')
            .select('*, inventory:pos_inventory(*, catalog:pos_catalogs(name, image_url))')
            .order('created_at', { ascending: false })
            .limit(limit)

        if (inventoryId) {
            query = query.eq('inventory_id', inventoryId)
        }

        const { data, error } = await query
        if (error) throw error

        return NextResponse.json({ success: true, data: data || [] })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
