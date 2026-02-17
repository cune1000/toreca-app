-- =============================================================================
-- PriceCharting連携: Phase 1 マイグレーション
-- =============================================================================

-- 1. cards テーブルにPriceCharting関連カラム追加
ALTER TABLE cards ADD COLUMN IF NOT EXISTS pricecharting_id TEXT NULL;
ALTER TABLE cards ADD COLUMN IF NOT EXISTS pricecharting_name TEXT NULL;

-- 2. overseas_prices テーブル（海外価格履歴）
CREATE TABLE IF NOT EXISTS overseas_prices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID REFERENCES cards(id) ON DELETE CASCADE,
  pricecharting_id TEXT NOT NULL,
  loose_price_usd INTEGER,       -- ペニー単位（例: $17.32 → 1732）
  cib_price_usd INTEGER,
  new_price_usd INTEGER,
  graded_price_usd INTEGER,
  exchange_rate DECIMAL(10,4),    -- USD/JPY レート
  loose_price_jpy INTEGER,        -- 円換算
  graded_price_jpy INTEGER,       -- 円換算
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_overseas_prices_card_id ON overseas_prices(card_id);
CREATE INDEX IF NOT EXISTS idx_overseas_prices_recorded_at ON overseas_prices(recorded_at);

-- 3. exchange_rates テーブル（為替レート履歴）
CREATE TABLE IF NOT EXISTS exchange_rates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  base_currency TEXT DEFAULT 'USD',
  target_currency TEXT DEFAULT 'JPY',
  rate DECIMAL(10,4),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);
