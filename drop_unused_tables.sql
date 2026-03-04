-- 完全に未使用のテーブル（アクセス数: 0）
DROP TABLE IF EXISTS public."scraping_schedules" CASCADE;
DROP TABLE IF EXISTS public."cron_rest_times" CASCADE;
DROP TABLE IF EXISTS public."card_sale_sites" CASCADE;
DROP TABLE IF EXISTS public."price_history" CASCADE;

-- 廃止されたAI画像認識機能のテーブル群
DROP TABLE IF EXISTS public."card_learning_images" CASCADE;
DROP TABLE IF EXISTS public."recognition_queue" CASCADE;
DROP TABLE IF EXISTS public."pending_images" CASCADE;
DROP TABLE IF EXISTS public."recognition_corrections" CASCADE;
DROP TABLE IF EXISTS public."grid_templates" CASCADE;
DROP TABLE IF EXISTS public."pending_cards" CASCADE;

-- ※注意：必ず STAGING（ステージング環境）のSupabaseで実行してください！
