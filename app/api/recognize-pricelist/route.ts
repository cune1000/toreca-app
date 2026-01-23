import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { image, shopId } = await request.json();

    if (!image) {
      return NextResponse.json({ error: '画像が必要です' }, { status: 400 });
    }

    // Base64データの抽出
    const base64Data = image.replace(/^data:image\/[a-z]+;base64,/, '');
    const mediaType = image.match(/^data:(image\/[a-z]+);base64,/)?.[1] || 'image/jpeg';

    // DBからカード一覧を取得
    const { data: dbCards, error: dbError } = await supabase
      .from('cards')
      .select(`
        id,
        name,
        card_number,
        image_url,
        rarity_id,
        rarities (name)
      `)
      .order('name');

    if (dbError) {
      console.error('DB error:', dbError);
    }

    // DBカードのリストをテキストで作成（Claudeに渡す用）
    // ID、名前、カード番号、レアリティを含める
    const dbCardList = (dbCards || []).map((c, i) => {
      const rarity = (c.rarities as any)?.name || '';
      const cardNum = c.card_number || '';
      return `${c.id}|${c.name}|${cardNum}|${rarity}`;
    }).join('\n');

    // Claude Vision APIで認識（DBリストを参照させる）
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8192,
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
              text: `この買取表画像からカード情報を読み取り、データベースのカードと照合してください。

【最重要ルール】
1. カード名は必ずデータベースにある名前を使用してください
2. 「ピカチュウ」と「ピカチュウVMAX」と「ピカチュウex」は全て別のカードです
3. サフィックス（VMAX, VSTAR, V, ex, EX, GX等）を含めた完全一致で照合してください
4. データベースにないカードは matchedId を null にしてください

===== データベース（ID|カード名|カード番号|レアリティ） =====
${dbCardList}
=============================================================

JSON形式で返答してください：

{
  "cards": [
    {
      "recognizedName": "画像から読み取った文字（そのまま）",
      "matchedId": "一致したDBカードのID（UUID）" または null,
      "matchedName": "一致したDBカードの名前" または null,
      "price": 買取価格（数値のみ）,
      "confidence": 確信度（0-100）
    }
  ]
}

注意：
- matchedIdはデータベースのIDをそのままコピー
- 確信度90以上 = 確実に一致
- 確信度70-89 = おそらく一致
- 確信度70未満 = 不確実`,
            },
          ],
        },
      ],
    });

    // レスポンスからJSONを抽出
    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    
    let jsonStr = responseText;
    const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) jsonStr = jsonMatch[1];
    const directJsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (directJsonMatch) jsonStr = directJsonMatch[0];

    let recognizedData: { cards: Array<{
      recognizedName: string;
      matchedId: string | null;
      matchedName: string | null;
      price: number;
      confidence: number;
    }> };
    
    try {
      recognizedData = JSON.parse(jsonStr);
    } catch {
      console.error('JSON parse error:', jsonStr);
      return NextResponse.json({ 
        error: 'AI認識結果のパースに失敗しました',
        rawResponse: responseText 
      }, { status: 500 });
    }

    // DBカードをIDでマップ化
    const dbCardMap = new Map((dbCards || []).map(c => [c.id, c]));

    // マッチ結果を整形
    const matchedCards = recognizedData.cards.map(card => {
      let matchedCard = null;
      let candidates: any[] = [];

      // マッチしたカードを取得
      if (card.matchedId && dbCardMap.has(card.matchedId)) {
        const dbCard = dbCardMap.get(card.matchedId)!;
        matchedCard = {
          id: dbCard.id,
          name: dbCard.name,
          cardNumber: dbCard.card_number,
          rarity: (dbCard.rarities as any)?.name,
          imageUrl: dbCard.image_url,
          similarity: card.confidence,
          isExactMatch: card.confidence >= 95,
        };
      }

      // 候補を探す（名前の部分一致）
      if (dbCards) {
        const searchName = (card.recognizedName || '').toLowerCase();
        // 最初の3-4文字で検索
        const searchPrefix = searchName.substring(0, Math.min(4, searchName.length));
        
        candidates = dbCards
          .filter(db => {
            const dbName = db.name.toLowerCase();
            // 部分一致チェック
            return dbName.includes(searchPrefix) || 
                   searchName.includes(dbName.substring(0, 4)) ||
                   // カタカナの最初の部分で一致
                   dbName.startsWith(searchPrefix);
          })
          .slice(0, 5)
          .map(db => ({
            id: db.id,
            name: db.name,
            cardNumber: db.card_number,
            rarity: (db.rarities as any)?.name,
            imageUrl: db.image_url,
            similarity: 50,
          }));
      }

      // マッチしたカードを候補の先頭に
      if (matchedCard) {
        candidates = [matchedCard, ...candidates.filter(c => c.id !== matchedCard.id)].slice(0, 5);
      }

      const isAutoMatch = matchedCard && card.confidence >= 85;

      return {
        name: card.recognizedName,
        price: card.price,
        matchedCard: isAutoMatch ? matchedCard : null,
        candidates,
        needsReview: !isAutoMatch && candidates.length > 0,
        confidence: card.confidence,
        matchedName: card.matchedName,
      };
    });

    // 統計情報
    const stats = {
      total: matchedCards.length,
      autoMatched: matchedCards.filter(c => c.matchedCard !== null).length,
      needsReview: matchedCards.filter(c => c.needsReview).length,
      noMatch: matchedCards.filter(c => !c.matchedCard && c.candidates.length === 0).length,
    };

    return NextResponse.json({
      success: true,
      cards: matchedCards,
      stats,
      dbCardCount: dbCards?.length || 0,
    });

  } catch (error) {
    console.error('Recognition error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '認識に失敗しました' },
      { status: 500 }
    );
  }
}
