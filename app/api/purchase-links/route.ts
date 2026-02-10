import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET: カードの紐付け一覧を取得
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const card_id = searchParams.get('card_id')

        if (!card_id) {
            return NextResponse.json({ error: 'card_id が必要です' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('card_purchase_links')
            .select('*, shop:shop_id(id, name)')
            .eq('card_id', card_id)
            .order('created_at', { ascending: true })

        if (error) throw error

        return NextResponse.json({ success: true, data: data || [] })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}

// POST: 新しい紐付けを追加
export async function POST(request: NextRequest) {
    try {
        const { card_id, shop_id, shop_name, external_key, label, condition } = await request.json()

        if (!card_id || !external_key) {
            return NextResponse.json({ error: 'card_id と external_key が必要です' }, { status: 400 })
        }

        // shop_idまたはshop_nameでショップを特定
        let resolvedShopId = shop_id
        if (!resolvedShopId && shop_name) {
            const { data: shop } = await supabase
                .from('purchase_shops')
                .select('id')
                .eq('name', shop_name)
                .single()
            if (shop) resolvedShopId = shop.id
        }

        if (!resolvedShopId) {
            return NextResponse.json({ error: 'shop_id または shop_name が必要です' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('card_purchase_links')
            .upsert({
                card_id,
                shop_id: resolvedShopId,
                external_key,
                label: label || '',
                condition: condition || 'normal',
            }, {
                onConflict: 'card_id,shop_id,external_key',
            })
            .select('*, shop:shop_id(id, name)')
            .single()

        if (error) throw error

        return NextResponse.json({ success: true, data })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}

// DELETE: 紐付けを削除
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const link_id = searchParams.get('link_id')

        if (!link_id) {
            return NextResponse.json({ error: 'link_id が必要です' }, { status: 400 })
        }

        const { error } = await supabase
            .from('card_purchase_links')
            .delete()
            .eq('id', link_id)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
