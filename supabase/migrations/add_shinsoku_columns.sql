-- シンソク買取価格連携のためのDB変更
-- 実行日: 2026-02-09

-- 1. cardsテーブルにシンソク連携カラムを追加
ALTER TABLE cards
ADD COLUMN IF NOT EXISTS shinsoku_item_id TEXT,
ADD COLUMN IF NOT EXISTS shinsoku_linked_at TIMESTAMPTZ;

-- インデックス
CREATE INDEX IF NOT EXISTS idx_cards_shinsoku_item_id
ON cards(shinsoku_item_id)
WHERE shinsoku_item_id IS NOT NULL;

-- コメント
COMMENT ON COLUMN cards.shinsoku_item_id IS 'シンソク買取APIのitem_id（例: IAP2500002298）';
COMMENT ON COLUMN cards.shinsoku_linked_at IS 'シンソクと紐付けた日時';

-- 2. purchase_shopsにシンソクを登録
INSERT INTO purchase_shops (name, url, notes)
VALUES (
  'シンソク（郵送買取）',
  'https://shinsoku-tcg.com/yuso-kaitori',
  '自動スクレイピング対象。API: /api/items'
)
ON CONFLICT DO NOTHING;
