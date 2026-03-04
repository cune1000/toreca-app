-- Auto-generated schema dump from old Supabase

CREATE TABLE IF NOT EXISTS public."chart_daily_card_prices" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "card_id" uuid NOT NULL,
  "date" date NOT NULL,
  "sale_avg" integer,
  "purchase_avg" integer,
  "sale_count" integer DEFAULT 0,
  "purchase_count" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."rarities" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "large_id" uuid,
  "name" text NOT NULL,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."card_learning_images" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "card_id" uuid,
  "image_url" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."card_purchase_links" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "card_id" uuid NOT NULL,
  "shop_id" uuid NOT NULL,
  "external_key" text NOT NULL,
  "label" text NOT NULL DEFAULT ''::text,
  "condition" text DEFAULT 'normal'::text,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."purchase_prices" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "card_id" uuid,
  "shop_id" uuid,
  "price" integer NOT NULL,
  "source_image_url" text,
  "recognized_at" timestamp with time zone DEFAULT now(),
  "created_at" timestamp with time zone DEFAULT now(),
  "tweet_time" timestamp with time zone,
  "is_psa" boolean DEFAULT false,
  "psa_grade" integer,
  "condition" text DEFAULT 'normal'::text,
  "link_id" uuid
);

CREATE TABLE IF NOT EXISTS public."purchase_shops" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "x_account" text,
  "icon" text,
  "status" text DEFAULT 'active'::text,
  "recognition_rules" jsonb,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."pos_history" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "inventory_id" uuid NOT NULL,
  "action_type" text NOT NULL,
  "quantity_change" integer NOT NULL,
  "quantity_before" integer NOT NULL,
  "quantity_after" integer NOT NULL,
  "transaction_id" uuid,
  "reason" text,
  "notes" text,
  "is_modified" boolean DEFAULT false,
  "modified_at" timestamp with time zone,
  "modified_reason" text,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."card_sale_urls" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "card_id" uuid,
  "site_id" uuid,
  "product_url" text NOT NULL,
  "current_interval" text DEFAULT '1h'::text,
  "next_scrape_at" timestamp with time zone,
  "last_price" integer,
  "last_stock" integer,
  "created_at" timestamp with time zone DEFAULT now(),
  "next_check_at" timestamp with time zone DEFAULT now(),
  "check_interval" integer DEFAULT 30,
  "last_checked_at" timestamp with time zone,
  "error_count" integer DEFAULT 0,
  "last_error" text,
  "no_change_count" integer DEFAULT 0,
  "auto_scrape_mode" character varying(20) DEFAULT 'off'::character varying,
  "auto_scrape_interval_minutes" integer,
  "last_scraped_at" timestamp with time zone,
  "last_scrape_status" character varying(20),
  "last_scrape_error" text,
  "apparel_id" integer
);

CREATE TABLE IF NOT EXISTS public."sale_prices" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "card_id" uuid,
  "site_id" uuid,
  "price" integer NOT NULL,
  "stock" integer,
  "product_url" text,
  "scraped_at" timestamp with time zone DEFAULT now(),
  "created_at" timestamp with time zone DEFAULT now(),
  "grade" text,
  "top_prices" jsonb
);

CREATE TABLE IF NOT EXISTS public."pos_inventory" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "catalog_id" uuid NOT NULL,
  "condition" text NOT NULL DEFAULT 'A'::text,
  "quantity" integer NOT NULL DEFAULT 0,
  "avg_purchase_price" integer DEFAULT 0,
  "total_purchase_cost" integer DEFAULT 0,
  "total_purchased" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "avg_expense_per_unit" integer DEFAULT 0,
  "total_expenses" integer DEFAULT 0,
  "market_price" integer,
  "predicted_price" integer
);

CREATE TABLE IF NOT EXISTS public."scraping_schedules" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "day_of_week" integer NOT NULL,
  "slot" integer NOT NULL,
  "start_time" time without time zone NOT NULL,
  "end_time" time without time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."lounge_known_keys" (
  "card_key" text NOT NULL,
  "name" text,
  "price" integer,
  "first_seen_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."cron_rest_times" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "day_of_week" integer NOT NULL,
  "rest_start_1" time without time zone,
  "rest_end_1" time without time zone,
  "rest_start_2" time without time zone,
  "rest_end_2" time without time zone,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."category_medium" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "large_id" uuid,
  "name" text NOT NULL,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."category_small" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "medium_id" uuid,
  "name" text NOT NULL,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."fetched_tweets" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "tweet_id" text NOT NULL,
  "shop_id" uuid NOT NULL,
  "is_purchase_related" boolean NOT NULL DEFAULT false,
  "is_pinned" boolean NOT NULL DEFAULT false,
  "fetched_at" timestamp with time zone NOT NULL DEFAULT now(),
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."grid_templates" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "shop_id" uuid,
  "vertical_lines" jsonb NOT NULL,
  "horizontal_lines" jsonb NOT NULL,
  "cells" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."lounge_cards_cache" (
  "id" integer NOT NULL DEFAULT nextval('lounge_cards_cache_id_seq'::regclass),
  "product_id" text,
  "name" text NOT NULL,
  "modelno" text NOT NULL,
  "rarity" text DEFAULT ''::text,
  "grade" text DEFAULT ''::text,
  "product_format" text DEFAULT 'NORMAL'::text,
  "price" integer NOT NULL DEFAULT 0,
  "card_key" text NOT NULL,
  "image_url" text DEFAULT ''::text,
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."category_detail" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "small_id" uuid,
  "name" text NOT NULL,
  "pack_code" text,
  "release_date" date,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."sale_sites" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "url" text NOT NULL,
  "icon" text,
  "status" text DEFAULT 'active'::text,
  "created_at" timestamp with time zone DEFAULT now(),
  "site_key" text
);

CREATE TABLE IF NOT EXISTS public."shop_monitor_settings" (
  "shop_id" uuid NOT NULL,
  "is_active" boolean NOT NULL DEFAULT false,
  "quiet_start" integer NOT NULL DEFAULT 2,
  "quiet_end" integer NOT NULL DEFAULT 9,
  "last_checked_at" timestamp with time zone,
  "last_tweet_id" text,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."pos_catalogs" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "image_url" text,
  "category" text,
  "subcategory" text,
  "card_number" text,
  "rarity" text,
  "jan_code" text,
  "source_type" text DEFAULT 'original'::text,
  "api_card_id" uuid,
  "api_linked_at" timestamp with time zone,
  "fixed_price" integer,
  "is_active" boolean DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "tracking_mode" text NOT NULL DEFAULT 'average'::text
);

CREATE TABLE IF NOT EXISTS public."pos_transactions" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "inventory_id" uuid NOT NULL,
  "type" text NOT NULL,
  "quantity" integer NOT NULL,
  "unit_price" integer NOT NULL,
  "total_price" integer NOT NULL,
  "profit" integer,
  "profit_rate" numeric,
  "transaction_date" date NOT NULL DEFAULT CURRENT_DATE,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "expenses" integer DEFAULT 0,
  "is_checkout" boolean NOT NULL DEFAULT false,
  "lot_id" uuid,
  "source_id" uuid
);

CREATE TABLE IF NOT EXISTS public."pos_checkout_items" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "folder_id" uuid NOT NULL,
  "inventory_id" uuid NOT NULL,
  "quantity" integer NOT NULL,
  "unit_cost" integer NOT NULL,
  "unit_expense" integer NOT NULL DEFAULT 0,
  "status" text NOT NULL DEFAULT 'pending'::text,
  "resolved_at" timestamp with time zone,
  "resolution_notes" text,
  "sale_unit_price" integer,
  "sale_expenses" integer,
  "sale_profit" integer,
  "converted_condition" text,
  "converted_expenses" integer,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "transaction_id" uuid,
  "lot_id" uuid
);

CREATE TABLE IF NOT EXISTS public."cron_logs" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "card_sale_url_id" uuid,
  "card_name" text,
  "site_name" text,
  "status" text,
  "old_price" integer,
  "new_price" integer,
  "old_stock" integer,
  "new_stock" integer,
  "price_changed" boolean DEFAULT false,
  "stock_changed" boolean DEFAULT false,
  "error_message" text,
  "executed_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."card_sale_sites" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "card_id" uuid,
  "site_id" uuid,
  "url" text,
  "last_price" integer,
  "last_stock" integer,
  "last_checked_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."price_history" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "card_sale_site_id" uuid,
  "price" integer,
  "stock" integer,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."overseas_prices" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "card_id" uuid,
  "pricecharting_id" text NOT NULL,
  "loose_price_usd" integer,
  "cib_price_usd" integer,
  "new_price_usd" integer,
  "graded_price_usd" integer,
  "exchange_rate" numeric,
  "loose_price_jpy" integer,
  "graded_price_jpy" integer,
  "recorded_at" timestamp with time zone DEFAULT now(),
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."pos_sources" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "type" text NOT NULL DEFAULT 'other'::text,
  "trust_level" text NOT NULL DEFAULT 'unverified'::text,
  "contact_info" text,
  "notes" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."pos_lots" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "lot_number" text NOT NULL,
  "source_id" uuid,
  "inventory_id" uuid NOT NULL,
  "quantity" integer NOT NULL,
  "remaining_qty" integer NOT NULL,
  "unit_cost" integer NOT NULL,
  "expenses" integer NOT NULL DEFAULT 0,
  "unit_expense" integer NOT NULL DEFAULT 0,
  "purchase_date" date NOT NULL,
  "transaction_id" uuid,
  "notes" text,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."cron_schedules" (
  "job_name" text NOT NULL,
  "display_name" text NOT NULL,
  "enabled" boolean NOT NULL DEFAULT true,
  "schedule_type" text NOT NULL,
  "interval_minutes" integer,
  "run_at_hours" ARRAY,
  "run_at_minute" integer DEFAULT 0,
  "last_run_at" timestamp with time zone,
  "last_status" text,
  "last_error" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."shinsoku_items" (
  "item_id" text NOT NULL,
  "name" text NOT NULL,
  "name_processed" text,
  "type" text NOT NULL DEFAULT 'NORMAL'::text,
  "brand" text NOT NULL DEFAULT 'ポケモン'::text,
  "rarity" text,
  "modelno" text,
  "image_url" text,
  "tags" jsonb DEFAULT '[]'::jsonb,
  "is_full_amount" boolean DEFAULT false,
  "price_s" integer,
  "price_a" integer,
  "price_am" integer,
  "price_b" integer,
  "price_c" integer,
  "synced_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."exchange_rates" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "base_currency" text DEFAULT 'USD'::text,
  "target_currency" text DEFAULT 'JPY'::text,
  "rate" numeric,
  "recorded_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."cards" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "rarity_id" uuid,
  "card_number" text,
  "category_large_id" uuid,
  "category_medium_id" uuid,
  "category_small_id" uuid,
  "category_detail_id" uuid,
  "image_url" text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "embedding" ARRAY,
  "rarity" character varying(50),
  "illustrator" character varying(100),
  "expansion" character varying(200),
  "regulation" character varying(20),
  "shinsoku_item_id" text,
  "shinsoku_linked_at" timestamp with time zone,
  "shinsoku_condition" text DEFAULT 'normal'::text,
  "lounge_card_key" text,
  "lounge_linked_at" timestamp with time zone,
  "pricecharting_id" text,
  "pricecharting_name" text,
  "set_code" text,
  "name_en" text,
  "set_name_en" text,
  "release_year" integer,
  "justtcg_id" text,
  "tcgplayer_id" text,
  "pricecharting_url" text,
  "release_date" text,
  "justtcg_nm_price_usd" numeric
);

CREATE TABLE IF NOT EXISTS public."pos_checkout_folders" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "description" text,
  "status" text NOT NULL DEFAULT 'open'::text,
  "created_at" timestamp with time zone DEFAULT now(),
  "updated_at" timestamp with time zone DEFAULT now(),
  "closed_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public."api_keys" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "key" text NOT NULL,
  "is_active" boolean DEFAULT true,
  "rate_limit" integer DEFAULT 60,
  "created_at" timestamp with time zone DEFAULT now(),
  "last_used_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS public."daily_price_index" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "date" date NOT NULL,
  "category" text NOT NULL,
  "rarity" text NOT NULL,
  "grade" text NOT NULL,
  "price_type" text NOT NULL,
  "avg_price" integer,
  "median_price" integer,
  "card_count" integer,
  "trade_count" integer,
  "created_at" timestamp with time zone DEFAULT now(),
  "sub_category" text DEFAULT 'ALL'::text
);

CREATE TABLE IF NOT EXISTS public."snkrdunk_sales_history" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "card_id" uuid NOT NULL,
  "grade" character varying(20) NOT NULL,
  "price" integer NOT NULL,
  "sold_at" timestamp with time zone NOT NULL,
  "scraped_at" timestamp with time zone NOT NULL DEFAULT now(),
  "sequence_number" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now(),
  "user_icon_number" integer,
  "context_fingerprint" jsonb,
  "product_type" character varying(30) DEFAULT 'single'::character varying,
  "size" character varying(20),
  "condition" character varying(30),
  "label" character varying(20)
);

CREATE TABLE IF NOT EXISTS public."recognition_queue" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "shop_id" uuid,
  "original_image_url" text NOT NULL,
  "cropped_image_url" text,
  "recognized_card_id" uuid,
  "recognized_name" text,
  "recognized_price" integer,
  "confidence" integer DEFAULT 0,
  "status" text DEFAULT 'pending'::text,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."pending_images" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "shop_id" uuid NOT NULL,
  "tweet_url" text,
  "tweet_time" timestamp with time zone,
  "image_url" text NOT NULL,
  "image_base64" text,
  "status" text DEFAULT 'pending'::text,
  "created_at" timestamp with time zone DEFAULT now(),
  "processed_at" timestamp with time zone,
  "ai_result" jsonb
);

CREATE TABLE IF NOT EXISTS public."pending_cards" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "pending_image_id" uuid,
  "shop_id" uuid NOT NULL,
  "card_image" text,
  "ocr_text" text,
  "price" integer,
  "matched_card_id" uuid,
  "status" text DEFAULT 'pending'::text,
  "row_index" integer,
  "col_index" integer,
  "tweet_time" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now(),
  "condition" text DEFAULT 'normal'::text,
  "recognized_name" text
);

CREATE TABLE IF NOT EXISTS public."recognition_corrections" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "recognized_name" text NOT NULL,
  "recognized_card_number" text,
  "recognized_rarity" text,
  "corrected_card_id" uuid,
  "corrected_name" text NOT NULL,
  "similarity_score" integer,
  "source_type" text,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."category_large" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "icon" text,
  "sort_order" integer DEFAULT 0,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."justtcg_price_history" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "card_id" uuid NOT NULL,
  "price_usd" numeric NOT NULL,
  "recorded_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public."snkrdunk_items_cache" (
  "apparel_id" integer NOT NULL,
  "name" text NOT NULL,
  "product_number" text,
  "min_price" integer,
  "total_listing_count" integer DEFAULT 0,
  "image_url" text,
  "released_at" timestamp with time zone,
  "synced_at" timestamp with time zone DEFAULT now(),
  "parsed_set_code" text,
  "language" text
);

DO $$ BEGIN
  ALTER TABLE public."category_large" ADD PRIMARY KEY ("id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."category_medium" ADD PRIMARY KEY ("id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."category_small" ADD PRIMARY KEY ("id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."category_detail" ADD PRIMARY KEY ("id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."rarities" ADD PRIMARY KEY ("id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."cards" ADD PRIMARY KEY ("id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."card_learning_images" ADD PRIMARY KEY ("id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."purchase_shops" ADD PRIMARY KEY ("id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."purchase_prices" ADD PRIMARY KEY ("id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."sale_sites" ADD PRIMARY KEY ("id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."card_sale_urls" ADD PRIMARY KEY ("id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."sale_prices" ADD PRIMARY KEY ("id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."fetched_tweets" ADD PRIMARY KEY ("id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."recognition_queue" ADD PRIMARY KEY ("id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."scraping_schedules" ADD PRIMARY KEY ("id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."recognition_corrections" ADD PRIMARY KEY ("id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."grid_templates" ADD PRIMARY KEY ("id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."pending_images" ADD PRIMARY KEY ("id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."pending_cards" ADD PRIMARY KEY ("id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."cron_rest_times" ADD PRIMARY KEY ("id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."cron_logs" ADD PRIMARY KEY ("id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."card_sale_sites" ADD PRIMARY KEY ("id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."price_history" ADD PRIMARY KEY ("id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."snkrdunk_sales_history" ADD PRIMARY KEY ("id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."daily_price_index" ADD PRIMARY KEY ("id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."shop_monitor_settings" ADD PRIMARY KEY ("shop_id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."api_keys" ADD PRIMARY KEY ("id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."chart_daily_card_prices" ADD PRIMARY KEY ("id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."pos_catalogs" ADD PRIMARY KEY ("id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."pos_inventory" ADD PRIMARY KEY ("id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."pos_transactions" ADD PRIMARY KEY ("id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."pos_history" ADD PRIMARY KEY ("id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."shinsoku_items" ADD PRIMARY KEY ("item_id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."card_purchase_links" ADD PRIMARY KEY ("id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."lounge_cards_cache" ADD PRIMARY KEY ("id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."lounge_known_keys" ADD PRIMARY KEY ("card_key");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."overseas_prices" ADD PRIMARY KEY ("id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."exchange_rates" ADD PRIMARY KEY ("id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."pos_checkout_folders" ADD PRIMARY KEY ("id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."pos_checkout_items" ADD PRIMARY KEY ("id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."pos_sources" ADD PRIMARY KEY ("id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."pos_lots" ADD PRIMARY KEY ("id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."cron_schedules" ADD PRIMARY KEY ("job_name");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."justtcg_price_history" ADD PRIMARY KEY ("id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public."snkrdunk_items_cache" ADD PRIMARY KEY ("apparel_id");
EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;

