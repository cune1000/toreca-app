import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    const { image, cardId, fileName } = await request.json()

    if (!image) {
      return NextResponse.json({ error: '画像がありません' }, { status: 400 })
    }

    // Base64からバイナリに変換
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')

    // ファイル名を生成
    const ext = image.match(/^data:image\/(\w+);/)?.[1] || 'jpg'
    const finalFileName = fileName || `${cardId || 'card'}_${Date.now()}.${ext}`
    const filePath = `cards/${finalFileName}`

    // Supabase Storageにアップロード
    const { data, error } = await supabase.storage
      .from('card-images')
      .upload(filePath, buffer, {
        contentType: `image/${ext}`,
        upsert: true,
      })

    if (error) {
      console.error('Upload error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // 公開URLを取得
    const { data: urlData } = supabase.storage
      .from('card-images')
      .getPublicUrl(filePath)

    return NextResponse.json({
      success: true,
      path: filePath,
      url: urlData.publicUrl,
    })
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { error: error.message || 'アップロードに失敗しました' },
      { status: 500 }
    )
  }
}
