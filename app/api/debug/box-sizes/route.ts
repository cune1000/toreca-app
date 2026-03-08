import { NextRequest, NextResponse } from 'next/server'
import { getBoxSizes } from '@/lib/snkrdunk-api'

export async function GET(req: NextRequest) {
  const apparelId = parseInt(req.nextUrl.searchParams.get('id') || '0')
  if (!apparelId) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const sizes = await getBoxSizes(apparelId)
  return NextResponse.json({ sizes })
}
