import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function GET() {
    try {
        const supabase = createServiceClient()

        const [raritiesRes, expansionsRes] = await Promise.all([
            supabase
                .from('cards')
                .select('rarity')
                .not('rarity', 'is', null)
                .not('rarity', 'eq', ''),
            supabase
                .from('cards')
                .select('expansion')
                .not('expansion', 'is', null)
                .not('expansion', 'eq', ''),
        ])

        const rarities = [...new Set((raritiesRes.data || []).map((r: any) => r.rarity))].sort()
        const expansions = [...new Set((expansionsRes.data || []).map((r: any) => r.expansion))].sort()

        return NextResponse.json({ rarities, expansions }, {
            headers: {
                'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=1800',
            },
        })
    } catch (error) {
        console.error('Chart filters API error:', error)
        return NextResponse.json({ rarities: [], expansions: [] }, { status: 500 })
    }
}
