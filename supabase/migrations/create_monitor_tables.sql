-- =============================================
-- shop_monitor_settings テーブル
-- =============================================
CREATE TABLE IF NOT EXISTS shop_monitor_settings (
    shop_id UUID PRIMARY KEY REFERENCES purchase_shops(id) ON DELETE CASCADE,
    is_active BOOLEAN NOT NULL DEFAULT false,
    quiet_start INTEGER NOT NULL DEFAULT 2,  -- JST時 (深夜2時)
    quiet_end INTEGER NOT NULL DEFAULT 9,    -- JST時 (朝9時)
    last_checked_at TIMESTAMPTZ,
    last_tweet_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- fetched_tweets テーブル
-- =============================================
CREATE TABLE IF NOT EXISTS fetched_tweets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tweet_id TEXT NOT NULL,
    shop_id UUID NOT NULL REFERENCES purchase_shops(id) ON DELETE CASCADE,
    is_purchase_related BOOLEAN NOT NULL DEFAULT false,
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tweet_id, shop_id)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_fetched_tweets_shop ON fetched_tweets(shop_id, fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_fetched_tweets_tweet ON fetched_tweets(tweet_id);
CREATE INDEX IF NOT EXISTS idx_shop_monitor_active ON shop_monitor_settings(is_active) WHERE is_active = true;
