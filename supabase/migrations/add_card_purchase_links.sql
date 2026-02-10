-- card_purchase_links テーブル作成
-- 1つのカードに対して複数の買取紐付けを管理
CREATE TABLE IF NOT EXISTS card_purchase_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES purchase_shops(id),
  external_key TEXT NOT NULL,
  label TEXT NOT NULL DEFAULT '',
  condition TEXT DEFAULT 'normal',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(card_id, shop_id, external_key)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_card_purchase_links_card_id
ON card_purchase_links(card_id);

CREATE INDEX IF NOT EXISTS idx_card_purchase_links_shop_id
ON card_purchase_links(shop_id);

-- purchase_prices に link_id を追加（紐付けごとに価格を区別）
ALTER TABLE purchase_prices
ADD COLUMN IF NOT EXISTS link_id UUID REFERENCES card_purchase_links(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_purchase_prices_link_id
ON purchase_prices(link_id) WHERE link_id IS NOT NULL;

-- 既存データのマイグレーション: shinsoku_item_id → card_purchase_links
INSERT INTO card_purchase_links (card_id, shop_id, external_key, label, condition)
SELECT
  c.id,
  ps.id,
  c.shinsoku_item_id,
  COALESCE(c.shinsoku_condition, 'S'),
  COALESCE(c.shinsoku_condition, 'S')
FROM cards c
CROSS JOIN purchase_shops ps
WHERE c.shinsoku_item_id IS NOT NULL
  AND ps.name = 'シンソク（郵送買取）'
ON CONFLICT DO NOTHING;

-- 既存データのマイグレーション: lounge_card_key → card_purchase_links
INSERT INTO card_purchase_links (card_id, shop_id, external_key, label, condition)
SELECT
  c.id,
  ps.id,
  c.lounge_card_key,
  '素体',
  'normal'
FROM cards c
CROSS JOIN purchase_shops ps
WHERE c.lounge_card_key IS NOT NULL
  AND ps.name = 'トレカラウンジ（郵送買取）'
ON CONFLICT DO NOTHING;

COMMENT ON TABLE card_purchase_links IS '買取紐付けテーブル。1カードに複数の店舗×商品を紐付け可能';
COMMENT ON COLUMN card_purchase_links.external_key IS '外部キー（シンソクitem_id、ラウンジcard_key等）';
COMMENT ON COLUMN card_purchase_links.label IS '表示ラベル（素体、PSA10 等）';
COMMENT ON COLUMN card_purchase_links.condition IS 'purchase_pricesのconditionと対応';
