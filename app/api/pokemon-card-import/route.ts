import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { TORECA_SCRAPER_URL } from '@/lib/config'

/**
 * 単体カードURLからcardIdを抽出
 * 例: https://www.pokemon-card.com/card-search/details.php/card/49620/regu/all → 49620
 */
function extractCardId(url: string): string | null {
  const match = url.match(/details\.php\/card\/(\d+)/)
  return match ? match[1] : null
}

function isSingleCardUrl(url: string): boolean {
  return url.includes('details.php/card/')
}

// GET: プレビュー取得（Railwayに転送）
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const inputUrl = searchParams.get('url')
  const limitParam = searchParams.get('limit')
  // limit=-1 または limit=all で全件取得
  const limit = (limitParam === 'all' || limitParam === '-1') ? '-1' : (limitParam || '20')
  const offset = searchParams.get('offset') || '0'

  if (!inputUrl) {
    return NextResponse.json({
      message: 'Pokemon Card Import API (via Railway)',
      usage: 'GET ?url=<list_url_or_detail_url>&limit=20&offset=0',
      note: 'Supports both list URLs and single card detail URLs',
      examples: [
        '/api/pokemon-card-import?url=https://www.pokemon-card.com/card-search/index.php?sc_rare_sar=1&limit=20',
        '/api/pokemon-card-import?url=https://www.pokemon-card.com/card-search/details.php/card/49620/regu/all'
      ]
    })
  }

  try {
    // 単体カードURLの場合
    if (isSingleCardUrl(inputUrl)) {
      const cardId = extractCardId(inputUrl)
      if (!cardId) {
        return NextResponse.json({ success: false, error: 'URLからカードIDを抽出できません' }, { status: 400 })
      }

      const railwayUrl = `${TORECA_SCRAPER_URL}/pokemon-detail?cardId=${cardId}`
      console.log('Calling Railway (single card):', railwayUrl)

      const res = await fetch(railwayUrl, { headers: { 'Content-Type': 'application/json' } })
      const data = await res.json()

      if (!data.success) {
        return NextResponse.json(data, { status: 500 })
      }

      // リスト形式に変換して返す
      return NextResponse.json({
        success: true,
        totalFound: 1,
        isSingleCard: true,
        cards: [{
          cardId: data.cardId,
          name: data.name,
          imageUrl: data.imageUrl,
          cardNumber: data.cardNumber,
          rarity: data.rarity,
          illustrator: data.illustrator,
          expansion: data.expansion,
          regulation: data.regulation,
          sourceUrl: data.sourceUrl || inputUrl,
        }]
      })
    }

    // リストURLの場合（既存の処理）
    const railwayUrl = `${TORECA_SCRAPER_URL}/pokemon-import?url=${encodeURIComponent(inputUrl)}&limit=${limit}&offset=${offset}`
    console.log('Calling Railway:', railwayUrl)

    const res = await fetch(railwayUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    })

    const data = await res.json()
    return NextResponse.json(data)

  } catch (error: any) {
    console.error('Railway call error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}

// POST: DBに保存
export async function POST(request: NextRequest) {
  const { url: inputUrl, cards: directCards, limit = 20, offset = 0, skipExisting = true } = await request.json()

  if (!inputUrl && !directCards) {
    return NextResponse.json({ error: 'url or cards is required' }, { status: 400 })
  }

  try {
    let railwayData: any

    if (directCards) {
      // 直接カードデータが渡された場合（単体URLインポート用）
      railwayData = { success: true, totalFound: directCards.length, processed: directCards.length, cards: directCards }
    } else if (isSingleCardUrl(inputUrl)) {
      // 単体カードURLの場合
      const cardId = extractCardId(inputUrl)
      if (!cardId) {
        return NextResponse.json({ success: false, error: 'URLからカードIDを抽出できません' }, { status: 400 })
      }
      const res = await fetch(`${TORECA_SCRAPER_URL}/pokemon-detail?cardId=${cardId}`, { headers: { 'Content-Type': 'application/json' } })
      const data = await res.json()
      if (!data.success) return NextResponse.json(data, { status: 500 })
      railwayData = { success: true, totalFound: 1, processed: 1, cards: [data] }
    } else {
      // リストURLの場合（既存の処理）
      const railwayRes = await fetch(`${TORECA_SCRAPER_URL}/pokemon-import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: inputUrl, limit, offset })
      })
      railwayData = await railwayRes.json()
      if (!railwayData.success) return NextResponse.json(railwayData, { status: 500 })
    }

    // ポケモンカードのカテゴリIDを取得
    const { data: category } = await supabase
      .from('category_large')
      .select('id')
      .eq('name', 'ポケモンカード')
      .single()

    const cards = railwayData.cards || []

    // 有効なカードのみフィルタ
    const validCards = cards.filter((c: any) => c.name && c.imageUrl)
    const invalidCount = cards.length - validCards.length

    // 全画像URLで既存チェック（バッチ）
    const imageUrls = validCards.map((c: any) => c.imageUrl)
    const existingMap = new Map<string, string>()

    // Supabaseの.in()は最大100件制限があるため、チャンクで取得
    const CHUNK_SIZE = 100
    for (let i = 0; i < imageUrls.length; i += CHUNK_SIZE) {
      const chunk = imageUrls.slice(i, i + CHUNK_SIZE)
      const { data: existingCards } = await supabase
        .from('cards')
        .select('id, image_url')
        .in('image_url', chunk)

      if (existingCards) {
        existingCards.forEach((c: any) => existingMap.set(c.image_url, c.id))
      }
    }

    // 新規・更新・スキップに分類
    const newCards: any[] = []
    const updateCards: any[] = []
    let skipCount = 0

    for (const card of validCards) {
      const existingId = existingMap.get(card.imageUrl)
      if (existingId) {
        if (skipExisting) {
          skipCount++
        } else {
          updateCards.push({ id: existingId, ...card })
        }
      } else {
        newCards.push({
          name: card.name,
          image_url: card.imageUrl,
          card_number: card.cardNumber,
          rarity: card.rarity,
          illustrator: card.illustrator,
          expansion: card.expansion,
          regulation: card.regulation,
          category_large_id: category?.id || null
        })
      }
    }

    // 新規カードをバッチINSERT（100件ずつ）
    let newCount = 0
    let errorCount = invalidCount
    const errors: string[] = []

    for (let i = 0; i < newCards.length; i += CHUNK_SIZE) {
      const chunk = newCards.slice(i, i + CHUNK_SIZE)
      const { error } = await supabase
        .from('cards')
        .insert(chunk)

      if (error) {
        errorCount += chunk.length
        errors.push(`Batch insert error (${i}-${i + chunk.length}): ${error.message}`)
      } else {
        newCount += chunk.length
      }
    }

    // 更新カードをバッチ処理
    let updateCount = 0
    for (const card of updateCards) {
      const { error } = await supabase
        .from('cards')
        .update({
          name: card.name,
          card_number: card.cardNumber,
          rarity: card.rarity,
          illustrator: card.illustrator,
          expansion: card.expansion,
          regulation: card.regulation
        })
        .eq('id', card.id)

      if (error) {
        errorCount++
        errors.push(`Update ${card.name}: ${error.message}`)
      } else {
        updateCount++
      }
    }

    return NextResponse.json({
      success: true,
      totalFound: railwayData.totalFound,
      processed: railwayData.processed,
      newCount,
      updateCount,
      skipCount,
      errorCount,
      errors: errors.slice(0, 10)
    })

  } catch (error: any) {
    console.error('Import error:', error)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
