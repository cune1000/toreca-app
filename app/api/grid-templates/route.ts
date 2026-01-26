import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET: テンプレート一覧取得
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const shopId = searchParams.get('shopId')
    const id = searchParams.get('id')

    // 単一テンプレート取得
    if (id) {
      const { data, error } = await supabase
        .from('grid_templates')
        .select('*')
        .eq('id', id)
        .single()

      if (error) throw error
      return NextResponse.json({ success: true, template: data })
    }

    // テンプレート一覧取得
    let query = supabase
      .from('grid_templates')
      .select('*')
      .order('created_at', { ascending: false })

    if (shopId) {
      query = query.eq('shop_id', shopId)
    }

    const { data, error } = await query

    if (error) throw error

    return NextResponse.json({
      success: true,
      templates: data,
      total: data?.length || 0
    })

  } catch (error: any) {
    console.error('Error fetching templates:', error)
    return NextResponse.json(
      { error: error.message || '取得に失敗しました' },
      { status: 500 }
    )
  }
}

// POST: テンプレート作成
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      name,
      shopId,
      verticalLines,
      horizontalLines,
      cells,
      thumbnailUrl,
      description
    } = body

    if (!name || !verticalLines || !horizontalLines || !cells) {
      return NextResponse.json(
        { error: 'name, verticalLines, horizontalLines, cells は必須です' },
        { status: 400 }
      )
    }

    // 縦線と横線の数をチェック
    if (verticalLines.length < 2 || horizontalLines.length < 2) {
      return NextResponse.json(
        { error: '縦線・横線は最低2本必要です' },
        { status: 400 }
      )
    }

    // セル配列のサイズをチェック
    const expectedRows = horizontalLines.length - 1
    const expectedCols = verticalLines.length - 1

    if (cells.length !== expectedRows) {
      return NextResponse.json(
        { error: `cells の行数が不正です（期待: ${expectedRows}）` },
        { status: 400 }
      )
    }

    for (let i = 0; i < cells.length; i++) {
      if (cells[i].length !== expectedCols) {
        return NextResponse.json(
          { error: `cells[${i}] の列数が不正です（期待: ${expectedCols}）` },
          { status: 400 }
        )
      }
    }

    const { data, error } = await supabase
      .from('grid_templates')
      .insert({
        name,
        shop_id: shopId || null,
        vertical_lines: verticalLines,
        horizontal_lines: horizontalLines,
        cells,
        thumbnail_url: thumbnailUrl || null,
        description: description || null
      })
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({
      success: true,
      template: data
    })

  } catch (error: any) {
    console.error('Error creating template:', error)
    return NextResponse.json(
      { error: error.message || '作成に失敗しました' },
      { status: 500 }
    )
  }
}

// PUT: テンプレート更新
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    // 更新データを整形
    const updateData: any = {}
    if (updates.name !== undefined) updateData.name = updates.name
    if (updates.shopId !== undefined) updateData.shop_id = updates.shopId
    if (updates.verticalLines !== undefined) updateData.vertical_lines = updates.verticalLines
    if (updates.horizontalLines !== undefined) updateData.horizontal_lines = updates.horizontalLines
    if (updates.cells !== undefined) updateData.cells = updates.cells
    if (updates.thumbnailUrl !== undefined) updateData.thumbnail_url = updates.thumbnailUrl
    if (updates.description !== undefined) updateData.description = updates.description

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
      { error: error.message || '更新に失敗しました' },
      { status: 500 }
    )
  }
}

// DELETE: テンプレート削除
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const { error } = await supabase
      .from('grid_templates')
      .delete()
      .eq('id', id)

    if (error) throw error

    return NextResponse.json({
      success: true,
      deleted: id
    })

  } catch (error: any) {
    console.error('Error deleting template:', error)
    return NextResponse.json(
      { error: error.message || '削除に失敗しました' },
      { status: 500 }
    )
  }
}
