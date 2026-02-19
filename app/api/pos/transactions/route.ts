import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// 取引一覧
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const type = searchParams.get('type')
        const limit = parseInt(searchParams.get('limit') || '50')
        const catalogId = searchParams.get('catalog_id')

        let query = supabase
            .from('pos_transactions')
            .select('*, inventory:pos_inventory(*, catalog:pos_catalogs(*))')
            .order('created_at', { ascending: false })
            .limit(limit)

        if (type && type !== 'all') {
            query = query.eq('type', type)
        }

        // catalog_idでフィルタ: 該当カタログの在庫IDを取得してフィルタ
        if (catalogId) {
            const { data: invIds } = await supabase
                .from('pos_inventory')
                .select('id')
                .eq('catalog_id', catalogId)

            if (invIds && invIds.length > 0) {
                query = query.in('inventory_id', invIds.map(i => i.id))
            } else {
                return NextResponse.json({ success: true, data: [] })
            }
        }

        const { data, error } = await query
        if (error) throw error

        return NextResponse.json({ success: true, data: data || [] })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
