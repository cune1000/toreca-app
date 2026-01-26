import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { Jimp } from 'jimp'

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

// URLから画像を取得してBufferに変換
async function urlToBuffer(url: string): Promise<Buffer> {
  const response = await fetch(url)
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}

// POST: 画像検索またはEmbedding生成
export async function POST(request: NextRequest) {
  const { action, image, imageUrl, cardId, maxResults = 5, threshold = 50 } = await request.json()

  if (!action) {
    return NextResponse.json({ error: 'action is required (search or generate)' }, { status: 400 })
  }

  try {
    const { extractor, RawImage } = await getFeatureExtractor()

    switch (action) {
      case 'search': {
        // 画像検索
        if (!image && !imageUrl) {
          return NextResponse.json({ error: 'image or imageUrl is required for search' }, { status: 400 })
        }

        let imageBuffer: Buffer
        if (imageUrl) {
          imageBuffer = await urlToBuffer(imageUrl)
        } else {
          const base64Data = image.replace(/^data:image\/\w+;base64,/, '')
          imageBuffer = Buffer.from(base64Data, 'base64')
        }

        // CLIP埋め込み生成
        const rawImage = await bufferToRawImage(imageBuffer, RawImage)
        const output = await extractor(rawImage, { pooling: 'mean', normalize: true })
        const queryEmbedding = Array.from(output.data) as number[]

        // DBから埋め込み済みカードを取得
        const { data: dbCards, error: dbError } = await supabase
          .from('cards')
          .select('id, name, image_url, embedding, card_number, rarity_id, rarities(name)')
          .not('embedding', 'is', null)

        if (dbError) throw dbError

        const validDbCards = (dbCards || []).filter(c => c.embedding && c.embedding.length > 0)

        if (validDbCards.length === 0) {
          return NextResponse.json({
            success: true,
            results: [],
            message: 'No cards with embeddings in DB. Please run embedding generation first.'
          })
        }

        // 類似度計算
        const results = validDbCards
          .map(card => ({
            id: card.id,
            name: card.name,
            cardNumber: card.card_number,
            imageUrl: card.image_url,
            rarity: card.rarities?.name,
            similarity: Math.round(cosineSimilarity(queryEmbedding, card.embedding) * 100),
          }))
          .filter(card => card.similarity >= threshold)
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, maxResults)

        return NextResponse.json({
          success: true,
          results,
          totalWithEmbeddings: validDbCards.length
        })
      }

      case 'generate': {
        // カードの埋め込みを生成
        if (!cardId) {
          return NextResponse.json({ error: 'cardId is required for generate' }, { status: 400 })
        }

        // カード情報を取得
        const { data: card, error: cardError } = await supabase
          .from('cards')
          .select('id, name, image_url')
          .eq('id', cardId)
          .single()

        if (cardError || !card) {
          return NextResponse.json({ error: 'Card not found' }, { status: 404 })
        }

        if (!card.image_url) {
          return NextResponse.json({ error: 'Card has no image URL' }, { status: 400 })
        }

        // 画像を取得してEmbedding生成
        const imageBuffer = await urlToBuffer(card.image_url)
        const rawImage = await bufferToRawImage(imageBuffer, RawImage)
        const output = await extractor(rawImage, { pooling: 'mean', normalize: true })
        const embedding = Array.from(output.data) as number[]

        // DBに保存
        const { error: updateError } = await supabase
          .from('cards')
          .update({ embedding })
          .eq('id', cardId)

        if (updateError) throw updateError

        return NextResponse.json({
          success: true,
          cardId,
          name: card.name,
          embeddingDimension: embedding.length
        })
      }

      case 'bulk-generate': {
        // 一括埋め込み生成
        const { limit = 100, skipExisting = true } = await request.json()

        // 画像URLがあるカードを取得
        let query = supabase
          .from('cards')
          .select('id, name, image_url, embedding')
          .not('image_url', 'is', null)
          .limit(limit)

        if (skipExisting) {
          query = query.is('embedding', null)
        }

        const { data: cards, error: fetchError } = await query

        if (fetchError) throw fetchError

        if (!cards || cards.length === 0) {
          return NextResponse.json({
            success: true,
            processed: 0,
            message: 'No cards to process'
          })
        }

        let successCount = 0
        let errorCount = 0
        const errors: string[] = []

        for (const card of cards) {
          try {
            const imageBuffer = await urlToBuffer(card.image_url)
            const rawImage = await bufferToRawImage(imageBuffer, RawImage)
            const output = await extractor(rawImage, { pooling: 'mean', normalize: true })
            const embedding = Array.from(output.data) as number[]

            await supabase
              .from('cards')
              .update({ embedding })
              .eq('id', card.id)

            successCount++
            console.log(`Generated embedding for: ${card.name}`)
          } catch (err: any) {
            errorCount++
            errors.push(`${card.name}: ${err.message}`)
          }
        }

        return NextResponse.json({
          success: true,
          total: cards.length,
          successCount,
          errorCount,
          errors: errors.slice(0, 10)
        })
      }

      default:
        return NextResponse.json({ error: 'Unknown action. Use: search, generate, or bulk-generate' }, { status: 400 })
    }

  } catch (error: any) {
    console.error('CLIP error:', error)
    return NextResponse.json(
      { error: error.message || 'CLIP processing failed' },
      { status: 500 }
    )
  }
}

// GET: テスト用
export async function GET() {
  return NextResponse.json({
    message: 'CLIP Image Embedding API',
    actions: {
      search: 'Search cards by image similarity (POST with image or imageUrl)',
      generate: 'Generate embedding for a card (POST with cardId)',
      'bulk-generate': 'Generate embeddings for multiple cards (POST with limit, skipExisting)'
    },
    model: 'Xenova/clip-vit-base-patch32'
  })
}
