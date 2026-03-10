import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * tcgplayer_id を持つカードで、画像がPriceChartingのものになっている場合
 * TCGPlayer画像に一括更新する
 *
 * POST /api/justtcg/fix-images
 * Authorization: Bearer CRON_SECRET
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createServiceClient()

  // tcgplayer_id があり、画像がpricecharting のカードを取得（ページネーション）
  let cards: { id: string; tcgplayer_id: string; image_url: string }[] = []
  let cardOffset = 0
  const CARD_PAGE = 1000
  while (true) {
    const { data: page, error } = await supabase
      .from('cards')
      .select('id, tcgplayer_id, image_url')
      .not('tcgplayer_id', 'is', null)
      .like('image_url', '%pricecharting%')
      .range(cardOffset, cardOffset + CARD_PAGE - 1)
    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
    if (!page || page.length === 0) break
    cards = cards.concat(page)
    if (page.length < CARD_PAGE) break
    cardOffset += CARD_PAGE
  }

  if (cards.length === 0) {
    return NextResponse.json({ success: true, updated: 0, message: '対象カードなし' })
  }

  let updated = 0
  let failed = 0

  // 50件ずつバッチ更新
  for (let i = 0; i < cards.length; i += 50) {
    const batch = cards.slice(i, i + 50)
    const promises = batch.map(async (card) => {
      const newUrl = `https://product-images.tcgplayer.com/fit-in/400x560/${card.tcgplayer_id}.jpg`
      const { error: updateError } = await supabase
        .from('cards')
        .update({ image_url: newUrl })
        .eq('id', card.id)
      if (updateError) {
        failed++
      } else {
        updated++
      }
    })
    await Promise.all(promises)
  }

  return NextResponse.json({ success: true, total: cards.length, updated, failed })
}
