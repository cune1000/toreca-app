import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// テンプレート一覧取得
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const shopId = searchParams.get('shop_id')
  const id = searchParams.get('id')

  try {
    // 単一テンプレート取得
    if (id) {
      const { data, error } = await supabase
        .from('grid_templates')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return NextResponse.json(data)
    }

    // 一覧取得
    let query = supabase
      .from('grid_templates')
      .select('*')
      .order('created_at', { ascending: false })

    if (shopId) {
      query = query.eq('shop_id', shopId)
    }

    const { data, error } = await query

    if (error) throw error
    return NextResponse.json(data)

  } catch (error: any) {
    console.error('Error fetching templates:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}

// テンプレート保存
export async function POST(request: NextRequest) {
  const body = await request.json()
  const { name, shopId, verticalLines, horizontalLines, cells } = body

  if (!name || !verticalLines || !horizontalLines || !cells) {
    return NextResponse.json(
      { error: 'name, verticalLines, horizontalLines, cells are required' },
      { status: 400 }
    )
  }

  try {
    const { data, error } = await supabase
      .from('grid_templates')
      .insert({
        name,
        shop_id: shopId || null,
        vertical_lines: verticalLines,
        horizontal_lines: horizontalLines,
        cells
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      template: data
    })

  } catch (error: any) {
    console.error('Error saving template:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to save template' },
      { status: 500 }
    )
  }
}

// テンプレート更新
export async function PUT(request: NextRequest) {
  const body = await request.json()
  const { id, name, shopId, verticalLines, horizontalLines, cells } = body

  if (!id) {
    return NextResponse.json(
      { error: 'id is required' },
      { status: 400 }
    )
  }

  try {
    const updateData: any = { updated_at: new Date().toISOString() }
    if (name) updateData.name = name
    if (shopId !== undefined) updateData.shop_id = shopId || null
    if (verticalLines) updateData.vertical_lines = verticalLines
    if (horizontalLines) updateData.horizontal_lines = horizontalLines
    if (cells) updateData.cells = cells

    const { data, error } = await supabase
      .from('grid_templates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      template: data
    })

  } catch (error: any) {
    console.error('Error updating template:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to update template' },
      { status: 500 }
    )
  }
}

// テンプレート削除
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')

  if (!id) {
    return NextResponse.json(
      { error: 'id is required' },
      { status: 400 }
    )
  }

  try {
    const { error } = await supabase
      .from('grid_templates')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({ success: true })

  } catch (error: any) {
    console.error('Error deleting template:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to delete template' },
      { status: 500 }
    )
  }
}
