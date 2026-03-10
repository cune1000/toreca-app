import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// 公開APIからカード検索 → カタログ登録用データ返却
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const q = searchParams.get('q')
        if (!q) {
            return NextResponse.json({ success: false, error: '検索キーワードが必要です' }, { status: 400 })
        }

        const limit = Math.min(parseInt(searchParams.get('limit') || '30'), 100)
        const offset = parseInt(searchParams.get('offset') || '0')

        const escaped = q.replace(/[%_\\]/g, '\\$&')

        // 総件数を取得
        const { count, error: countError } = await supabase
            .from('cards')
            .select('id', { count: 'exact', head: true })
            .ilike('name', `%${escaped}%`)

        if (countError) throw countError

        // 既存の cards テーブルから検索
        const { data, error } = await supabase
            .from('cards')
            .select('id, name, image_url, category_large_id, rarity')
            .ilike('name', `%${escaped}%`)
            .range(offset, offset + limit - 1)

        if (error) throw error

        // カテゴリ名を取得
        const catIds = [...new Set((data || []).map(c => c.category_large_id).filter(Boolean))]

        const catRes = catIds.length > 0
            ? await supabase.from('category_large').select('id, name').in('id', catIds)
            : { data: [] }

        const catMap: Record<string, string> = {}
            ; (catRes.data || []).forEach((c: any) => catMap[c.id] = c.name)

        const results = (data || []).map(card => ({
            api_card_id: card.id,
            name: card.name,
            image_url: card.image_url,
            category: catMap[card.category_large_id] || null,
            rarity: card.rarity || null,
        }))

        return NextResponse.json({ success: true, data: results, total: count || 0, limit, offset })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
