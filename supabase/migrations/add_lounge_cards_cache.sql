-- トレカラウンジ カードキャッシュテーブル
-- Cronで定期的にスクレイピングして全データを保存
CREATE TABLE IF NOT EXISTS lounge_cards_cache (
  id SERIAL PRIMARY KEY,
  product_id TEXT,
  name TEXT NOT NULL,
  modelno TEXT NOT NULL,
  rarity TEXT DEFAULT '',
  grade TEXT DEFAULT '',
  product_format TEXT DEFAULT 'NORMAL',
  price INTEGER NOT NULL DEFAULT 0,
  card_key TEXT NOT NULL UNIQUE,
  image_url TEXT DEFAULT '',
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lounge_cards_cache_key ON lounge_cards_cache(card_key);
CREATE INDEX IF NOT EXISTS idx_lounge_cards_cache_name ON lounge_cards_cache USING gin(to_tsvector('simple', name));
