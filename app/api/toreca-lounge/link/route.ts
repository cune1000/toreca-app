import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
    try {
        const { card_id, lounge_card_key } = await request.json()

        if (!card_id || !lounge_card_key) {
            return NextResponse.json({ error: 'card_id と lounge_card_key が必要です' }, { status: 400 })
        }

        const { error } = await supabase
            .from('cards')
            .update({
                lounge_card_key,
                lounge_linked_at: new Date().toISOString(),
            })
            .eq('id', card_id)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const card_id = searchParams.get('card_id')

        if (!card_id) {
            return NextResponse.json({ error: 'card_id が必要です' }, { status: 400 })
        }

        const { error } = await supabase
            .from('cards')
            .update({
                lounge_card_key: null,
                lounge_linked_at: null,
            })
            .eq('id', card_id)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
