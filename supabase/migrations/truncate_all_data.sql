-- ===================================
-- 全データ消去SQL（テーブル構造は維持）
-- api_keys テーブルのデータは保持
-- Supabase SQL Editor で実行してください
-- ===================================

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN 
    SELECT unnest(ARRAY[
      'daily_price_index',
      'snkrdunk_sales_history',
      'sale_prices',
      'card_sale_urls',
      'sale_sites',
      'purchase_prices',
      'purchase_shops',
      'pending_images',
      'fetched_tweets',
      'shop_monitor_settings',
      'cards',
      'category_small',
      'category_medium',
      'category_large',
      'rarities',
      'grid_templates',
      'recognition_corrections',
      'cron_logs',
      'auto_scrape_config'
    ])
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tbl AND table_schema = 'public') THEN
      EXECUTE format('TRUNCATE TABLE %I CASCADE', tbl);
      RAISE NOTICE 'Truncated: %', tbl;
    ELSE
      RAISE NOTICE 'Skipped (not found): %', tbl;
    END IF;
  END LOOP;
END $$;

-- 確認
SELECT 'cards' as table_name, count(*) from cards
UNION ALL SELECT 'category_large', count(*) from category_large
UNION ALL SELECT 'rarities', count(*) from rarities
UNION ALL SELECT 'purchase_prices', count(*) from purchase_prices
UNION ALL SELECT 'api_keys (保持)', count(*) from api_keys;
