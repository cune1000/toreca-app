import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// カタログ一覧
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const search = searchParams.get('search')
        const category = searchParams.get('category')

        let query = supabase
            .from('pos_catalogs')
            .select('*')
            .eq('is_active', true)
            .order('updated_at', { ascending: false })

        if (search) {
            query = query.ilike('name', `%${search}%`)
        }
        if (category && category !== 'all') {
            query = query.eq('category', category)
        }

        const { data, error } = await query
        if (error) throw error

        return NextResponse.json({ success: true, data: data || [] })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}

// カタログ作成
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { name, image_url, category, subcategory, card_number, rarity, jan_code, source_type, api_card_id, fixed_price } = body

        if (!name?.trim()) {
            return NextResponse.json({ success: false, error: '商品名は必須です' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('pos_catalogs')
            .insert({
                name: name.trim(),
                image_url: image_url || null,
                category: category || null,
                subcategory: subcategory || null,
                card_number: card_number || null,
                rarity: rarity || null,
                jan_code: jan_code || null,
                source_type: source_type || 'original',
                api_card_id: api_card_id || null,
                api_linked_at: api_card_id ? new Date().toISOString() : null,
                fixed_price: fixed_price || null,
            })
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
