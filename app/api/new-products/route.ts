import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url)
    const days = parseInt(searchParams.get('days') || '7', 10)

    const sinceDate = new Date()
    sinceDate.setDate(sinceDate.getDate() - days)
    const since = sinceDate.toISOString()

    try {
        // シンソクの新商品
        const { data: shinsokuNew, error: shinsokuError } = await supabase
            .from('shinsoku_items')
            .select('item_id, name, brand, rarity, modelno, image_url, price_s, price_a, first_seen_at')
            .gte('first_seen_at', since)
            .order('first_seen_at', { ascending: false })
            .limit(100)

        if (shinsokuError) {
            console.error('shinsoku error:', shinsokuError)
        }

        // トレカラウンジの新商品
        const { data: loungeNew, error: loungeError } = await supabase
            .from('lounge_known_keys')
            .select('card_key, name, price, rarity, grade, first_seen_at')
            .gte('first_seen_at', since)
            .order('first_seen_at', { ascending: false })
            .limit(100)

        if (loungeError) {
            console.error('lounge error:', loungeError)
        }

        // 統合して日付降順でソート
        const combined = [
            ...(shinsokuNew || []).map(item => ({
                source: 'シンソク' as const,
                name: item.name,
                rarity: item.rarity || '',
                price: item.price_s || item.price_a || 0,
                imageUrl: item.image_url || null,
                firstSeenAt: item.first_seen_at,
                brand: item.brand,
                modelno: item.modelno || '',
            })),
            ...(loungeNew || []).map(item => ({
                source: 'トレカラウンジ' as const,
                name: item.name,
                rarity: item.rarity || '',
                price: item.price || 0,
                imageUrl: null as string | null,
                firstSeenAt: item.first_seen_at,
                brand: 'ポケモン',
                modelno: '',
            })),
        ].sort((a, b) => new Date(b.firstSeenAt).getTime() - new Date(a.firstSeenAt).getTime())

        // 日付でグルーピング
        const grouped: Record<string, typeof combined> = {}
        combined.forEach(item => {
            const date = new Date(item.firstSeenAt).toLocaleDateString('ja-JP', {
                year: 'numeric', month: 'long', day: 'numeric',
            })
            if (!grouped[date]) grouped[date] = []
            grouped[date].push(item)
        })

        return NextResponse.json({
            success: true,
            days,
            total: combined.length,
            shinsokuCount: shinsokuNew?.length || 0,
            loungeCount: loungeNew?.length || 0,
            grouped,
        })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
