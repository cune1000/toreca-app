import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

/**
 * GET: よくある誤認識パターンを取得
 * これを使ってfuzzyMatch.tsの修正辞書を動的に更新できる
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100');
    const minCount = parseInt(searchParams.get('minCount') || '2');

    // 誤認識パターンを集計して取得
    const { data, error } = await supabase
      .from('recognition_corrections')
      .select('recognized_name, corrected_name')
      .order('created_at', { ascending: false });

    if (error) {
      // テーブルがない場合は空を返す
      if (error.code === '42P01') {
        return NextResponse.json({ patterns: [], message: 'テーブルが未作成です' });
      }
      throw error;
    }

    // パターンを集計
    const patternMap = new Map<string, { corrected: string; count: number }>();
    
    for (const row of data || []) {
      const key = row.recognized_name;
      const existing = patternMap.get(key);
      
      if (existing) {
        existing.count++;
        // 最も多い修正先を採用
      } else {
        patternMap.set(key, { corrected: row.corrected_name, count: 1 });
      }
    }

    // 閾値以上のパターンのみ返す
    const patterns = Array.from(patternMap.entries())
      .filter(([, v]) => v.count >= minCount)
      .map(([recognized, { corrected, count }]) => ({
        recognized,
        corrected,
        count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);

    return NextResponse.json({ 
      success: true,
      patterns,
      total: patterns.length
    });

  } catch (error) {
    console.error('Error fetching patterns:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '取得に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * POST: 誤認識修正を記録
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      recognizedName, 
      recognizedCardNumber,
      recognizedRarity,
      correctedCardId, 
      correctedName,
      similarityScore,
      sourceType = 'single'
    } = body;

    if (!recognizedName || !correctedName) {
      return NextResponse.json(
        { error: 'recognizedName と correctedName は必須です' },
        { status: 400 }
      );
    }

    // 同じ認識結果を同じカードに修正した場合は記録しない
    if (recognizedName === correctedName) {
      return NextResponse.json({ 
        success: true, 
        skipped: true,
        message: '認識結果と修正結果が同じため記録をスキップしました' 
      });
    }

    const { data, error } = await supabase
      .from('recognition_corrections')
      .insert({
        recognized_name: recognizedName,
        recognized_card_number: recognizedCardNumber,
        recognized_rarity: recognizedRarity,
        corrected_card_id: correctedCardId,
        corrected_name: correctedName,
        similarity_score: similarityScore,
        source_type: sourceType
      })
      .select()
      .single();

    if (error) {
      // テーブルがない場合
      if (error.code === '42P01') {
        return NextResponse.json({ 
          success: false, 
          message: 'recognition_corrections テーブルが未作成です。SQLを実行してください。' 
        });
      }
      throw error;
    }

    return NextResponse.json({ 
      success: true, 
      correction: data 
    });

  } catch (error) {
    console.error('Error saving correction:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '保存に失敗しました' },
      { status: 500 }
    );
  }
}

/**
 * DELETE: 特定のパターンを削除（管理用）
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const recognizedName = searchParams.get('recognizedName');

    if (!recognizedName) {
      return NextResponse.json(
        { error: 'recognizedName パラメータが必要です' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('recognition_corrections')
      .delete()
      .eq('recognized_name', recognizedName);

    if (error) throw error;

    return NextResponse.json({ 
      success: true, 
      deleted: recognizedName 
    });

  } catch (error) {
    console.error('Error deleting pattern:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '削除に失敗しました' },
      { status: 500 }
    );
  }
}
