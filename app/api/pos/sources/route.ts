import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// 仕入先一覧
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const active = searchParams.get('active')
        const type = searchParams.get('type')

        let query = supabase
            .from('pos_sources')
            .select('*')
            .order('updated_at', { ascending: false })

        if (active === 'true') {
            query = query.eq('is_active', true)
        }
        if (type) {
            query = query.eq('type', type)
        }

        const { data, error } = await query

        if (error) throw error

        return NextResponse.json({ success: true, data: data || [] })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}

// 仕入先作成
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { name, type, trust_level, contact_info, notes } = body

        if (!name?.trim()) {
            return NextResponse.json({ success: false, error: '名前を入力してください' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('pos_sources')
            .insert({
                name: name.trim(),
                type: type || 'other',
                trust_level: trust_level || 'unverified',
                contact_info: contact_info || null,
                notes: notes || null,
            })
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
