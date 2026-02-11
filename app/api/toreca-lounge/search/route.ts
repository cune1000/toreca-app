import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const query = searchParams.get('q') || ''
        const keys = searchParams.get('keys') || ''

        // keysパラメータ: card_keyの一括検索（紐付け済みアイテムの画像取得用）
        if (keys) {
            const keyList = keys.split(',').filter(k => k.length > 0)
            if (keyList.length === 0) {
                return NextResponse.json({ success: true, data: { items: [] } })
            }

            const { data, error } = await supabase
                .from('lounge_cards_cache')
                .select('*')
                .in('card_key', keyList)

            if (error) throw error

            const items = (data || []).map(row => ({
                productId: row.product_id,
                name: row.name,
                modelno: row.modelno,
                rarity: row.rarity,
                grade: row.grade,
                productFormat: row.product_format,
                price: row.price,
                key: row.card_key,
                imageUrl: row.image_url,
            }))

            return NextResponse.json({ success: true, data: { items, total: items.length } })
        }

        if (!query || query.length < 2) {
            return NextResponse.json({
                success: false,
                error: '検索キーワードは2文字以上必要です',
            }, { status: 400 })
        }

        // DBキャッシュから検索（LIKE検索、AND条件）
        const keywords = query.split(/[\s　]+/).filter(k => k.length > 0)

        let dbQuery = supabase
            .from('lounge_cards_cache')
            .select('*')
            .order('price', { ascending: false })

        // 各キーワードでILIKEフィルタ
        for (const kw of keywords) {
            dbQuery = dbQuery.ilike('name', `%${kw}%`)
        }

        const { data, error, count } = await dbQuery.limit(50)

        if (error) throw error

        // 全件数を取得
        const { count: totalCount } = await supabase
            .from('lounge_cards_cache')
            .select('*', { count: 'exact', head: true })

        const items = (data || []).map(row => ({
            productId: row.product_id,
            name: row.name,
            modelno: row.modelno,
            rarity: row.rarity,
            grade: row.grade,
            productFormat: row.product_format,
            price: row.price,
            key: row.card_key,
            imageUrl: row.image_url,
        }))

        return NextResponse.json({
            success: true,
            data: {
                items,
                total: items.length,
                allCount: totalCount || 0,
            },
        })
    } catch (error: any) {
        console.error('[toreca-lounge/search]', error)
        return NextResponse.json({
            success: false,
            error: error.message,
        }, { status: 500 })
    }
}
