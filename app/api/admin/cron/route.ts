import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

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
        const { path } = await req.json()
        if (!path) return NextResponse.json({ success: false, error: 'Path required' }, { status: 400 })

        // Create the full URL based on the request origin
        const origin = req.headers.get('origin') || 'http://localhost:3000'
        const fullUrl = `${origin}${path}`

        console.log(`[Admin] Manually triggering cron: ${fullUrl}`)

        // Call the cron route with the secret
        const res = await fetch(fullUrl, {
            headers: {
                'Authorization': `Bearer ${process.env.CRON_SECRET}`
            }
        })

        const result = await res.json()
        return NextResponse.json({ success: true, result })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
