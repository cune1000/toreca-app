import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { pendingImageId } = await request.json()

    if (!pendingImageId) {
      return NextResponse.json({ error: 'pendingImageId is required' }, { status: 400 })
    }

    // pending_imagesから画像情報を取得
    const { data: pendingImage, error: fetchError } = await supabase
      .from('pending_images')
      .select('*')
      .eq('id', pendingImageId)
      .single()

    if (fetchError || !pendingImage) {
      return NextResponse.json({ error: 'Pending image not found' }, { status: 404 })
    }

    // 既に解析済みならスキップ
    if (pendingImage.ai_result) {
      return NextResponse.json({ 
        success: true, 
        message: 'Already analyzed',
        ai_result: pendingImage.ai_result 
      })
    }

    // ステータスを処理中に更新
    await supabase
      .from('pending_images')
      .update({ status: 'processing' })
      .eq('id', pendingImageId)

    // 画像をBase64に変換（URLの場合）
    let imageBase64 = pendingImage.image_base64
    
    if (!imageBase64 && pendingImage.image_url) {
      try {
        const proxyRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/image-proxy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: pendingImage.image_url, returnBase64: true }),
        })
        const proxyData = await proxyRes.json()
        if (proxyData.success && proxyData.base64) {
          imageBase64 = proxyData.base64
        }
      } catch (err) {
        console.error('Failed to convert image to base64:', err)
      }
    }

    if (!imageBase64) {
      await supabase
        .from('pending_images')
        .update({ status: 'pending', ai_result: { error: 'Failed to load image' } })
        .eq('id', pendingImageId)
      return NextResponse.json({ error: 'Failed to load image' }, { status: 400 })
    }

    // AI認識APIを呼び出す
    const recognizeRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/recognize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: imageBase64.startsWith('data:') ? imageBase64.split(',')[1] : imageBase64,
        enableGrounding: true,
      }),
    })

    const recognizeData = await recognizeRes.json()

    if (!recognizeData.success) {
      await supabase
        .from('pending_images')
        .update({ 
          status: 'pending', 
          ai_result: { error: recognizeData.error || 'Recognition failed' } 
        })
        .eq('id', pendingImageId)
      return NextResponse.json({ error: recognizeData.error || 'Recognition failed' }, { status: 500 })
    }

    // 解析結果を保存
    const aiResult = {
      cards: recognizeData.data.cards,
      is_psa: recognizeData.data.is_psa,
      grounding_stats: recognizeData.data.grounding_stats,
      analyzed_at: new Date().toISOString(),
    }

    await supabase
      .from('pending_images')
      .update({ 
        status: 'pending',
        ai_result: aiResult 
      })
      .eq('id', pendingImageId)

    return NextResponse.json({ 
      success: true, 
      ai_result: aiResult,
      card_count: recognizeData.data.cards?.length || 0
    })

  } catch (error: any) {
    console.error('Analyze error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
