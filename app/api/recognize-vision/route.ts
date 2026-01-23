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

// Base64からBuffer
function base64ToBuffer(base64: string): Buffer {
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, '')
  return Buffer.from(base64Data, 'base64')
}

// URLから画像をBase64に変換
async function urlToBase64(url: string): Promise<string> {
  const response = await fetch(url)
  const arrayBuffer = await response.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  return buffer.toString('base64')
}

// Claude Visionで画像を比較
async function compareWithVision(
  cardImageBase64: string,
  dbCards: { id: string; name: string; image_url: string; card_number?: string }[],
  batchSize: number = 10
): Promise<{ id: string; name: string; similarity: number }[]> {
  
  // DBカードの画像をBase64に変換（最大batchSize件）
  const cardsToCompare = dbCards.slice(0, batchSize)
  
  const cardImagesForPrompt: string[] = []
  const validCards: typeof cardsToCompare = []
  
  for (const card of cardsToCompare) {
    try {
      const base64 = await urlToBase64(card.image_url)
      cardImagesForPrompt.push(base64)
      validCards.push(card)
    } catch (err) {
      console.log(`Failed to load image for ${card.name}`)
    }
  }
  
  if (validCards.length === 0) {
    return []
  }
  
  // カード情報のリストを作成
  const cardListText = validCards.map((c, i) => 
    `${i + 1}. ID: ${c.id} | 名前: ${c.name}`
  ).join('\n')
  
  // Claude Visionに送信する画像配列を作成
  const imageContents: any[] = [
    {
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/jpeg',
        data: cardImageBase64.replace(/^data:image\/\w+;base64,/, '')
      }
    },
    {
      type: 'text',
      text: '↑ これが検索対象のカード画像です。\n\n以下はデータベースのカード画像です：'
    }
  ]
  
  // DBカードの画像を追加
  validCards.forEach((card, i) => {
    imageContents.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/jpeg',
        data: cardImagesForPrompt[i]
      }
    })
    imageContents.push({
      type: 'text',
      text: `↑ カード${i + 1}: ${card.name}`
    })
  })
  
  // 最後にプロンプトを追加
  imageContents.push({
    type: 'text',
    text: `
上記の「検索対象のカード画像」と最も一致するカードを、データベースの画像から選んでください。

【重要】
- カードのイラスト、キャラクター、ポーズ、背景を比較してください
- PSA鑑定ケースに入っている場合でも、中のカードを見て判断してください
- 完全に同じカードかどうかを判断してください

カード一覧:
${cardListText}

JSON形式で回答:
{
  "matches": [
    { "cardNumber": 1, "similarity": 95, "reason": "イラストが完全一致" },
    { "cardNumber": 2, "similarity": 30, "reason": "キャラクターは同じだがポーズが違う" }
  ]
}

- cardNumber: カードの番号（1から始まる）
- similarity: 類似度（0-100）。90以上=ほぼ確実に同じカード、70-89=おそらく同じ、70未満=違う可能性が高い
- reason: 判断理由（簡潔に）

類似度の高い順に最大3件まで返してください。一致するカードがない場合は空配列を返してください。`
  })
  
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: imageContents
    }]
  })
  
  const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
  
  // JSONを抽出
  const jsonMatch = responseText.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.log('No JSON found in response:', responseText)
    return []
  }
  
  try {
    const result = JSON.parse(jsonMatch[0])
    
    return (result.matches || []).map((m: any) => ({
      id: validCards[m.cardNumber - 1]?.id,
      name: validCards[m.cardNumber - 1]?.name,
      similarity: m.similarity,
      reason: m.reason
    })).filter((m: any) => m.id)
    
  } catch (err) {
    console.error('JSON parse error:', err)
    return []
  }
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
    const headerRatio = 0.08
    const footerRatio = 0.02
    const priceRowRatio = 0.08
    
    const contentTop = Math.floor(imgHeight * headerRatio)
    const contentBottom = Math.floor(imgHeight * (1 - footerRatio))
    const contentHeight = contentBottom - contentTop
    
    const rowHeight = contentHeight / grid.rows
    const colWidth = imgWidth / grid.cols
    const cardHeight = rowHeight * (1 - priceRowRatio)

    // 3. DBからカード一覧を取得
    console.log('Step 3: Loading DB cards...')
    const { data: dbCards, error: dbError } = await supabase
      .from('cards')
      .select('id, name, image_url, card_number')
      .not('image_url', 'is', null)

    if (dbError) throw dbError

    const validDbCards = (dbCards || []).filter(c => c.image_url)
    console.log(`Found ${validDbCards.length} cards in DB`)

    if (validDbCards.length === 0) {
      return NextResponse.json({
        error: 'No cards in DB.',
      }, { status: 400 })
    }

    // 4. 各カードを切り出してClaude Visionで比較
    console.log('Step 4: Processing each card with Claude Vision...')
    
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
        const cardBase64 = cardBuffer.toString('base64')

        // Claude Visionで画像比較（上位10件のDBカードと比較）
        // TODO: 本番では事前フィルタリング（カテゴリなど）を追加
        const matches = await compareWithVision(
          cardBase64,
          validDbCards.slice(0, 20), // まず20件で試す
          10 // バッチサイズ
        )

        const topMatch = matches[0]
        
        let matchedCard = null
        let needsReviewFlag = false
        let candidates: any[] = []

        if (topMatch && topMatch.similarity >= autoMatchThreshold) {
          const dbCard = validDbCards.find(c => c.id === topMatch.id)
          matchedCard = {
            id: topMatch.id,
            name: topMatch.name,
            cardNumber: dbCard?.card_number,
            imageUrl: dbCard?.image_url,
            similarity: topMatch.similarity,
            isExactMatch: topMatch.similarity >= 95
          }
          autoMatched++
        } else if (matches.length > 0 && topMatch.similarity >= 60) {
          needsReviewFlag = true
          needsReview++
        } else {
          noMatch++
        }

        // 候補リストを作成
        candidates = matches.map(m => {
          const dbCard = validDbCards.find(c => c.id === m.id)
          return {
            id: m.id,
            name: m.name,
            cardNumber: dbCard?.card_number,
            imageUrl: dbCard?.image_url,
            similarity: m.similarity,
            isExactMatch: m.similarity >= 95
          }
        })

        // 切り出し画像をBase64に
        const cardImageBase64 = `data:image/jpeg;base64,${cardBase64}`

        results.push({
          row,
          col,
          price,
          cardImage: cardImageBase64,
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
