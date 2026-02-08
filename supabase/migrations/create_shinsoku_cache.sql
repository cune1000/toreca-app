-- shinsoku_items: シンソク商品キャッシュテーブル
-- 1日1回APIから全商品を同期し、ローカルで高速検索する

CREATE TABLE IF NOT EXISTS shinsoku_items (
  item_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_processed TEXT,
  type TEXT NOT NULL DEFAULT 'NORMAL',
  brand TEXT NOT NULL DEFAULT 'ポケモン',
  rarity TEXT,
  modelno TEXT,
  image_url TEXT,
  tags JSONB DEFAULT '[]',
  is_full_amount BOOLEAN DEFAULT FALSE,
  price_s INTEGER,
  price_a INTEGER,
  price_am INTEGER,
  price_b INTEGER,
  price_c INTEGER,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);

-- 名前検索用インデックス
CREATE INDEX IF NOT EXISTS idx_shinsoku_items_name
ON shinsoku_items USING gin(name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_shinsoku_items_brand_type
ON shinsoku_items(brand, type);

COMMENT ON TABLE shinsoku_items IS 'シンソク買取API商品のローカルキャッシュ。1日1回同期。';
