import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// シンソク紐付けAPI
// POST /api/shinsoku/link { card_id, shinsoku_item_id }
export async function POST(request: NextRequest) {
    try {
        const { card_id, shinsoku_item_id } = await request.json()

        if (!card_id || !shinsoku_item_id) {
            return NextResponse.json({
                success: false,
                error: 'card_id と shinsoku_item_id が必要です',
            }, { status: 400 })
        }

        const { error } = await supabase
            .from('cards')
            .update({
                shinsoku_item_id,
                shinsoku_linked_at: new Date().toISOString(),
            })
            .eq('id', card_id)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message,
        }, { status: 500 })
    }
}

// DELETE: 紐付け解除
export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const card_id = searchParams.get('card_id')

        if (!card_id) {
            return NextResponse.json({
                success: false,
                error: 'card_id が必要です',
            }, { status: 400 })
        }

        const { error } = await supabase
            .from('cards')
            .update({
                shinsoku_item_id: null,
                shinsoku_linked_at: null,
            })
            .eq('id', card_id)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({
            success: false,
            error: error.message,
        }, { status: 500 })
    }
}
