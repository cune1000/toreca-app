-- daily_price_index にsub_category（カテゴリ中＝世代）カラムを追加
-- Supabase SQL Editor で実行

-- 1. カラム追加
ALTER TABLE daily_price_index ADD COLUMN IF NOT EXISTS sub_category TEXT DEFAULT 'ALL';

-- 2. 既存のUNIQUE制約を削除して再作成（sub_categoryを含める）
ALTER TABLE daily_price_index DROP CONSTRAINT IF EXISTS daily_price_index_date_category_rarity_grade_price_type_key;

CREATE UNIQUE INDEX IF NOT EXISTS daily_price_index_unique_v2
ON daily_price_index(date, category, sub_category, rarity, grade, price_type);

-- 3. インデックス更新
DROP INDEX IF EXISTS idx_daily_price_index_lookup;
CREATE INDEX idx_daily_price_index_lookup_v2
ON daily_price_index(category, sub_category, rarity, grade, price_type, date);
