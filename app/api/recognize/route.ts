import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';
import { 
  findSimilarCards, 
  correctKnownErrors,
  type Card
} from '@/lib/fuzzyMatch';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { image, matchWithDb = true } = await request.json();

    if (!image) {
      return NextResponse.json({ error: '画像が必要です' }, { status: 400 });
    }

    // Base64データの抽出
    const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '');
    const mediaType = image.match(/^data:(image\/[a-z]+);base64,/)?.[1] || 'image/jpeg';

    // Claude Vision APIで認識
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
                data: base64Data,
              },
            },
            {
              type: 'text',
              text: `この画像のトレーディングカードを識別してください。

以下のJSON形式で返してください。必ず有効なJSONのみを返してください。
説明文や前置きは不要です。

{
  "name": "カード名（日本語、正確に）",
  "cardNumber": "カード番号（例: 198/187）またはnull",
  "rarity": "レアリティ（SAR, SR, AR, UR, RR, R, C等）またはnull",
  "series": "シリーズ名（分かれば）またはnull",
  "confidence": 認識の確信度（0-100の数値）
}

注意:
- カード名は正確に読み取ってください
- 「ex」「EX」「V」「VMAX」「VSTAR」などの接尾辞も含めてください
- 確信度は、カード名の読み取りがどれだけ確実かを示します`,
            },
          ],
        },
      ],
    });

    // レスポンスからJSONを抽出
    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }
    
    const directJsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (directJsonMatch) {
      jsonStr = directJsonMatch[0];
    }

    let recognized: {
      name: string;
      cardNumber?: string;
      rarity?: string;
      series?: string;
      confidence?: number;
    };

    try {
      recognized = JSON.parse(jsonStr);
    } catch {
      console.error('JSON parse error:', jsonStr);
      return NextResponse.json({ 
        error: 'AI認識結果のパースに失敗しました',
        rawResponse: responseText 
      }, { status: 500 });
    }

    // 既知の誤認識パターンを修正
    recognized.name = correctKnownErrors(recognized.name);

    // DBマッチングが不要な場合
    if (!matchWithDb) {
      return NextResponse.json({
        success: true,
        ...recognized,
        matched: false
      });
    }

    // DBからカード一覧を取得
    const { data: dbCards, error: dbError } = await supabase
      .from('cards')
      .select(`
        id,
        name,
        card_number,
        image_url,
        rarity_id,
        rarities (
          name
        )
      `);

    if (dbError) {
      return NextResponse.json({
        success: true,
        ...recognized,
        matched: false,
        dbError: dbError.message
      });
    }

    // あいまい検索で候補を取得
    const candidates = findSimilarCards(
      recognized.name,
      dbCards as Card[],
      { threshold: 50, maxResults: 5 }
    );

    // カード番号でも検索
    if (recognized.cardNumber) {
      const numberMatch = dbCards?.find(c => c.card_number === recognized.cardNumber);
      if (numberMatch && !candidates.find(c => c.id === numberMatch.id)) {
        candidates.unshift({
          id: numberMatch.id,
          name: numberMatch.name,
          cardNumber: numberMatch.card_number,
          rarity: (numberMatch.rarities as { name: string } | null)?.name,
          imageUrl: numberMatch.image_url,
          similarity: 100,
          isExactMatch: true
        });
      }
    }

    const bestMatch = candidates[0] || null;
    const isAutoMatch = bestMatch && bestMatch.similarity >= 85;

    return NextResponse.json({
      success: true,
      ...recognized,
      matched: true,
      matchedCard: isAutoMatch ? bestMatch : null,
      candidates,
      needsReview: !isAutoMatch && candidates.length > 0
    });

  } catch (error) {
    console.error('Recognition error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '認識に失敗しました' },
      { status: 500 }
    );
  }
}
