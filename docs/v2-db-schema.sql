-- ============================================================
-- toreca-app v2 DB — Rev.4 一括作成スクリプト
-- TCG API統合対応
-- ============================================================

-- game_type有効値チェック用関数
CREATE FUNCTION valid_game_types() RETURNS TEXT[] AS $$
  SELECT ARRAY[
    'pokemon-japan',
    'one-piece-card-game'
  ];
$$ LANGUAGE sql IMMUTABLE;

-- 1. sets — セット（収録弾）マスタ
-- PK: JustTCG slug維持（人間可読、運用に有利）
-- TCG API / TCGPlayerのセットIDは別カラムで管理
CREATE TABLE sets (
  id TEXT PRIMARY KEY,                  -- JustTCG set_id slug (例: "sv2a-pokemon-card-151-pokemon-japan")
  game_type TEXT NOT NULL CHECK (game_type = ANY(valid_game_types())),
  series TEXT,                          -- シリーズ識別 (例: "SV", "SM", "M")
  name_en TEXT NOT NULL,                -- 英語セット名
  name_ja TEXT,                         -- 日本語セット名
  release_date DATE,                    -- 発売日
  cards_count INTEGER DEFAULT 0,        -- セット内カード数（参考値）
  tcgapi_set_id TEXT,                   -- TCG API固有セットID (数値文字列: "1900233")
  tcgplayer_set_id TEXT,                -- TCGPlayerセットID
  image_url TEXT,                       -- セット画像URL (TCG API提供)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_sets_tcgapi_set_id ON sets(tcgapi_set_id) WHERE tcgapi_set_id IS NOT NULL;
CREATE UNIQUE INDEX idx_sets_tcgplayer_set_id ON sets(tcgplayer_set_id) WHERE tcgplayer_set_id IS NOT NULL;

-- 2. rarity_mappings — レアリティ表示マッピング
CREATE TABLE rarity_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_type TEXT NOT NULL CHECK (game_type = ANY(valid_game_types())),
  rarity_en TEXT NOT NULL,              -- 英語レアリティ名 (JustTCG/TCG API共通)
  rarity_ja TEXT NOT NULL,              -- 日本語レアリティ名
  short_name TEXT,                      -- 略称 (例: "SAR")
  sort_order INTEGER DEFAULT 0,         -- 表示順 (小さい=レア度高い)
  UNIQUE(game_type, rarity_en)
);

-- 3. cards — カード（カタログ）
-- Rev.4: tcgplayer_id復活、tcgapi_card_id追加、image_source追加
CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_type TEXT NOT NULL CHECK (game_type = ANY(valid_game_types())),
  set_id TEXT REFERENCES sets(id),      -- NULLable（手動追加でセット不明の場合）
  card_name TEXT,                       -- 日本語カード名 (Gemini翻訳 or 手動入力)
  card_name_en TEXT,                    -- 英語カード名 (JustTCG/TCG APIから)
  card_number TEXT,                     -- カード番号 (例: "201/165")
  rarity TEXT,                          -- 英語レアリティ原文。表示はrarity_mappingsでJOIN
  image_url TEXT,                       -- 最良の画像URL (優先: tcgapi > pricecharting > tcgplayer構築)
  image_source TEXT,                    -- 画像ソース ('tcgapi'/'pricecharting'/'tcgplayer'/'manual')
  release_date DATE,                    -- 個別発売日。通常NULLでsets.release_dateを参照
  is_manual BOOLEAN DEFAULT false,      -- true: 手動追加、false: API経由
  memo TEXT,                            -- 管理メモ

  -- 高頻度外部ID（デノーマライズ。JOINなしで参照可能）
  justtcg_id TEXT UNIQUE,               -- JustTCG カードID (slug形式)。差分同期で毎回参照
  tcgplayer_id TEXT,                    -- TCGPlayer商品ID。3ソース共通ユニバーサルキー
  pricecharting_id TEXT,                -- PriceCharting商品ID。画像・海外価格取得
  tcgapi_card_id TEXT,                  -- TCG API固有カードID (数値文字列)

  metadata JSONB DEFAULT '{}',          -- 拡張メタデータ (HP, 技, 弱点等。TCG APIから取得可能)
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cards_game_type ON cards(game_type);
CREATE INDEX idx_cards_set_id ON cards(set_id);
CREATE INDEX idx_cards_rarity ON cards(rarity);
CREATE INDEX idx_cards_card_name ON cards(card_name);
CREATE INDEX idx_cards_pricecharting_id ON cards(pricecharting_id) WHERE pricecharting_id IS NOT NULL;
CREATE UNIQUE INDEX idx_cards_tcgplayer_id ON cards(tcgplayer_id) WHERE tcgplayer_id IS NOT NULL;
CREATE UNIQUE INDEX idx_cards_tcgapi_card_id ON cards(tcgapi_card_id) WHERE tcgapi_card_id IS NOT NULL;

-- 4. card_search_terms — 検索ワード・通称
CREATE TABLE card_search_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  term TEXT NOT NULL,                   -- "かいりきリザードン", "エラー リザードン" etc.
  type TEXT DEFAULT 'alias',            -- 'alias'(通称) / 'mercari' / 'pos' / 'search'
  sort_order INTEGER DEFAULT 0,
  UNIQUE(card_id, term)
);

CREATE INDEX idx_search_terms_term ON card_search_terms(term);
CREATE INDEX idx_search_terms_card_id ON card_search_terms(card_id);

-- 5. card_external_ids — 外部サービス紐付け（低頻度ソース専用）
-- 高頻度ID (justtcg/tcgplayer/pricecharting/tcgapi) はcardsテーブルに直接保持。
-- ここには snkrdunk / shinsoku / toreca_lounge 等の低頻度ソースのみ格納。
CREATE TABLE card_external_ids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  source TEXT NOT NULL,                 -- 'snkrdunk' / 'shinsoku' / 'toreca_lounge' 等
  external_id TEXT NOT NULL,
  external_name TEXT,                   -- 外部サービスでのカード名（参考用）
  match_method TEXT DEFAULT 'manual',   -- 'manual' / 'auto' / 'ai'
  matched_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source, external_id)
);

CREATE INDEX idx_external_ids_card_id ON card_external_ids(card_id);
CREATE INDEX idx_external_ids_source ON card_external_ids(source, external_id);

-- 6. prices — 販売価格データ（統合テーブル）
CREATE TABLE prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  source TEXT NOT NULL,                 -- 'justtcg'/'tcgapi'/'pricecharting'/'mercari'/'yahoo_auction'/'snkrdunk'
  source_item_id TEXT,                  -- ソース側の商品ID (重複防止用)
  price NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'JPY', -- 'JPY' / 'USD'
  condition TEXT,                       -- 'NM'/'LP'/'MP'/'HP'/'Damaged' / NULL (tcgapiはNULL)
  printing TEXT,                        -- 印刷バリアント (1st Edition, Holofoil等)
  title TEXT,                           -- 商品タイトル (メルカリ/ヤフオク: ノイズ検出用)
  thumbnail_url TEXT,                   -- サムネイル画像URL (メルカリ/ヤフオク: ノイズ弾き用)
  listing_url TEXT,                     -- 元サイトの商品ページURL
  sold_at TIMESTAMPTZ,                  -- 売買成立日 (メルカリ/ヤフオク)
  fetched_at TIMESTAMPTZ NOT NULL,      -- データ取得日時
  is_excluded BOOLEAN DEFAULT false,    -- ノイズ除外フラグ
  exclude_reason TEXT,                  -- 除外理由 ('manual'/'pattern:セット'/'ai:bundle_detected')
  raw_data JSONB                        -- ソース固有の全データ完全保管
);

CREATE INDEX idx_prices_card_id ON prices(card_id);
CREATE INDEX idx_prices_source ON prices(source);
CREATE INDEX idx_prices_fetched_at ON prices(fetched_at);
CREATE INDEX idx_prices_card_source_date ON prices(card_id, source, fetched_at DESC);
CREATE INDEX idx_prices_excluded ON prices(card_id, source, is_excluded);
CREATE UNIQUE INDEX idx_prices_source_item ON prices(source, source_item_id) WHERE source_item_id IS NOT NULL;

-- 7. daily_price_stats — 日別価格集計（チャート表示用）
CREATE TABLE daily_price_stats (
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  date DATE NOT NULL,
  min_price NUMERIC NOT NULL,
  max_price NUMERIC NOT NULL,
  avg_price NUMERIC NOT NULL,
  median_price NUMERIC,                 -- 中央値（外れ値に強い）
  count INTEGER NOT NULL,               -- 取引件数
  PRIMARY KEY (card_id, source, date)
);

CREATE INDEX idx_daily_stats_card ON daily_price_stats(card_id);
CREATE INDEX idx_daily_stats_date ON daily_price_stats(date);

-- 8. buyback_prices — 買取価格データ
CREATE TABLE buyback_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  source TEXT NOT NULL,                 -- 'shinsoku' / 'toreca_lounge'
  price NUMERIC NOT NULL,
  condition TEXT,                       -- '素体' / 'PSA10' etc.
  fetched_at TIMESTAMPTZ NOT NULL,
  raw_data JSONB
);

CREATE INDEX idx_buyback_card_id ON buyback_prices(card_id);
CREATE INDEX idx_buyback_source ON buyback_prices(source);
CREATE INDEX idx_buyback_fetched_at ON buyback_prices(fetched_at);
CREATE INDEX idx_buyback_card_source_date ON buyback_prices(card_id, source, fetched_at DESC);

-- 9. exchange_rates — 為替レート
CREATE TABLE exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency TEXT NOT NULL DEFAULT 'USD',
  target_currency TEXT NOT NULL DEFAULT 'JPY',
  rate NUMERIC NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

-- 10. cron_jobs — 定期実行設定
CREATE TABLE cron_jobs (
  job_name TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  interval_hours NUMERIC NOT NULL DEFAULT 24,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 11. cron_logs — 実行ログ
CREATE TABLE cron_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  status TEXT NOT NULL,                 -- 'started' / 'success' / 'error'
  started_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ,
  details JSONB
);

CREATE INDEX idx_cron_logs_job ON cron_logs(job_name, started_at DESC);

-- ============================================================
-- 初期データ
-- ============================================================

-- レアリティマッピング（Pokemon Japan）
INSERT INTO rarity_mappings (game_type, rarity_en, rarity_ja, short_name, sort_order) VALUES
  ('pokemon-japan', 'Special Art Rare',       'スペシャルアートレア',         'SAR',   1),
  ('pokemon-japan', 'Ultra Rare',             'ウルトラレア',               'UR',    2),
  ('pokemon-japan', 'Art Rare',               'アートレア',                 'AR',    3),
  ('pokemon-japan', 'Super Rare',             'スーパーレア',               'SR',    4),
  ('pokemon-japan', 'Double Rare',            'ダブルレア',                 'RR',    5),
  ('pokemon-japan', 'Triple Rare',            'トリプルレア',               'RRR',   6),
  ('pokemon-japan', 'Hyper Rare',             'ハイパーレア',               'HR',    7),
  ('pokemon-japan', 'Illustration Rare',      'イラストレア',               'AR',    8),
  ('pokemon-japan', 'Rare',                   'レア',                      'R',     9),
  ('pokemon-japan', 'Holo Rare',              'ホロレア',                   'R',    10),
  ('pokemon-japan', 'Uncommon',               'アンコモン',                 'U',    11),
  ('pokemon-japan', 'Common',                 'コモン',                    'C',    12),
  ('pokemon-japan', 'Promo',                  'プロモ',                    'PR',   13),
  ('pokemon-japan', 'Amazing Rare',           'アメイジングレア',            'A',    14),
  ('pokemon-japan', 'Shiny Rare',             'シャイニーレア',              'S',    15),
  ('pokemon-japan', 'Character Rare',         'キャラクターレア',            'CHR',  16),
  ('pokemon-japan', 'Character Super Rare',   'キャラクタースーパーレア',      'CSR',  17),
  ('pokemon-japan', 'Ace Spec Rare',          'エーススペックレア',           'ACE',  18),
  ('pokemon-japan', 'Rare Holo V',            'V',                         'V',    19),
  ('pokemon-japan', 'Rare Holo VMAX',         'VMAX',                      'VMAX', 20),
  ('pokemon-japan', 'Rare Holo VSTAR',        'VSTAR',                     'VSTAR',21),
  ('pokemon-japan', 'Rare Holo GX',           'GX',                        'GX',   22),
  ('pokemon-japan', 'Rare BREAK',             'BREAK',                     'BREAK',23),
  ('pokemon-japan', 'Rare Holo EX',           'EX',                        'EX',   24),
  ('pokemon-japan', 'Radiant Rare',           'かがやくポケモン',            'K',    25),
  ('pokemon-japan', 'Secret Rare',            'シークレットレア',            'SR',   26),
  ('pokemon-japan', 'Trainer Gallery Rare Holo', 'トレーナーギャラリー',      'CHR',  27),
  ('pokemon-japan', 'None',                   'なし',                      '-',    99);

-- レアリティマッピング（One Piece）
INSERT INTO rarity_mappings (game_type, rarity_en, rarity_ja, short_name, sort_order) VALUES
  ('one-piece-card-game', 'Secret Rare',  'シークレットレア',  'SEC', 1),
  ('one-piece-card-game', 'Super Rare',   'スーパーレア',      'SR',  2),
  ('one-piece-card-game', 'Rare',         'レア',             'R',   3),
  ('one-piece-card-game', 'Promo',        'プロモ',           'P',   4),
  ('one-piece-card-game', 'Uncommon',     'アンコモン',        'U',   5),
  ('one-piece-card-game', 'Common',       'コモン',           'C',   6),
  ('one-piece-card-game', 'None',         'なし',             '-',   7);
