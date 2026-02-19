import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// フォルダ詳細取得（アイテムJOIN）
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params

        const { data: folder, error: folderError } = await supabase
            .from('pos_checkout_folders')
            .select('*')
            .eq('id', id)
            .single()

        if (folderError || !folder) {
            return NextResponse.json({ success: false, error: 'フォルダが見つかりません' }, { status: 404 })
        }

        const { data: items, error: itemsError } = await supabase
            .from('pos_checkout_items')
            .select('*, inventory:pos_inventory(*, catalog:pos_catalogs(*))')
            .eq('folder_id', id)
            .order('created_at', { ascending: false })

        if (itemsError) throw itemsError

        const allItems = items || []
        folder.items = allItems
        folder.item_count = allItems.length
        folder.pending_count = allItems.filter((i: any) => i.status === 'pending').length
        folder.locked_amount = allItems
            .filter((i: any) => i.status === 'pending')
            .reduce((sum: number, i: any) => sum + i.unit_cost * i.quantity, 0)

        return NextResponse.json({ success: true, data: folder })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}

// フォルダ更新
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params
        const body = await request.json()
        const updates: any = { updated_at: new Date().toISOString() }

        if (body.name !== undefined) updates.name = body.name.trim()
        if (body.description !== undefined) updates.description = body.description?.trim() || null
        if (body.status !== undefined) {
            // ステータスのホワイトリスト検証
            if (!['open', 'closed'].includes(body.status)) {
                return NextResponse.json({ success: false, error: 'ステータスが不正です' }, { status: 400 })
            }
            // クローズ時はpendingアイテムがないか確認
            if (body.status === 'closed') {
                const { data: pendingItems } = await supabase
                    .from('pos_checkout_items')
                    .select('id')
                    .eq('folder_id', id)
                    .eq('status', 'pending')
                if (pendingItems && pendingItems.length > 0) {
                    return NextResponse.json({ success: false, error: `未解決のアイテムが${pendingItems.length}件あるためクローズできません` }, { status: 400 })
                }
                updates.closed_at = new Date().toISOString()
            }
            updates.status = body.status
            if (body.status === 'open') updates.closed_at = null
        }

        const { data, error } = await supabase
            .from('pos_checkout_folders')
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

// フォルダ削除（pendingアイテムがあれば拒否）
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params

        const { data: pendingItems } = await supabase
            .from('pos_checkout_items')
            .select('id')
            .eq('folder_id', id)
            .eq('status', 'pending')

        if (pendingItems && pendingItems.length > 0) {
            return NextResponse.json({ success: false, error: '未解決のアイテムがあるため削除できません' }, { status: 400 })
        }

        const { error } = await supabase
            .from('pos_checkout_folders')
            .delete()
            .eq('id', id)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
