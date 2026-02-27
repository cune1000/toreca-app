-- ============================================================
-- toreca-app v2 DB — 一括作成スクリプト
-- ============================================================

-- game_type有効値チェック用関数
CREATE FUNCTION valid_game_types() RETURNS TEXT[] AS $$
  SELECT ARRAY[
    'pokemon-japan',
    'one-piece-card-game'
  ];
$$ LANGUAGE sql IMMUTABLE;

-- 1. sets
CREATE TABLE sets (
  id TEXT PRIMARY KEY,
  game_type TEXT NOT NULL CHECK (game_type = ANY(valid_game_types())),
  series TEXT,
  name_en TEXT NOT NULL,
  name_ja TEXT,
  release_date DATE,
  cards_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. rarity_mappings
CREATE TABLE rarity_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_type TEXT NOT NULL CHECK (game_type = ANY(valid_game_types())),
  rarity_en TEXT NOT NULL,
  rarity_ja TEXT NOT NULL,
  short_name TEXT,
  sort_order INTEGER DEFAULT 0,
  UNIQUE(game_type, rarity_en)
);

-- 3. cards
CREATE TABLE cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_type TEXT NOT NULL CHECK (game_type = ANY(valid_game_types())),
  set_id TEXT REFERENCES sets(id),
  card_name TEXT,
  card_name_en TEXT,
  card_number TEXT,
  rarity TEXT,
  image_url TEXT,
  release_date DATE,
  is_manual BOOLEAN DEFAULT false,
  memo TEXT,
  justtcg_id TEXT UNIQUE,
  pricecharting_id TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_cards_game_type ON cards(game_type);
CREATE INDEX idx_cards_set_id ON cards(set_id);
CREATE INDEX idx_cards_rarity ON cards(rarity);
CREATE INDEX idx_cards_card_name ON cards(card_name);
CREATE INDEX idx_cards_pricecharting_id ON cards(pricecharting_id);

-- 4. card_search_terms
CREATE TABLE card_search_terms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  term TEXT NOT NULL,
  type TEXT DEFAULT 'alias',
  sort_order INTEGER DEFAULT 0,
  UNIQUE(card_id, term)
);

CREATE INDEX idx_search_terms_term ON card_search_terms(term);
CREATE INDEX idx_search_terms_card_id ON card_search_terms(card_id);

-- 5. card_external_ids
CREATE TABLE card_external_ids (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  external_name TEXT,
  match_method TEXT DEFAULT 'manual',
  matched_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(source, external_id)
);

CREATE INDEX idx_external_ids_card_id ON card_external_ids(card_id);
CREATE INDEX idx_external_ids_source ON card_external_ids(source, external_id);

-- 6. prices
CREATE TABLE prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  source_item_id TEXT,
  price NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'JPY',
  condition TEXT,
  printing TEXT,
  title TEXT,
  thumbnail_url TEXT,
  listing_url TEXT,
  sold_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ NOT NULL,
  is_excluded BOOLEAN DEFAULT false,
  exclude_reason TEXT,
  raw_data JSONB
);

CREATE INDEX idx_prices_card_id ON prices(card_id);
CREATE INDEX idx_prices_source ON prices(source);
CREATE INDEX idx_prices_fetched_at ON prices(fetched_at);
CREATE INDEX idx_prices_card_source_date ON prices(card_id, source, fetched_at DESC);
CREATE INDEX idx_prices_excluded ON prices(card_id, source, is_excluded);
CREATE UNIQUE INDEX idx_prices_source_item ON prices(source, source_item_id) WHERE source_item_id IS NOT NULL;

-- 7. daily_price_stats
CREATE TABLE daily_price_stats (
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  date DATE NOT NULL,
  min_price NUMERIC NOT NULL,
  max_price NUMERIC NOT NULL,
  avg_price NUMERIC NOT NULL,
  median_price NUMERIC,
  count INTEGER NOT NULL,
  PRIMARY KEY (card_id, source, date)
);

CREATE INDEX idx_daily_stats_card ON daily_price_stats(card_id);
CREATE INDEX idx_daily_stats_date ON daily_price_stats(date);

-- 8. buyback_prices
CREATE TABLE buyback_prices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  price NUMERIC NOT NULL,
  condition TEXT,
  fetched_at TIMESTAMPTZ NOT NULL,
  raw_data JSONB
);

CREATE INDEX idx_buyback_card_id ON buyback_prices(card_id);
CREATE INDEX idx_buyback_source ON buyback_prices(source);
CREATE INDEX idx_buyback_fetched_at ON buyback_prices(fetched_at);
CREATE INDEX idx_buyback_card_source_date ON buyback_prices(card_id, source, fetched_at DESC);

-- 9. exchange_rates
CREATE TABLE exchange_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_currency TEXT NOT NULL DEFAULT 'USD',
  target_currency TEXT NOT NULL DEFAULT 'JPY',
  rate NUMERIC NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT now()
);

-- 10. cron_jobs
CREATE TABLE cron_jobs (
  job_name TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  interval_hours NUMERIC NOT NULL DEFAULT 24,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 11. cron_logs
CREATE TABLE cron_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_name TEXT NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  finished_at TIMESTAMPTZ,
  details JSONB
);

CREATE INDEX idx_cron_logs_job ON cron_logs(job_name, started_at DESC);

-- ============================================================
-- 初期データ
-- ============================================================

-- レアリティマッピング（Pokemon Japan）
-- register route の RARITY_EN_TO_JA と同期
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
