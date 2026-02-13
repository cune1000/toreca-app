-- 新商品検知用のカラム・テーブル追加

-- ① shinsoku_items に first_seen_at カラム追加
-- upsert(onConflict: 'item_id') で既存行のfirst_seen_atは更新されない
ALTER TABLE shinsoku_items
ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ DEFAULT NOW();

-- 既存データのfirst_seen_atをsynced_atで埋める
UPDATE shinsoku_items
SET first_seen_at = synced_at
WHERE first_seen_at IS NULL;

-- インデックス（新着検索用）
CREATE INDEX IF NOT EXISTS idx_shinsoku_items_first_seen
ON shinsoku_items(first_seen_at DESC);

-- ② lounge_known_keys: トレカラウンジの既知商品キーを記録
-- lounge_cards_cacheは毎回DELETEされるため、初出現日を別テーブルで管理
CREATE TABLE IF NOT EXISTS lounge_known_keys (
  card_key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price INTEGER DEFAULT 0,
  rarity TEXT DEFAULT '',
  grade TEXT DEFAULT '',
  first_seen_at TIMESTAMPTZ DEFAULT NOW()
);

-- インデックス（新着検索用）
CREATE INDEX IF NOT EXISTS idx_lounge_known_keys_first_seen
ON lounge_known_keys(first_seen_at DESC);

COMMENT ON TABLE lounge_known_keys IS 'トレカラウンジの既知商品キー。初出現日を記録して新商品検知に使用。';
