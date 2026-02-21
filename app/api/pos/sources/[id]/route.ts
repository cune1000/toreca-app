import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// 仕入先1件取得
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    try {
        const { data, error } = await supabase
            .from('pos_sources')
            .select('*')
            .eq('id', id)
            .single()

        if (error || !data) {
            return NextResponse.json({ success: false, error: '仕入先が見つかりません' }, { status: 404 })
        }
        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}

// 仕入先更新
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    try {
        const body = await request.json()
        const { name, type, trust_level, contact_info, notes } = body

        const updates: any = { updated_at: new Date().toISOString() }
        if (name !== undefined) {
            if (!name.trim()) {
                return NextResponse.json({ success: false, error: '仕入先名を入力してください' }, { status: 400 })
            }
            updates.name = name.trim()
        }
        if (type !== undefined) updates.type = type
        if (trust_level !== undefined) updates.trust_level = trust_level
        if (contact_info !== undefined) updates.contact_info = contact_info || null
        if (notes !== undefined) updates.notes = notes || null

        const { data, error } = await supabase
            .from('pos_sources')
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

// 仕入先削除（ソフトデリート）
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    try {
        const { error } = await supabase
            .from('pos_sources')
            .update({ is_active: false, updated_at: new Date().toISOString() })
            .eq('id', id)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
