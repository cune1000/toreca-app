import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * カード一括更新API
 * 
 * POST Body:
 * {
 *   cardIds: string[],
 *   updates: {
 *     category_large_id?: string | null,
 *     category_medium_id?: string | null,
 *     category_small_id?: string | null,
 *     rarity_id?: string | null
 *   }
 * }
 */
export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { cardIds, updates } = body

        if (!cardIds || !Array.isArray(cardIds) || cardIds.length === 0) {
            return NextResponse.json(
                { success: false, error: 'cardIds is required' },
                { status: 400 }
            )
        }

        if (cardIds.length > 500) {
            return NextResponse.json(
                { success: false, error: 'Maximum 500 cards at a time' },
                { status: 400 }
            )
        }

        if (!updates || Object.keys(updates).length === 0) {
            return NextResponse.json(
                { success: false, error: 'updates is required' },
                { status: 400 }
            )
        }

        // 許可するフィールドのみ
        const allowedFields = ['category_large_id', 'category_medium_id', 'category_small_id', 'category_detail_id', 'rarity_id']
        const sanitized: Record<string, any> = {}
        for (const [key, value] of Object.entries(updates)) {
            if (allowedFields.includes(key)) {
                sanitized[key] = value
            }
        }

        if (Object.keys(sanitized).length === 0) {
            return NextResponse.json(
                { success: false, error: 'No valid fields to update' },
                { status: 400 }
            )
        }

        // updated_at を追加
        sanitized.updated_at = new Date().toISOString()

        const { data, error } = await supabase
            .from('cards')
            .update(sanitized)
            .in('id', cardIds)
            .select('id')

        if (error) {
            console.error('Batch update error:', error)
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 500 }
            )
        }

        return NextResponse.json({
            success: true,
            updated: data?.length || 0
        })

    } catch (error: any) {
        console.error('Batch update API error:', error)
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        )
    }
}
