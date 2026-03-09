import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getCards, extractSetIdFromJusttcgId } from '@/lib/justtcg-api'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(req.url)
  const cardId = searchParams.get('card_id')
  if (!cardId) return NextResponse.json({ error: 'card_id required' }, { status: 400 })

  const supabase = createServiceClient()
  const { data: card } = await supabase
    .from('cards')
    .select('id, name, justtcg_id, justtcg_nm_price_usd')
    .eq('id', cardId)
    .single()

  if (!card?.justtcg_id) return NextResponse.json({ error: 'No justtcg_id', card })

  const setId = extractSetIdFromJusttcgId(card.justtcg_id)
  if (!setId) return NextResponse.json({ error: 'Cannot extract setId', card, justtcg_id: card.justtcg_id })

  const game = setId.endsWith('one-piece-card-game') ? 'one-piece-card-game' : 'pokemon-japan'
  const result = await getCards(setId, { game, limit: 100, includePriceHistory: false })

  const apiCard = result.data?.find((c: any) => c.id === card.justtcg_id)

  const { data: history } = await supabase
    .from('justtcg_price_history')
    .select('*')
    .eq('card_id', cardId)
    .order('recorded_at', { ascending: false })
    .limit(10)

  return NextResponse.json({
    card,
    setId,
    game,
    apiCardFound: !!apiCard,
    apiCardVariants: apiCard?.variants || null,
    nmJapanese: apiCard?.variants?.find((v: any) => v.condition === 'Near Mint' && v.language === 'Japanese') || null,
    nmAny: apiCard?.variants?.find((v: any) => v.condition === 'Near Mint') || null,
    totalApiCards: result.data?.length,
    recentHistory: history,
  })
}
