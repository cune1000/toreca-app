-- card_sale_urlsテーブルに自動スクレイピング設定カラムを追加

-- 自動スクレイピングモード
ALTER TABLE card_sale_urls ADD COLUMN IF NOT EXISTS auto_scrape_mode VARCHAR(20) DEFAULT 'off';
-- 'off': 停止, 'auto': オートメーション, 'manual': 手動設定

-- 手動設定時の更新間隔（分）
ALTER TABLE card_sale_urls ADD COLUMN IF NOT EXISTS auto_scrape_interval_minutes INTEGER;

-- 最終スクレイピング時刻
ALTER TABLE card_sale_urls ADD COLUMN IF NOT EXISTS last_scraped_at TIMESTAMPTZ;

-- 最終スクレイピング結果
ALTER TABLE card_sale_urls ADD COLUMN IF NOT EXISTS last_scrape_status VARCHAR(20);
-- 'success', 'error'

-- 最終エラーメッセージ
ALTER TABLE card_sale_urls ADD COLUMN IF NOT EXISTS last_scrape_error TEXT;

-- 次回スクレイピング予定時刻
ALTER TABLE card_sale_urls ADD COLUMN IF NOT EXISTS next_scrape_at TIMESTAMPTZ;

-- インデックス
CREATE INDEX IF NOT EXISTS idx_card_sale_urls_auto_scrape 
ON card_sale_urls(auto_scrape_mode, next_scrape_at) 
WHERE auto_scrape_mode != 'off';

-- コメント
COMMENT ON COLUMN card_sale_urls.auto_scrape_mode IS '自動スクレイピングモード: off, auto, manual';
COMMENT ON COLUMN card_sale_urls.auto_scrape_interval_minutes IS '手動設定時の更新間隔（分）';
COMMENT ON COLUMN card_sale_urls.next_scrape_at IS '次回スクレイピング予定時刻';
