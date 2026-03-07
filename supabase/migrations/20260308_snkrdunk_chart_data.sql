-- スニダン チャートデータ（価格推移グラフ）
-- /sales-chart/used (シングル) / /sales-chart (BOX) のデータを保存

CREATE TABLE IF NOT EXISTS snkrdunk_chart_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  apparel_id INTEGER NOT NULL,
  condition TEXT NOT NULL,        -- 'すべての状態', 'A', 'B', 'PSA10', 'PSA9', '1個' 等
  product_type TEXT NOT NULL,     -- 'single' or 'box'
  date TIMESTAMPTZ NOT NULL,      -- チャートの日付
  price INTEGER NOT NULL,         -- 元の価格
  price_cleaned INTEGER,          -- 異常値補完後の価格
  is_anomaly BOOLEAN DEFAULT false,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(card_id, condition, date)
);

-- パフォーマンス用インデックス
CREATE INDEX IF NOT EXISTS idx_snkrdunk_chart_card_cond
  ON snkrdunk_chart_data(card_id, condition, date);

CREATE INDEX IF NOT EXISTS idx_snkrdunk_chart_apparel
  ON snkrdunk_chart_data(apparel_id);

-- RLS（サービスロールキーのみ書き込み、匿名は読み取り可）
ALTER TABLE snkrdunk_chart_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON snkrdunk_chart_data
  FOR SELECT USING (true);

CREATE POLICY "Allow service role insert/update" ON snkrdunk_chart_data
  FOR ALL USING (true) WITH CHECK (true);
