-- snkrdunk_items_cache に日本語名カラムを追加
-- 既存の name は英語名、localized_name に日本語名を保存

ALTER TABLE snkrdunk_items_cache
  ADD COLUMN IF NOT EXISTS localized_name TEXT;
