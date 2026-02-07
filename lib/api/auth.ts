import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

/**
 * APIキー認証ミドルウェア
 * 
 * 使い方:
 * ```
 * const authResult = await validateApiKey(req)
 * if (authResult.error) return authResult.error
 * // authResult.apiKey にキー情報が入る
 * ```
 */
export async function validateApiKey(req: Request): Promise<{
    apiKey?: { id: string; name: string; rate_limit: number } | null
    error?: NextResponse
}> {
    const apiKey = req.headers.get('X-API-Key') || req.headers.get('x-api-key')

    if (!apiKey) {
        return {
            error: NextResponse.json(
                { success: false, error: 'API key is required. Set X-API-Key header.' },
                { status: 401, headers: corsHeaders() }
            )
        }
    }

    const supabase = createServiceClient()
    const { data, error } = await supabase
        .from('api_keys')
        .select('id, name, rate_limit, is_active')
        .eq('key', apiKey)
        .single()

    if (error || !data) {
        return {
            error: NextResponse.json(
                { success: false, error: 'Invalid API key.' },
                { status: 401, headers: corsHeaders() }
            )
        }
    }

    if (!data.is_active) {
        return {
            error: NextResponse.json(
                { success: false, error: 'API key is disabled.' },
                { status: 403, headers: corsHeaders() }
            )
        }
    }

    // last_used_at を更新（非同期で良い）
    supabase
        .from('api_keys')
        .update({ last_used_at: new Date().toISOString() })
        .eq('id', data.id)
        .then(() => { })

    return { apiKey: data }
}

/**
 * CORSヘッダー
 */
export function corsHeaders(): Record<string, string> {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
    }
}

/**
 * OPTIONSプリフライトレスポンス
 */
export function handleCorsOptions(): NextResponse {
    return new NextResponse(null, {
        status: 204,
        headers: corsHeaders(),
    })
}

/**
 * 成功レスポンス（CORSヘッダー付き）
 */
export function apiSuccess(data: any): NextResponse {
    return NextResponse.json(
        { success: true, ...data },
        { headers: corsHeaders() }
    )
}

/**
 * エラーレスポンス（CORSヘッダー付き）
 */
export function apiError(message: string, status = 500): NextResponse {
    return NextResponse.json(
        { success: false, error: message },
        { status, headers: corsHeaders() }
    )
}
