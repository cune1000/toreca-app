import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { Jimp } from 'jimp'
import { getVisionClient } from '@/lib/utils/googleAuth'
import { extractCardName, extractPrice, findSimilarCards } from '@/lib/utils'

// Base64からBuffer
function base64ToBuffer(base64: string): Buffer {
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, '')
  return Buffer.from(base64Data, 'base64')
}

// Google Vision OCRでテキストを読み取り
async function ocrImage(imageBuffer: Buffer): Promise<string> {
  const client = await getVisionClient()
  
  const [result] = await client.textDetection({
    image: { content: imageBuffer }
  })

  const detections = result.textAnnotations || []
  return detections[0]?.description || ''
}

export async function POST(request: NextRequest) {
  const { image, templateId, autoMatchThreshold = 80 } = await request.json()

  if (!image) {
    return NextResponse.json({ error: 'image is required' }, { status: 400 })
  }
  
  if (!templateId) {
    return NextResponse.json({ error: 'templateId is required' }, { status: 400 })
  }

  try {
    // 1. テンプレートを取得
    console.log('Step 1: Loading template...')
    
    const { data: template, error: templateError } = await supabase
      .from('grid_templates')
      .select('*')
      .eq('id', templateId)
      .single()
    
    if (templateError || !template) {
      throw new Error('Template not found')
    }
    
    const verticalLines = template.vertical_lines as number[]
    const horizontalLines = template.horizontal_lines as number[]
    const cells = template.cells as string[][]
    
    console.log(`Template: ${template.name}`)
    console.log(`Grid: ${verticalLines.length - 1} cols × ${horizontalLines.length - 1} rows`)

    // 2. 画像を読み込み
    console.log('Step 2: Loading image...')
    
    const imageBuffer = base64ToBuffer(image)
    const fullImage = await Jimp.read(imageBuffer)
    
    const imgWidth = fullImage.width
    const imgHeight = fullImage.height
    
    console.log(`Image size: ${imgWidth} × ${imgHeight}`)

    // 3. DBからカード一覧を取得
    console.log('Step 3: Loading DB cards...')
    const { data: dbCards, error: dbError } = await supabase
      .from('cards')
      .select('id, name, image_url, card_number, rarity_id, rarities(name)')

    if (dbError) throw dbError

    console.log(`Found ${dbCards?.length || 0} cards in DB`)

    // 4. セルを走査して切り抜き
    console.log('Step 4: Processing cells...')
    
    const results = []
    let cardIndex = 0
    
    for (let row = 0; row < horizontalLines.length - 1; row++) {
      for (let col = 0; col < verticalLines.length - 1; col++) {
        const cellType = cells[row]?.[col] || 'empty'
        
        // カードセルのみ処理
        if (cellType !== 'card') continue
        
        // 座標を計算（%からピクセルへ）
        const x = Math.floor((verticalLines[col] / 100) * imgWidth)
        const y = Math.floor((horizontalLines[row] / 100) * imgHeight)
        const w = Math.floor(((verticalLines[col + 1] - verticalLines[col]) / 100) * imgWidth)
        const h = Math.floor(((horizontalLines[row + 1] - horizontalLines[row]) / 100) * imgHeight)
        
        // 範囲チェック
        const safeX = Math.max(0, Math.min(x, imgWidth - 1))
        const safeY = Math.max(0, Math.min(y, imgHeight - 1))
        const safeW = Math.min(w, imgWidth - safeX)
        const safeH = Math.min(h, imgHeight - safeY)
        
        if (safeW <= 0 || safeH <= 0) continue
        
        try {
          // 切り抜き
          const cardImage = fullImage.clone().crop({ x: safeX, y: safeY, w: safeW, h: safeH })
          const cardBuffer = await cardImage.getBuffer('image/jpeg')
          
          // OCRでカード名を読み取り
          const ocrText = await ocrImage(cardBuffer)
          const cardName = extractCardName(ocrText)
          
          console.log(`Card [${row},${col}]: OCR = "${cardName}"`)
          
          // 対応する価格セルを探す（カードの下のセルが価格）
          let price: number | null = null
          const priceRow = row + 1
          if (priceRow < horizontalLines.length - 1 && cells[priceRow]?.[col] === 'price') {
            const priceX = Math.floor((verticalLines[col] / 100) * imgWidth)
            const priceY = Math.floor((horizontalLines[priceRow] / 100) * imgHeight)
            const priceW = Math.floor(((verticalLines[col + 1] - verticalLines[col]) / 100) * imgWidth)
            const priceH = Math.floor(((horizontalLines[priceRow + 1] - horizontalLines[priceRow]) / 100) * imgHeight)
            
            const priceImage = fullImage.clone().crop({ 
              x: Math.max(0, priceX), 
              y: Math.max(0, priceY), 
              w: Math.min(priceW, imgWidth - priceX), 
              h: Math.min(priceH, imgHeight - priceY) 
            })
            const priceBuffer = await priceImage.getBuffer('image/jpeg')
            const priceText = await ocrImage(priceBuffer)
            price = extractPrice(priceText)
            
            console.log(`  Price: ${price} (OCR: "${priceText.substring(0, 20)}...")`)
          }
          
          // あいまい検索でDBカードを探す
          const candidates = findSimilarCards(cardName || '', dbCards || [], { maxResults: 5 })
            .map(c => ({
              id: c.id,
              name: c.name,
              cardNumber: c.card_number,
              imageUrl: c.image_url,
              rarity: c.rarity,
              similarity: c.similarity,
              isExactMatch: c.similarity >= 95
            }))
          
          const topMatch = candidates[0]
          
          let matchedCard = null
          let needsReview = false
          
          if (topMatch && topMatch.similarity >= autoMatchThreshold) {
            matchedCard = topMatch
          } else if (candidates.length > 0 && topMatch?.similarity >= 50) {
            needsReview = true
          }
          
          // 切り抜き画像をBase64に
          const cardImageBase64 = `data:image/jpeg;base64,${cardBuffer.toString('base64')}`
          
          results.push({
            index: cardIndex,
            row,
            col,
            price,
            cardImage: cardImageBase64,
            ocrText: cardName,
            ocrFullText: ocrText,
            matchedCard,
            candidates,
            needsReview
          })
          
          cardIndex++
          
        } catch (err: any) {
          console.error(`Error processing cell [${row},${col}]:`, err.message)
          results.push({
            index: cardIndex,
            row,
            col,
            price: null,
            cardImage: null,
            ocrText: null,
            matchedCard: null,
            candidates: [],
            needsReview: false,
            error: err.message
          })
          cardIndex++
        }
      }
    }
    
    // 統計
    const stats = {
      total: results.length,
      autoMatched: results.filter(r => r.matchedCard && !r.needsReview).length,
      needsReview: results.filter(r => r.needsReview).length,
      noMatch: results.filter(r => !r.matchedCard && !r.needsReview).length
    }
    
    console.log(`Results: ${stats.autoMatched} auto-matched, ${stats.needsReview} needs review, ${stats.noMatch} no match`)

    return NextResponse.json({
      success: true,
      templateName: template.name,
      cards: results,
      stats
    })

  } catch (error: any) {
    console.error('Recognition error:', error)
    return NextResponse.json(
      { error: error.message || 'Recognition failed' },
      { status: 500 }
    )
  }
}
