import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// 単一カタログ取得
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const { data, error } = await supabase
            .from('pos_catalogs')
            .select('*')
            .eq('id', id)
            .single()

        if (error) throw error
        if (!data) {
            return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 })
        }

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}

// カタログ更新
export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()

        // 許可フィールドのみ抽出
        const allowedFields = ['name', 'image_url', 'category', 'subcategory', 'card_number', 'rarity', 'jan_code', 'fixed_price'] as const
        const updates: Record<string, any> = {}
        for (const key of allowedFields) {
            if (body[key] !== undefined) updates[key] = body[key]
        }
        updates.updated_at = new Date().toISOString()

        const { data, error } = await supabase
            .from('pos_catalogs')
            .update(updates)
            .eq('id', id)
            .select()
            .single()

        if (error) throw error
        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}

// カタログ削除
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const { error } = await supabase
            .from('pos_catalogs')
            .delete()
            .eq('id', id)

        if (error) throw error
        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
