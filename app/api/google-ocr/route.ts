import { NextRequest, NextResponse } from 'next/server'
import vision from '@google-cloud/vision'
import path from 'path'
import fs from 'fs'

// Google Cloud認証設定
const getCredentials = () => {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS
  
  if (credentialsPath) {
    const fullPath = path.resolve(credentialsPath)
    if (fs.existsSync(fullPath)) {
      return { keyFilename: fullPath }
    }
  }
  
  // Vercel用：環境変数からJSON文字列を読み込む
  const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON
  if (credentialsJson) {
    const credentials = JSON.parse(credentialsJson)
    return { credentials }
  }
  
  throw new Error('Google Cloud credentials not found')
}

// Vision APIクライアント
let visionClient: any = null

const getVisionClient = () => {
  if (!visionClient) {
    visionClient = new vision.ImageAnnotatorClient(getCredentials())
  }
  return visionClient
}

export async function POST(request: NextRequest) {
  try {
    const { image, mode = 'card' } = await request.json()

    if (!image) {
      return NextResponse.json({ error: '画像が必要です' }, { status: 400 })
    }

    // Base64データを抽出
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '')
    const imageBuffer = Buffer.from(base64Data, 'base64')

    const client = getVisionClient()

    // テキスト検出を実行
    const [result] = await client.textDetection({
      image: { content: imageBuffer }
    })

    const detections = result.textAnnotations || []
    
    if (detections.length === 0) {
      return NextResponse.json({
        success: true,
        text: '',
        cardName: null,
        confidence: 0,
        raw: []
      })
    }

    // 最初の要素が全体のテキスト
    const fullText = detections[0]?.description || ''
    
    // カードモードの場合、カード名を抽出
    let cardName = null
    if (mode === 'card') {
      cardName = extractCardName(fullText)
    }

    return NextResponse.json({
      success: true,
      text: fullText,
      cardName,
      // 個別の検出結果（デバッグ用）
      words: detections.slice(1).map(d => ({
        text: d.description,
        confidence: d.confidence
      }))
    })

  } catch (error: any) {
    console.error('Google Vision OCR error:', error)
    return NextResponse.json(
      { error: error.message || 'OCRに失敗しました' },
      { status: 500 }
    )
  }
}

/**
 * OCR結果からカード名を抽出
 * ポケモンカードの場合、名前は上部にあることが多い
 */
function extractCardName(fullText: string): string | null {
  if (!fullText) return null
  
  // 改行で分割
  const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean)
  
  if (lines.length === 0) return null
  
  // カード名の候補を探す
  // 通常、カード名は最初の数行にある
  for (const line of lines.slice(0, 5)) {
    // HPや数字だけの行はスキップ
    if (/^[\d\s]+$/.test(line)) continue
    if (/^HP\s*\d+/i.test(line)) continue
    if (line.length < 2) continue
    
    // ポケモン名 + サフィックス（ex, EX, V, VMAX, VSTAR, GX等）のパターン
    const pokemonPattern = /^(.+?)(ex|EX|V|VMAX|VSTAR|GX|vmax|vstar)?$/
    const match = line.match(pokemonPattern)
    
    if (match) {
      // 不要な文字を除去
      let name = line
        .replace(/\s+/g, '') // スペース除去
        .replace(/[「」『』【】]/g, '') // 括弧除去
      
      // 明らかにカード名でないものを除外
      if (name.includes('買取') || name.includes('価格') || name.includes('円')) {
        continue
      }
      
      return name
    }
  }
  
  // 見つからなければ最初の行を返す
  return lines[0] || null
}
