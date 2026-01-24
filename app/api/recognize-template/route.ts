import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Jimp } from 'jimp'
import vision from '@google-cloud/vision'
import path from 'path'
import fs from 'fs'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

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

let visionClient: any = null

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

// Google Vision OCRでテキストを読み取り
async function ocrImage(imageBuffer: Buffer): Promise<string> {
  const client = getVisionClient()
  
  const [result] = await client.textDetection({
    image: { content: imageBuffer }
  })

  const detections = result.textAnnotations || []
  return detections[0]?.description || ''
}

// OCR結果からカード名を抽出
function extractCardName(fullText: string): string | null {
  if (!fullText) return null
  
  const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean)
  
  // 除外ワード
  const excludeContains = ['進化', 'たね', '鑑定', '買取', '価格', '円', '枚', '在庫', 'HP', 'PSA', 'GEM', 'MINT']
  const excludeExact = ['10', '9', '8', '7', '6', '5', '4', '3', '2', '1']
  
  for (const line of lines.slice(0, 5)) {
    // 完全一致除外
    if (excludeExact.includes(line)) continue
    // 含む除外
    if (excludeContains.some(w => line.includes(w))) continue
    // 数字だけの行はスキップ
    if (/^[\d\s,]+$/.test(line)) continue
    // 短すぎる行はスキップ
    if (line.length < 2) continue
    
    // カード名を整形
    let name = line
      .replace(/\s+/g, '')
      .replace(/[「」『』【】\[\]]/g, '')
      .replace(/PSA\d*/gi, '')
      .replace(/\d+$/, '') // 末尾の数字を除去
    
    // 2文字以上でひらがな/カタカナ/漢字を含む
    if (name.length >= 2 && /[ぁ-んァ-ヶ一-龥]/.test(name)) {
      return name
    }
  }
  
  return lines[0] || null
}

// 価格を抽出
function extractPrice(fullText: string): number | null {
  if (!fullText) return null
  
  // カンマ区切りの数字を探す
  const match = fullText.match(/[\d,]+/)
  if (match) {
    const price = parseInt(match[0].replace(/,/g, ''), 10)
    if (!isNaN(price) && price > 0) {
      return price
    }
  }
  return null
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
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => 
      String.fromCharCode(c.charCodeAt(0) - 0xFEE0)
    )
}

// 類似度を計算
function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 100
  
  if (str1.includes(str2) || str2.includes(str1)) {
    const longer = str1.length > str2.length ? str1 : str2
    const shorter = str1.length > str2.length ? str2 : str1
    return Math.round((shorter.length / longer.length) * 90)
  }
  
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

    // 4. セルを走査して切り抜く
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
          // 切り抜く
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
