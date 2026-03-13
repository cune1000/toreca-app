import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// 許可するcronパスのプレフィックス（SSRF防止）
const ALLOWED_CRON_PREFIX = '/api/cron/'

export async function GET() {
    const supabase = createServiceClient()

    const { data, error } = await supabase
        .from('cron_schedules')
        .select('*')
        .order('job_name', { ascending: true })

    if (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data })
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { path, params } = body
        if (!path) return NextResponse.json({ success: false, error: 'Path required' }, { status: 400 })

        // SSRF防止: /api/cron/ で始まるパスのみ許可
        if (typeof path !== 'string' || !path.startsWith(ALLOWED_CRON_PREFIX)) {
            return NextResponse.json(
                { success: false, error: `Path must start with ${ALLOWED_CRON_PREFIX}` },
                { status: 400 }
            )
        }

        // パストラバーサル防止: ../ を含むパスを拒否
        if (path.includes('..') || path.includes('//')) {
            return NextResponse.json(
                { success: false, error: 'Invalid path' },
                { status: 400 }
            )
        }

        // Vercel本番では VERCEL_URL、ローカルでは host ヘッダーを使用
        const host = process.env.VERCEL_URL
            ? `https://${process.env.VERCEL_URL}`
            : `${req.headers.get('x-forwarded-proto') || 'http'}://${req.headers.get('host') || 'localhost:3000'}`
        const qs = new URLSearchParams({ force: '1', ...(params || {}) })
        const triggerUrl = `${host}${path}?${qs.toString()}`

        console.log(`[Admin] Manually triggering cron: ${triggerUrl}`)

        const res = await fetch(triggerUrl, {
            headers: {
                'Authorization': `Bearer ${process.env.CRON_SECRET}`
            }
        })

        const result = await res.json()

        if (!res.ok) {
            return NextResponse.json({ success: false, error: result.error || `HTTP ${res.status}`, result }, { status: res.status })
        }

        return NextResponse.json({ success: true, result })
    } catch (error: unknown) {
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
    }
}

/**
 * スケジュール更新
 * PATCH /api/admin/cron { job_name, ...fields }
 */
export async function PATCH(req: Request) {
    try {
        const body = await req.json()
        const { job_name, ...updates } = body
        if (!job_name) {
            return NextResponse.json({ success: false, error: 'job_name is required' }, { status: 400 })
        }

        const allowedFields = ['enabled', 'run_at_hours', 'run_at_minute', 'interval_minutes', 'schedule_type', 'display_name']
        const filtered: Record<string, unknown> = {}
        for (const key of allowedFields) {
            if (key in updates) filtered[key] = updates[key]
        }
        if (Object.keys(filtered).length === 0) {
            return NextResponse.json({ success: false, error: 'No valid fields to update' }, { status: 400 })
        }

        filtered.updated_at = new Date().toISOString()

        const supabase = createServiceClient()
        const { data, error } = await supabase
            .from('cron_schedules')
            .upsert({ job_name, ...filtered }, { onConflict: 'job_name' })
            .select()

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 })
        }

        return NextResponse.json({ success: true, data })
    } catch (error: unknown) {
        return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
    }
}
