import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const RAILWAY_URL = process.env.RAILWAY_SCRAPER_URL || 'https://skillful-love-production.up.railway.app'

// GET: プレビュー取得（Railwayに転送）
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const listUrl = searchParams.get('url')
  const limit = searchParams.get('limit') || '20'
  
  if (!listUrl) {
    return NextResponse.json({
      message: 'Pokemon Card Import API (via Railway)',
      usage: 'GET ?url=<list_url>&limit=20',
      example: '/api/pokemon-card-import?url=https://www.pokemon-card.com/card-search/index.php?sc_rare_sar=1&limit=10'
    })
  }
  
  try {
    // Railwayに転送
    const railwayUrl = `${RAILWAY_URL}/pokemon-import?url=${encodeURIComponent(listUrl)}&limit=${limit}`
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
  const { url: listUrl, limit = 100, skipExisting = true } = await request.json()
  
  if (!listUrl) {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }
  
  try {
    // Railwayからカードデータ取得
    const railwayUrl = `${RAILWAY_URL}/pokemon-import`
    console.log('Calling Railway POST:', railwayUrl)
    
    const railwayRes = await fetch(railwayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: listUrl, limit })
    })
    
    const railwayData = await railwayRes.json()
    
    if (!railwayData.success) {
      return NextResponse.json(railwayData, { status: 500 })
    }
    
    // ポケモンカードのカテゴリIDを取得
    const { data: category } = await supabase
      .from('category_large')
      .select('id')
      .eq('name', 'ポケモンカード')
      .single()
    
    let newCount = 0
    let updateCount = 0
    let skipCount = 0
    let errorCount = 0
    const errors: string[] = []
    
    for (const card of railwayData.cards) {
      try {
        if (!card.name || !card.imageUrl) {
          errorCount++
          continue
        }
        
        // 既存チェック（画像URLで判定）
        const { data: existingList } = await supabase
          .from('cards')
          .select('id')
          .eq('image_url', card.imageUrl)
        
        const existing = existingList?.[0]
        
        if (existing) {
          if (skipExisting) {
            skipCount++
          } else {
            // 更新
            await supabase
              .from('cards')
              .update({
                name: card.name,
                card_number: card.cardNumber,
                rarity: card.rarity,
                illustrator: card.illustrator,
                expansion: card.expansion,
                regulation: card.regulation
              })
              .eq('id', existing.id)
            updateCount++
          }
        } else {
          // 新規登録
          await supabase
            .from('cards')
            .insert([{
              name: card.name,
              image_url: card.imageUrl,
              card_number: card.cardNumber,
              rarity: card.rarity,
              illustrator: card.illustrator,
              expansion: card.expansion,
              regulation: card.regulation,
              category_large_id: category?.id || null
            }])
          newCount++
        }
      } catch (err: any) {
        errorCount++
        errors.push(`${card.name}: ${err.message}`)
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
