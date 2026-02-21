import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// ロット詳細
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    try {
        const { data, error } = await supabase
            .from('pos_lots')
            .select('*, source:pos_sources(*), inventory:pos_inventory(*, catalog:pos_catalogs(*))')
            .eq('id', id)
            .single()

        if (error || !data) {
            return NextResponse.json({ success: false, error: 'ロットが見つかりません' }, { status: 404 })
        }
        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
