import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { getGoogleCredentials, getProductSearchClient, getVisionClient } from '@/lib/utils/googleAuth'

const projectId = process.env.GOOGLE_CLOUD_PROJECT_ID!
const location = process.env.GOOGLE_CLOUD_LOCATION || 'asia-northeast1'

export async function POST(request: NextRequest) {
  const { action, ...params } = await request.json()

  try {
    // Product Search用クライアント
    const productSearchClient = await getProductSearchClient()
    
    // パスを手動で構築
    const locationPath = `projects/${projectId}/locations/${location}`

    switch (action) {
      case 'createProductSet': {
        // カタログ（Product Set）を作成
        const productSetId = params.productSetId || 'toreca-cards'
        const displayName = params.displayName || 'トレカカタログ'

        const [productSet] = await productSearchClient.createProductSet({
          parent: locationPath,
          productSetId,
          productSet: {
            displayName,
          },
        })

        return NextResponse.json({
          success: true,
          productSet: {
            name: productSet.name,
            displayName: productSet.displayName,
          },
        })
      }

      case 'createProduct': {
        // 商品（カード）を登録
        const { productId, displayName, category, imageUrl, cardId } = params

        // 商品を作成
        const [product] = await productSearchClient.createProduct({
          parent: locationPath,
          productId,
          product: {
            displayName,
            productCategory: 'general-v1',
            productLabels: [
              { key: 'card_id', value: cardId },
              { key: 'category', value: category || 'pokemon' },
            ],
          },
        })

        // 参照画像を追加
        if (imageUrl && product.name) {
          await productSearchClient.createReferenceImage({
            parent: product.name,
            referenceImage: {
              uri: imageUrl,
            },
          })
        }

        return NextResponse.json({
          success: true,
          product: {
            name: product.name,
            displayName: product.displayName,
          },
        })
      }

      case 'addProductToSet': {
        // 商品をカタログに追加
        const { productSetId, productId } = params

        const productSetPath = `${locationPath}/productSets/${productSetId}`
        const productPath = `${locationPath}/products/${productId}`

        await productSearchClient.addProductToProductSet({
          name: productSetPath,
          product: productPath,
        })

        return NextResponse.json({
          success: true,
          message: `Product ${productId} added to ${productSetId}`,
        })
      }

      case 'bulkImport': {
        // DBのカードを一括でProduct Searchに登録
        const productSetId = params.productSetId || 'toreca-cards'
        const productSetPath = `${locationPath}/productSets/${productSetId}`

        // DBからカードを取得
        const { data: cards, error } = await supabase
          .from('cards')
          .select('id, name, image_url, card_number')
          .not('image_url', 'is', null)
          .limit(100) // まず100件でテスト

        if (error) throw error
        if (!cards || cards.length === 0) {
          return NextResponse.json({ error: 'No cards found' }, { status: 400 })
        }

        // Product Setが存在するか確認
        try {
          await productSearchClient.getProductSet({ name: productSetPath })
        } catch {
          // 存在しない場合は作成
          await productSearchClient.createProductSet({
            parent: locationPath,
            productSetId,
            productSet: {
              displayName: 'トレカカタログ',
            },
          })
        }

        let successCount = 0
        let errorCount = 0
        const errors: string[] = []

        for (const card of cards) {
          try {
            // UUIDからハイフンを除去してproductIdとして使用
            const productId = `card-${card.id.replace(/-/g, '')}`

            // 商品を作成
            const [product] = await productSearchClient.createProduct({
              parent: locationPath,
              productId,
              product: {
                displayName: card.name,
                productCategory: 'general-v1',
                productLabels: [
                  { key: 'card_id', value: card.id },
                  { key: 'card_number', value: card.card_number || '' },
                ],
              },
            })

            // 参照画像を追加（公開URLを使用）
            if (product.name) {
              await productSearchClient.createReferenceImage({
                parent: product.name,
                referenceImage: {
                  uri: card.image_url,
                },
              })

              // カタログに追加
              await productSearchClient.addProductToProductSet({
                name: productSetPath,
                product: product.name,
              })
            }

            successCount++
          } catch (err: any) {
            errorCount++
            errors.push(`${card.name}: ${err.message}`)
            // 既に存在するエラーは無視して続行
            if (!err.message?.includes('already exists')) {
              console.error(`Error registering ${card.name}:`, err.message)
            }
          }
        }

        return NextResponse.json({
          success: true,
          total: cards.length,
          successCount,
          errorCount,
          errors: errors.slice(0, 10),
        })
      }

      case 'search': {
        // 画像で商品を検索
        const { image, productSetId } = params
        const productSetPath = `${locationPath}/productSets/${productSetId || 'toreca-cards'}`

        // Image Annotator クライアント
        const imageAnnotatorClient = await getVisionClient()

        // Base64画像からバッファを作成
        const imageBuffer = Buffer.from(
          image.replace(/^data:image\/\w+;base64,/, ''),
          'base64'
        )

        const [response] = await imageAnnotatorClient.productSearch({
          image: { content: imageBuffer },
          imageContext: {
            productSearchParams: {
              productSet: productSetPath,
              productCategories: ['general-v1'],
            },
          },
        })

        const results = response.productSearchResults?.results || []

        return NextResponse.json({
          success: true,
          results: results.map((r: any) => ({
            productId: r.product?.name?.split('/').pop(),
            displayName: r.product?.displayName,
            score: r.score,
            cardId: r.product?.productLabels?.find((l: any) => l.key === 'card_id')?.value,
          })),
        })
      }

      case 'listProducts': {
        // 登録済み商品一覧
        const [products] = await productSearchClient.listProducts({
          parent: locationPath,
        })

        return NextResponse.json({
          success: true,
          count: Array.isArray(products) ? products.length : 0,
          products: Array.isArray(products) 
            ? products.slice(0, 20).map((p: any) => ({
                name: p.name,
                displayName: p.displayName,
              }))
            : [],
        })
      }

      case 'listProductSets': {
        // 登録済みカタログ一覧
        const [productSets] = await productSearchClient.listProductSets({
          parent: locationPath,
        })

        return NextResponse.json({
          success: true,
          count: Array.isArray(productSets) ? productSets.length : 0,
          productSets: Array.isArray(productSets)
            ? productSets.map((ps: any) => ({
                name: ps.name,
                displayName: ps.displayName,
              }))
            : [],
        })
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
    }
  } catch (error: any) {
    console.error('Vision API error:', error)
    return NextResponse.json(
      { error: error.message || 'Vision API error' },
      { status: 500 }
    )
  }
}
