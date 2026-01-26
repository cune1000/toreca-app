import { NextRequest, NextResponse } from 'next/server'
import { getVisionClient } from '@/lib/utils/googleAuth'

export async function POST(request: NextRequest) {
  try {
    const { image, imageUrl, features = ['TEXT_DETECTION'] } = await request.json()

    if (!image && !imageUrl) {
      return NextResponse.json({ error: 'image or imageUrl is required' }, { status: 400 })
    }

    const client = await getVisionClient()

    let imageContent: any

    if (imageUrl) {
      // URLから画像を読み込み
      imageContent = { source: { imageUri: imageUrl } }
    } else {
      // Base64から画像を読み込み
      const base64Data = image.replace(/^data:image\/\w+;base64,/, '')
      imageContent = { content: Buffer.from(base64Data, 'base64') }
    }

    // 機能に応じてリクエストを構築
    const featureRequests = features.map((feature: string) => ({ type: feature }))

    const [result] = await client.annotateImage({
      image: imageContent,
      features: featureRequests
    })

    // 結果を整形
    const response: any = { success: true }

    // テキスト検出
    if (features.includes('TEXT_DETECTION')) {
      const textAnnotations = result.textAnnotations || []
      response.text = {
        fullText: textAnnotations[0]?.description || '',
        words: textAnnotations.slice(1).map((a: any) => ({
          text: a.description,
          boundingBox: a.boundingPoly?.vertices
        }))
      }
    }

    // ラベル検出
    if (features.includes('LABEL_DETECTION')) {
      response.labels = (result.labelAnnotations || []).map((l: any) => ({
        description: l.description,
        score: l.score
      }))
    }

    // ロゴ検出
    if (features.includes('LOGO_DETECTION')) {
      response.logos = (result.logoAnnotations || []).map((l: any) => ({
        description: l.description,
        score: l.score
      }))
    }

    // オブジェクト検出
    if (features.includes('OBJECT_LOCALIZATION')) {
      response.objects = (result.localizedObjectAnnotations || []).map((o: any) => ({
        name: o.name,
        score: o.score,
        boundingPoly: o.boundingPoly?.normalizedVertices
      }))
    }

    // 画像プロパティ
    if (features.includes('IMAGE_PROPERTIES')) {
      response.colors = (result.imagePropertiesAnnotation?.dominantColors?.colors || []).map((c: any) => ({
        red: c.color?.red,
        green: c.color?.green,
        blue: c.color?.blue,
        score: c.score,
        pixelFraction: c.pixelFraction
      }))
    }

    // エラー
    if (result.error) {
      response.error = result.error.message
    }

    return NextResponse.json(response)

  } catch (error: any) {
    console.error('Vision API error:', error)
    return NextResponse.json(
      { error: error.message || 'Vision API error' },
      { status: 500 }
    )
  }
}

// GET: テスト用
export async function GET() {
  return NextResponse.json({
    message: 'Google Vision OCR API',
    usage: {
      method: 'POST',
      body: {
        image: 'Base64 encoded image (optional if imageUrl provided)',
        imageUrl: 'URL of image (optional if image provided)',
        features: 'Array of features (default: ["TEXT_DETECTION"])'
      }
    },
    availableFeatures: [
      'TEXT_DETECTION',
      'DOCUMENT_TEXT_DETECTION',
      'LABEL_DETECTION',
      'LOGO_DETECTION',
      'OBJECT_LOCALIZATION',
      'IMAGE_PROPERTIES',
      'FACE_DETECTION',
      'SAFE_SEARCH_DETECTION'
    ]
  })
}
