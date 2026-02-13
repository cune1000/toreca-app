import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    const cronSecret = process.env.CRON_SECRET
    const authHeader = request.headers.get('authorization')

    return NextResponse.json({
        cronSecretLength: cronSecret?.length ?? null,
        cronSecretPrefix: cronSecret?.substring(0, 10) ?? null,
        cronSecretSuffix: cronSecret?.substring((cronSecret?.length || 0) - 5) ?? null,
        authHeaderLength: authHeader?.length ?? null,
        authHeaderPrefix: authHeader?.substring(0, 17) ?? null,
        match: authHeader === `Bearer ${cronSecret}`,
        cronSecretHasQuotes: cronSecret?.includes('"') ?? false,
    })
}
