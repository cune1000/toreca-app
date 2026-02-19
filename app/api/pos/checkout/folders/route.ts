import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// フォルダ一覧取得
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const status = searchParams.get('status')

        let query = supabase
            .from('pos_checkout_folders')
            .select('*')
            .order('created_at', { ascending: false })

        if (status && status !== 'all') {
            query = query.eq('status', status)
        }

        const { data: folders, error } = await query
        if (error) throw error

        // 各フォルダのアイテム集計を取得
        const folderIds = (folders || []).map(f => f.id)
        if (folderIds.length > 0) {
            const { data: items } = await supabase
                .from('pos_checkout_items')
                .select('folder_id, quantity, unit_cost, status')
                .in('folder_id', folderIds)

            for (const folder of folders || []) {
                const folderItems = (items || []).filter(i => i.folder_id === folder.id)
                folder.item_count = folderItems.length
                folder.pending_count = folderItems.filter(i => i.status === 'pending').length
                folder.locked_amount = folderItems
                    .filter(i => i.status === 'pending')
                    .reduce((sum, i) => sum + i.unit_cost * i.quantity, 0)
            }
        }

        return NextResponse.json({ success: true, data: folders || [] })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}

// フォルダ作成
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { name, description } = body

        if (!name?.trim()) {
            return NextResponse.json({ success: false, error: 'フォルダ名を入力してください' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('pos_checkout_folders')
            .insert({ name: name.trim(), description: description?.trim() || null })
            .select()
            .single()

        if (error) throw error

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
