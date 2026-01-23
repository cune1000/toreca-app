import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Jimp } from 'jimp'
import Anthropic from '@anthropic-ai/sdk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

// CLIP関連
let pipeline: any = null
let RawImage: any = null

const getFeatureExtractor = async () => {
  if (!pipeline) {
    const transformers = await import('@xenova/transformers')
    pipeline = await transformers.pipeline('image-feature-extraction', 'Xenova/clip-vit-base-patch32')
    RawImage = transformers.RawImage
  }
  return { extractor: pipeline, RawImage }
}

// コサイン類似度
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

// BufferからRawImage
async function bufferToRawImage(buffer: Buffer, RawImage: any) {
  const image = await Jimp.read(buffer)
  const resized = image.resize({ w: 224, h: 224 })
  
  const width = resized.width
  const height = resized.height
  const bitmap = resized.bitmap
  const data = new Uint8ClampedArray(width * height * 3)
  
  let idx = 0
  for (let i = 0; i < bitmap.data.length; i += 4) {
    data[idx++] = bitmap.data[i + 0]
    data[idx++] = bitmap.data[i + 1]
    data[idx++] = bitmap.data[i + 2]
  }
  
  return new RawImage(data, width, height, 3)
}

// Base64からBuffer
function base64ToBuffer(base64: string): Buffer {
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, '')
  return Buffer.from(base64Data, 'base64')
}

export async function POST(request: NextRequest) {
  const { image, autoMatchThreshold = 80 } = await request.json()

  if (!image) {
    return NextResponse.json({ error: 'image is required' }, { status: 400 })
  }

  try {
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '')

    // 1. Claude Visionでカードの位置と価格を取得
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
- ヘッダーやフッターは除く、カード部分のみ`
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

    // 2. 画像を切り出し
    console.log('Step 2: Cutting card images...')
    
    const imageBuffer = base64ToBuffer(image)
    const fullImage = await Jimp.read(imageBuffer)
    
    const imgWidth = fullImage.width
    const imgHeight = fullImage.height
    
    // ヘッダー/フッターを考慮した領域を推定
    const headerRatio = 0.08  // 上部8%はヘッダー
    const footerRatio = 0.02  // 下部2%はフッター
    const priceRowRatio = 0.08 // 各行の下部8%は価格表示
    
    const contentTop = Math.floor(imgHeight * headerRatio)
    const contentBottom = Math.floor(imgHeight * (1 - footerRatio))
    const contentHeight = contentBottom - contentTop
    
    const rowHeight = contentHeight / grid.rows
    const colWidth = imgWidth / grid.cols
    const cardHeight = rowHeight * (1 - priceRowRatio)

    // 3. CLIP準備
    console.log('Step 3: Loading CLIP model...')
    const { extractor, RawImage } = await getFeatureExtractor()

    // 4. DBから埋め込み済みカードを取得
    console.log('Step 4: Loading DB cards...')
    const { data: dbCards, error: dbError } = await supabase
      .from('cards')
      .select('id, name, image_url, embedding, card_number')
      .not('embedding', 'is', null)

    if (dbError) throw dbError

    const validDbCards = (dbCards || []).filter(c => c.embedding && c.embedding.length > 0)
    console.log(`Found ${validDbCards.length} cards with embeddings in DB`)

    if (validDbCards.length === 0) {
      return NextResponse.json({
        error: 'No cards with embeddings in DB. Please run embedding generation first.',
      }, { status: 400 })
    }

    // 5. 各カードを切り出してCLIP検索
    console.log('Step 5: Processing each card...')
    
    let autoMatched = 0
    let needsReview = 0
    let noMatch = 0

    const results = []

    for (const cardPos of cardPositions) {
      const { row, col, price } = cardPos
      
      // カード領域を計算
      const x = Math.floor(col * colWidth)
      const y = Math.floor(contentTop + row * rowHeight)
      const w = Math.floor(colWidth)
      const h = Math.floor(cardHeight)

      try {
        // 切り出し
        const cardImage = fullImage.clone().crop({ x, y, w, h })
        const cardBuffer = await cardImage.getBuffer('image/jpeg')
        
        // CLIP埋め込み生成
        const rawImage = await bufferToRawImage(cardBuffer, RawImage)
        const output = await extractor(rawImage, { pooling: 'mean', normalize: true })
        const queryEmbedding = Array.from(output.data) as number[]

        // 類似度計算
        const candidates = validDbCards
          .map(dbCard => ({
            id: dbCard.id,
            name: dbCard.name,
            cardNumber: dbCard.card_number,
            imageUrl: dbCard.image_url,
            similarity: Math.round(cosineSimilarity(queryEmbedding, dbCard.embedding) * 100),
            isExactMatch: false
          }))
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 5)

        const topMatch = candidates[0]
        
        let matchedCard = null
        let needsReviewFlag = false

        if (topMatch && topMatch.similarity >= autoMatchThreshold) {
          matchedCard = topMatch
          matchedCard.isExactMatch = topMatch.similarity >= 95
          autoMatched++
        } else if (candidates.length > 0 && topMatch.similarity >= 60) {
          needsReviewFlag = true
          needsReview++
        } else {
          noMatch++
        }

        // 切り出し画像をBase64に
        const cardBase64 = `data:image/jpeg;base64,${cardBuffer.toString('base64')}`

        results.push({
          row,
          col,
          price,
          cardImage: cardBase64,
          matchedCard,
          candidates,
          needsReview: needsReviewFlag
        })

        console.log(`Card [${row},${col}]: Top match = ${topMatch?.name} (${topMatch?.similarity}%)`)

      } catch (err: any) {
        console.error(`Error processing card [${row},${col}]:`, err.message)
        results.push({
          row,
          col,
          price,
          cardImage: null,
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
