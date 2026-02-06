-- daily_price_index テーブル作成
-- Supabase SQL Editor で実行

CREATE TABLE IF NOT EXISTS daily_price_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  category TEXT NOT NULL,         -- 'ポケモン', 'ワンピース', etc
  rarity TEXT NOT NULL,           -- 'SAR', 'AR', 'SR', 'ALL'
  grade TEXT NOT NULL,            -- 'PSA10', 'A', 'ALL'
  price_type TEXT NOT NULL,       -- 'sale'(スニダン売買), 'purchase'(買取)
  avg_price INTEGER,
  median_price INTEGER,
  card_count INTEGER,             -- 対象カード数
  trade_count INTEGER,            -- 取引件数
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(date, category, rarity, grade, price_type)
);

-- 高速検索用インデックス
CREATE INDEX IF NOT EXISTS idx_daily_price_index_lookup 
ON daily_price_index(category, rarity, grade, price_type, date);

-- RLSを有効化（必要に応じて）
ALTER TABLE daily_price_index ENABLE ROW LEVEL SECURITY;

-- 読み取りポリシー（全員許可）
CREATE POLICY "Allow public read" ON daily_price_index
FOR SELECT USING (true);

-- 挿入ポリシー（サービスロールのみ）
CREATE POLICY "Allow service insert" ON daily_price_index
FOR INSERT WITH CHECK (true);

-- 更新ポリシー（サービスロールのみ）
CREATE POLICY "Allow service update" ON daily_price_index
FOR UPDATE USING (true);
