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
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
