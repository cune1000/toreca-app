import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * 価格インデックスデータ取得API
 * 
 * クエリパラメータ:
 * - category: カテゴリ名（ポケモン, ワンピース等）
 * - subCategory: カテゴリ中＝世代名（スカーレット&バイオレット等）
 * - rarity: レアリティ（SAR, AR等）省略時は全て
 * - grade: グレード（PSA10, A, 1BOX等）省略時は全て
 * - priceType: 価格タイプ（sale, purchase）省略時は両方
 * - days: 期間（デフォルト30日）
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url)
        const category = searchParams.get('category')
        const subCategory = searchParams.get('subCategory')
        const rarity = searchParams.get('rarity')
        const grade = searchParams.get('grade')
        const priceType = searchParams.get('priceType')
        const days = parseInt(searchParams.get('days') || '30')

        // 期間計算
        const cutoffDate = new Date()
        cutoffDate.setDate(cutoffDate.getDate() - days)
        const cutoffDateStr = cutoffDate.toISOString().split('T')[0]

        // クエリ構築
        let query = supabase
            .from('daily_price_index')
            .select('*')
            .gte('date', cutoffDateStr)
            .order('date', { ascending: true })

        if (category) {
            query = query.ilike('category', `%${category}%`)
        }
        if (subCategory && subCategory !== 'ALL') {
            query = query.eq('sub_category', subCategory)
        }
        if (rarity) {
            query = query.eq('rarity', rarity)
        }
        if (grade) {
            query = query.eq('grade', grade)
        }
        if (priceType) {
            query = query.eq('price_type', priceType)
        }

        const { data, error } = await query

        if (error) {
            console.error('Database error:', error)
            return NextResponse.json({
                success: false,
                error: error.message
            }, { status: 500 })
        }

        // 利用可能なサブカテゴリを抽出
        const subCategories = [...new Set(data?.map((d: any) => d.sub_category).filter(Boolean) || [])]

        // グラフ用にデータを整形
        const formatted = formatForChart(data || [])

        return NextResponse.json({
            success: true,
            data: data || [],
            chart: formatted,
            subCategories
        })

    } catch (error: any) {
        console.error('API error:', error)
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}

/**
 * グラフ表示用にデータを整形
 */
function formatForChart(data: any[]) {
    const byDate: Record<string, any> = {}

    for (const row of data) {
        if (!byDate[row.date]) {
            byDate[row.date] = { date: row.date }
        }

        // キー生成: rarity_grade_priceType
        const key = `${row.rarity}_${row.grade}_${row.price_type}`
        byDate[row.date][key] = row.avg_price
    }

    return Object.values(byDate).sort((a, b) =>
        a.date.localeCompare(b.date)
    )
}
