import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Jimp } from 'jimp'

// 動的インポート
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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// コサイン類似度を計算
function cosineSimilarity(a: number[], b: number[]): number {
  let dotProduct = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB))
}

// Base64画像からRawImageを作成（jimp新API）
async function loadImageFromBase64(base64String: string, RawImage: any) {
  // data:image/xxx;base64, の部分を削除
  const base64Data = base64String.replace(/^data:image\/\w+;base64,/, '')
  const buffer = Buffer.from(base64Data, 'base64')
  
  // jimp で画像を処理（新API）
  const image = await Jimp.read(buffer)
  const resized = image.resize({ w: 224, h: 224 })
  
  // RGBAデータを取得
  const width = resized.width
  const height = resized.height
  const bitmap = resized.bitmap
  const data = new Uint8ClampedArray(width * height * 3)
  
  let idx = 0
  for (let i = 0; i < bitmap.data.length; i += 4) {
    data[idx++] = bitmap.data[i + 0] // R
    data[idx++] = bitmap.data[i + 1] // G
    data[idx++] = bitmap.data[i + 2] // B
  }
  
  return new RawImage(data, width, height, 3)
}

// URLから画像を読み込み（jimp新API、Twitter認証対応）
async function loadImageFromUrl(url: string, RawImage: any) {
  let buffer: Buffer
  
  // Twitter/X の画像URLの場合、Bearer Tokenを使う
  if (url.includes('pbs.twimg.com') || url.includes('ton.twitter.com')) {
    const headers: HeadersInit = {}
    const bearerToken = process.env.X_BEARER_TOKEN
    if (bearerToken) {
      headers['Authorization'] = `Bearer ${bearerToken}`
    }
    
    const response = await fetch(url, { headers })
    if (!response.ok) {
      throw new Error(`Failed to fetch Twitter image: ${response.status}`)
    }
    const arrayBuffer = await response.arrayBuffer()
    buffer = Buffer.from(arrayBuffer)
  } else {
    // 通常のURL
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`)
    }
    const arrayBuffer = await response.arrayBuffer()
    buffer = Buffer.from(arrayBuffer)
  }
  
  const image = await Jimp.read(buffer)
  const resized = image.resize({ w: 224, h: 224 })
  
  const width = resized.width
  const height = resized.height
  const bitmap = resized.bitmap
  const data = new Uint8ClampedArray(width * height * 3)
  
  let idx = 0
  for (let i = 0; i < bitmap.data.length; i += 4) {
    data[idx++] = bitmap.data[i + 0] // R
    data[idx++] = bitmap.data[i + 1] // G
    data[idx++] = bitmap.data[i + 2] // B
  }
  
  return new RawImage(data, width, height, 3)
}

export async function POST(request: NextRequest) {
  const { action, ...params } = await request.json()

  try {
    switch (action) {
      case 'generateEmbedding': {
        const { imageUrl } = params
        if (!imageUrl) {
          return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 })
        }

        const { extractor, RawImage } = await getFeatureExtractor()
        const image = await loadImageFromUrl(imageUrl, RawImage)
        const output = await extractor(image, { pooling: 'mean', normalize: true })
        const embedding = Array.from(output.data)

        return NextResponse.json({
          success: true,
          embedding,
          dimensions: embedding.length,
        })
      }

      case 'generateAllEmbeddings': {
        const { limit = 50 } = params

        // 埋め込みがないカードだけを取得
        const { data: cards, error } = await supabase
          .from('cards')
          .select('id, name, image_url')
          .not('image_url', 'is', null)
          .is('embedding', null)
          .limit(limit)

        if (error) throw error
        if (!cards || cards.length === 0) {
          return NextResponse.json({ 
            success: true,
            message: 'All cards already have embeddings!',
            total: 0,
            successCount: 0,
            skipCount: 0,
            errorCount: 0,
            errors: []
          })
        }

        const { extractor, RawImage } = await getFeatureExtractor()
        
        let successCount = 0
        let errorCount = 0
        const errors: string[] = []

        for (const card of cards) {
          try {
            const image = await loadImageFromUrl(card.image_url, RawImage)
            const output = await extractor(image, { pooling: 'mean', normalize: true })
            const embedding = Array.from(output.data)

            const { error: updateError } = await supabase
              .from('cards')
              .update({ embedding })
              .eq('id', card.id)

            if (updateError) throw updateError

            successCount++
            console.log(`Embedded: ${card.name} (${successCount}/${cards.length})`)
          } catch (err: any) {
            errorCount++
            errors.push(`${card.name}: ${err.message}`)
            console.error(`Error embedding ${card.name}:`, err.message)
          }
        }

        return NextResponse.json({
          success: true,
          total: cards.length,
          successCount,
          skipCount: 0,
          errorCount,
          errors: errors.slice(0, 5),
        })
      }

      case 'search': {
        const { image, topK = 10 } = params
        if (!image) {
          return NextResponse.json({ error: 'image is required' }, { status: 400 })
        }

        const { extractor, RawImage } = await getFeatureExtractor()
        const rawImage = await loadImageFromBase64(image, RawImage)
        const output = await extractor(rawImage, { pooling: 'mean', normalize: true })
        const queryEmbedding = Array.from(output.data) as number[]

        const { data: cards, error } = await supabase
          .from('cards')
          .select('id, name, image_url, embedding, card_number')
          .not('embedding', 'is', null)

        if (error) throw error
        if (!cards || cards.length === 0) {
          return NextResponse.json({ 
            error: 'No cards with embeddings found. Run generateAllEmbeddings first.' 
          }, { status: 400 })
        }

        const validCards = cards.filter(c => c.embedding && c.embedding.length > 0)

        const results = validCards
          .map(card => ({
            id: card.id,
            name: card.name,
            imageUrl: card.image_url,
            cardNumber: card.card_number,
            similarity: cosineSimilarity(queryEmbedding, card.embedding),
          }))
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, topK)

        return NextResponse.json({
          success: true,
          totalCards: validCards.length,
          results,
        })
      }

      case 'searchByUrl': {
        const { imageUrl, topK = 10 } = params
        if (!imageUrl) {
          return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 })
        }

        const { extractor, RawImage } = await getFeatureExtractor()
        const image = await loadImageFromUrl(imageUrl, RawImage)
        const output = await extractor(image, { pooling: 'mean', normalize: true })
        const queryEmbedding = Array.from(output.data) as number[]

        const { data: cards, error } = await supabase
          .from('cards')
          .select('id, name, image_url, embedding, card_number')
          .not('embedding', 'is', null)

        if (error) throw error
        if (!cards || cards.length === 0) {
          return NextResponse.json({ 
            error: 'No cards with embeddings found. Run generateAllEmbeddings first.' 
          }, { status: 400 })
        }

        const validCards = cards.filter(c => c.embedding && c.embedding.length > 0)

        const results = validCards
          .map(card => ({
            id: card.id,
            name: card.name,
            imageUrl: card.image_url,
            cardNumber: card.card_number,
            similarity: cosineSimilarity(queryEmbedding, card.embedding),
          }))
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, topK)

        return NextResponse.json({
          success: true,
          totalCards: validCards.length,
          results,
        })
      }

      case 'status': {
        const { data: allCards } = await supabase
          .from('cards')
          .select('id')

        const { data: embeddedCards } = await supabase
          .from('cards')
          .select('id, embedding')
          .not('embedding', 'is', null)

        const actualEmbedded = embeddedCards?.filter(c => c.embedding && c.embedding.length > 0) || []

        return NextResponse.json({
          success: true,
          totalCards: allCards?.length || 0,
          embeddedCards: actualEmbedded.length,
          pendingCards: (allCards?.length || 0) - actualEmbedded.length,
        })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error: any) {
    console.error('CLIP API error:', error)
    return NextResponse.json(
      { error: error.message || 'CLIP API error' },
      { status: 500 }
    )
  }
}
