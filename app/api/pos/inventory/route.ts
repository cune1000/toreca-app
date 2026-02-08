import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// 在庫一覧（catalogをJOIN）
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const category = searchParams.get('category')
        const sort = searchParams.get('sort') || 'updated_at'

        let query = supabase
            .from('pos_inventory')
            .select('*, catalog:pos_catalogs(*)')
            .gt('quantity', -1) // 0も含む

        if (category && category !== 'all') {
            query = query.eq('catalog.category', category)
        }

        // ソート
        switch (sort) {
            case 'quantity_desc':
                query = query.order('quantity', { ascending: false })
                break
            case 'value_desc':
                // avg_purchase_price * quantity は DB側では難しいので updated_at で代替
                query = query.order('avg_purchase_price', { ascending: false })
                break
            default:
                query = query.order('updated_at', { ascending: false })
        }

        const { data, error } = await query
        if (error) throw error

        // カテゴリフィルタ（JOINフィルタがnullを返す場合のフォールバック）
        let filtered = data || []
        if (category && category !== 'all') {
            filtered = filtered.filter((inv: any) => inv.catalog?.category === category)
        }

        return NextResponse.json({ success: true, data: filtered })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
