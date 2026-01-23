import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Jimp } from 'jimp'
import Anthropic from '@anthropic-ai/sdk'
import vision from '@google-cloud/vision'
import path from 'path'
import fs from 'fs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!
})

// Google Cloud認証設定
const getGoogleCredentials = () => {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  
  if (credentialsPath) {
    const fullPath = path.resolve(credentialsPath)
    if (fs.existsSync(fullPath)) {
      return { keyFilename: fullPath }
    }
  }
  
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  if (credentialsJson) {
    const credentials = JSON.parse(credentialsJson)
    return { credentials }
  }
  
  throw new Error('Google Cloud credentials not found')
}

let visionClient: vision.ImageAnnotatorClient | null = null

const getVisionClient = () => {
  if (!visionClient) {
    visionClient = new vision.ImageAnnotatorClient(getGoogleCredentials())
  }
  return visionClient
}

// Base64からBuffer
function base64ToBuffer(base64: string): Buffer {
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, '')
  return Buffer.from(base64Data, 'base64')
}

// Google Vision OCRでカード名を読み取り
async function ocrCardImage(imageBuffer: Buffer): Promise<{ text: string; cardName: string | null }> {
  const client = getVisionClient()
  
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

// OCR結果からカード名を抽出
function extractCardName(fullText: string): string | null {
  if (!fullText) return null
  
  const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean)
  
  if (lines.length === 0) return null
  
  for (const line of lines.slice(0, 5)) {
    // HPや数字だけの行はスキップ
    if (/^[\d\s]+$/.test(line)) continue
    if (/^HP\s*\d+/i.test(line)) continue
    if (line.length < 2) continue
    
    let name = line
      .replace(/\s+/g, '')
      .replace(/[「」『』【】\[\]]/g, '')
    
    // 明らかにカード名でないものを除外
    if (name.includes('買取') || name.includes('価格') || name.includes('円') || 
        name.includes('PSA') || name.includes('鑑定')) {
      continue
    }
    
    // 2文字以上でひらがな/カタカナ/漢字を含む
    if (name.length >= 2 && /[ぁ-んァ-ヶ一-龥]/.test(name)) {
      return name
    }
  }
  
  return lines[0] || null
}

// あいまい検索でDBカードを探す
function findSimilarCards(
  searchName: string,
  dbCards: any[],
  maxResults: number = 5
): any[] {
  if (!searchName) return []
  
  const normalizedSearch = normalizeCardName(searchName)
  
  const results = dbCards
    .map(card => {
      const normalizedDb = normalizeCardName(card.name)
      const similarity = calculateSimilarity(normalizedSearch, normalizedDb)
      return { ...card, similarity }
    })
    .filter(card => card.similarity > 30)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, maxResults)
  
  return results
}

// カード名を正規化
function normalizeCardName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[ー−]/g, '-')
    // 全角英数を半角に
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => 
      String.fromCharCode(c.charCodeAt(0) - 0xFEE0)
    )
    // サフィックスの表記ゆれを統一
    .replace(/ｅｘ/g, 'ex')
    .replace(/ＥＸ/g, 'ex')
    .replace(/ｖｍａｘ/g, 'vmax')
    .replace(/ｖｓｔａｒ/g, 'vstar')
}

// 類似度を計算（レーベンシュタイン距離ベース）
function calculateSimilarity(str1: string, str2: string): number {
  // 完全一致
  if (str1 === str2) return 100
  
  // 部分一致チェック
  if (str1.includes(str2) || str2.includes(str1)) {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1
    return Math.round((shorter.length / longer.length) * 90)
  }
  
  // レーベンシュタイン距離
  const distance = levenshteinDistance(str1, str2)
  const maxLen = Math.max(str1.length, str2.length)
  const similarity = Math.round((1 - distance / maxLen) * 100)
  
  return Math.max(0, similarity)
}

function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length
  const n = str2.length
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))
  
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + 1
        )
      }
    }
  }
  
  return dp[m][n]
}

export async function POST(request: NextRequest) {
  const { 
    image, 
    autoMatchThreshold = 80,
    // 切り抜きパラメータ（%で指定）
    headerRatio = 8,      // ヘッダー部分（上部）
    footerRatio = 12,     // フッター部分（下部）
    priceRowRatio = 10,   // 各カード下部の価格表示部分
    sidePadding = 0       // 左右のパディング
  } = await request.json()

  if (!image) {
    return NextResponse.json({ error: 'image is required' }, { status: 400 })
  }

  try {
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '')

    // 1. Claude Visionでカードの配置（行数、列数）と価格を取得
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
- ヘッダーやフッターは除く、カード部分のみ
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

    // 2. 画像を切り出し
    console.log('Step 2: Cutting card images...')
    console.log(`Parameters: header=${headerRatio}%, footer=${footerRatio}%, priceRow=${priceRowRatio}%, sidePadding=${sidePadding}%`)
    
    const imageBuffer = base64ToBuffer(image)
    const fullImage = await Jimp.read(imageBuffer)
    
    const imgWidth = fullImage.width
    const imgHeight = fullImage.height
    
    // パラメータを適用（%からピクセルに変換）
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

    // 3. DBからカード一覧を取得
    console.log('Step 3: Loading DB cards...')
    const { data: dbCards, error: dbError } = await supabase
      .from('cards')
      .select('id, name, image_url, card_number, rarity_id, rarities(name)')

    if (dbError) throw dbError

    console.log(`Found ${dbCards?.length || 0} cards in DB`)

    // 4. 各カードを切り出してGoogle Vision OCRで名前を読み取り
    console.log('Step 4: Processing each card with Google Vision OCR...')
    
    let autoMatched = 0
    let needsReview = 0
    let noMatch = 0

    const results = []

    for (const cardPos of cardPositions) {
      const { row, col, price } = cardPos
      
      // カード領域を計算
      const x = Math.floor(contentLeft + col * colWidth)
      const y = Math.floor(contentTop + row * rowHeight)
      const w = Math.floor(colWidth)
      const h = Math.floor(cardHeight)

      // 範囲チェック
      const safeX = Math.max(0, Math.min(x, imgWidth - 1))
      const safeY = Math.max(0, Math.min(y, imgHeight - 1))
      const safeW = Math.min(w, imgWidth - safeX)
      const safeH = Math.min(h, imgHeight - safeY)

      try {
        // 切り出し
        const cardImage = fullImage.clone().crop({ x: safeX, y: safeY, w: safeW, h: safeH })
        const cardBuffer = await cardImage.getBuffer('image/jpeg')

        // Google Vision OCRでカード名を読み取り
        const { text: ocrText, cardName } = await ocrCardImage(cardBuffer)
        
        console.log(`Card [${row},${col}]: OCR result = "${cardName}" (full: "${ocrText.substring(0, 50)}...")`)

        // あいまい検索でDBカードを探す
        const candidates = findSimilarCards(cardName || '', dbCards || [], 5)
          .map(c => ({
            id: c.id,
            name: c.name,
            cardNumber: c.card_number,
            imageUrl: c.image_url,
            rarity: c.rarities?.name,
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

        // 切り出し画像をBase64に
        const cardImageBase64 = `data:image/jpeg;base64,${cardBuffer.toString('base64')}`

        results.push({
          row,
          col,
          price,
          cardImage: cardImageBase64,
          ocrText: cardName,  // OCRで読み取った名前
          ocrFullText: ocrText,  // OCR全文（デバッグ用）
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
      // 使用したパラメータを返す（デバッグ用）
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
