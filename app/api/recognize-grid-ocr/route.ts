import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { Jimp } from 'jimp'
import Anthropic from '@anthropic-ai/sdk'
import { getVisionClient } from '@/lib/utils/googleAuth'
import { extractCardName, findSimilarCards } from '@/lib/utils'

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

// Base64からBuffer
function base64ToBuffer(base64: string): Buffer {
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, '')
  return Buffer.from(base64Data, 'base64')
}

// Google Vision OCRでカード名を読み取り
async function ocrCardImage(imageBuffer: Buffer): Promise<{ text: string; cardName: string | null }> {
  const client = await getVisionClient()
  
  const [result] = await client.textDetection({
    image: { content: imageBuffer }
  })

  const detections = result.textAnnotations || []
  
  if (detections.length === 0) {
    return { text: '', cardName: null }
  }

  const fullText = detections[0]?.description || ''
  const cardName = extractCardName(fullText)
  
  return { text: fullText, cardName }
}

export async function POST(request: NextRequest) {
  const { 
    image, 
    autoMatchThreshold = 80,
    headerRatio = 8,
    footerRatio = 12,
    priceRowRatio = 10,
    sidePadding = 0
  } = await request.json()

  if (!image) {
    return NextResponse.json({ error: 'image is required' }, { status: 400 })
  }

  try {
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '')

    console.log('Step 1: Analyzing image with Claude Vision...')
    
    const claudeResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: base64Data
            }
          },
          {
            type: 'text',
            text: `この買取表画像を分析してください。

画像内のカードの配置（行数、列数）と、各カードの価格を教えてください。

以下のJSON形式で出力:
{
  "grid": {
    "rows": 行数,
    "cols": 列数
  },
  "cards": [
    { "row": 0, "col": 0, "price": 価格 },
    { "row": 0, "col": 1, "price": 価格 },
    ...
  ]
}

注意:
- row, col は 0 から始まる
- 左上から右へ、上から下へ順番に
- 価格は数値のみ（円マーク、カンマなし）
- ヘッダーやフッターは除き、カード部分のみ
- 最後の行が途中で終わっている場合もそのまま記載`
          }
        ]
      }]
    })

    const responseText = claudeResponse.content[0].type === 'text' 
      ? claudeResponse.content[0].text 
      : ''
    
    console.log('Claude response:', responseText)
    
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Could not parse grid info from Claude')
    }
    
    const gridInfo = JSON.parse(jsonMatch[0])
    const { grid, cards: cardPositions } = gridInfo

    console.log(`Grid: ${grid.rows} rows x ${grid.cols} cols, ${cardPositions.length} cards`)

    console.log('Step 2: Cutting card images...')
    console.log(`Parameters: header=${headerRatio}%, footer=${footerRatio}%, priceRow=${priceRowRatio}%, sidePadding=${sidePadding}%`)
    
    const imageBuffer = base64ToBuffer(image)
    const fullImage = await Jimp.read(imageBuffer)
    
    const imgWidth = fullImage.width
    const imgHeight = fullImage.height
    
    const contentTop = Math.floor(imgHeight * (headerRatio / 100))
    const contentBottom = Math.floor(imgHeight * (1 - footerRatio / 100))
    const contentHeight = contentBottom - contentTop
    
    const contentLeft = Math.floor(imgWidth * (sidePadding / 100))
    const contentRight = Math.floor(imgWidth * (1 - sidePadding / 100))
    const contentWidth = contentRight - contentLeft
    
    const rowHeight = contentHeight / grid.rows
    const colWidth = contentWidth / grid.cols
    const cardHeight = rowHeight * (1 - priceRowRatio / 100)

    console.log(`Image: ${imgWidth}x${imgHeight}, Content area: ${contentWidth}x${contentHeight}`)
    console.log(`Cell size: ${colWidth.toFixed(0)}x${rowHeight.toFixed(0)}, Card height: ${cardHeight.toFixed(0)}`)

    console.log('Step 3: Loading DB cards...')
    const { data: dbCards, error: dbError } = await supabase
      .from('cards')
      .select('id, name, image_url, card_number, rarity_id, rarities(name)')

    if (dbError) throw dbError

    console.log(`Found ${dbCards?.length || 0} cards in DB`)

    console.log('Step 4: Processing each card with Google Vision OCR...')
    
    let autoMatched = 0
    let needsReview = 0
    let noMatch = 0

    const results = []

    for (const cardPos of cardPositions) {
      const { row, col, price } = cardPos
      
      const x = Math.floor(contentLeft + col * colWidth)
      const y = Math.floor(contentTop + row * rowHeight)
      const w = Math.floor(colWidth)
      const h = Math.floor(cardHeight)

      const safeX = Math.max(0, Math.min(x, imgWidth - 1))
      const safeY = Math.max(0, Math.min(y, imgHeight - 1))
      const safeW = Math.min(w, imgWidth - safeX)
      const safeH = Math.min(h, imgHeight - safeY)

      try {
        const cardImage = fullImage.clone().crop({ x: safeX, y: safeY, w: safeW, h: safeH })
        const cardBuffer = await cardImage.getBuffer('image/jpeg')

        const { text: ocrText, cardName } = await ocrCardImage(cardBuffer)
        
        console.log(`Card [${row},${col}]: OCR result = "${cardName}" (full: "${ocrText.substring(0, 50)}...")`)

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
        let needsReviewFlag = false

        if (topMatch && topMatch.similarity >= autoMatchThreshold) {
          matchedCard = topMatch
          autoMatched++
        } else if (candidates.length > 0 && topMatch?.similarity >= 50) {
          needsReviewFlag = true
          needsReview++
        } else {
          noMatch++
        }

        const cardImageBase64 = `data:image/jpeg;base64,${cardBuffer.toString('base64')}`

        results.push({
          row,
          col,
          price,
          cardImage: cardImageBase64,
          ocrText: cardName,
          ocrFullText: ocrText,
          matchedCard,
          candidates,
          needsReview: needsReviewFlag
        })

        console.log(`Card [${row},${col}]: Top match = ${topMatch?.name || 'none'} (${topMatch?.similarity || 0}%)`)

      } catch (err: any) {
        console.error(`Error processing card [${row},${col}]:`, err.message)
        results.push({
          row,
          col,
          price,
          cardImage: null,
          ocrText: null,
          matchedCard: null,
          candidates: [],
          needsReview: false,
          error: err.message
        })
        noMatch++
      }
    }

    console.log(`Results: ${autoMatched} auto-matched, ${needsReview} needs review, ${noMatch} no match`)

    return NextResponse.json({
      success: true,
      grid,
      cards: results,
      stats: {
        total: results.length,
        autoMatched,
        needsReview,
        noMatch
      },
      params: {
        headerRatio,
        footerRatio,
        priceRowRatio,
        sidePadding
      }
    })

  } catch (error: any) {
    console.error('Recognition error:', error)
    return NextResponse.json(
      { error: error.message || 'Recognition failed' },
      { status: 500 }
    )
  }
}
