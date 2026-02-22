-- cardsテーブルにJustTCG連携カラムを追加
ALTER TABLE cards
ADD COLUMN IF NOT EXISTS name_en TEXT,
ADD COLUMN IF NOT EXISTS set_name_en TEXT,
ADD COLUMN IF NOT EXISTS release_year INTEGER,
ADD COLUMN IF NOT EXISTS justtcg_id TEXT,
ADD COLUMN IF NOT EXISTS tcgplayer_id TEXT,
ADD COLUMN IF NOT EXISTS pricecharting_url TEXT;

-- インデックス
CREATE INDEX IF NOT EXISTS idx_cards_justtcg_id
ON cards(justtcg_id)
WHERE justtcg_id IS NOT NULL;

-- コメント
COMMENT ON COLUMN cards.name_en IS 'カード英語名（PSA申込書用）';
COMMENT ON COLUMN cards.set_name_en IS 'セット英語名（PSA申込書用）';
COMMENT ON COLUMN cards.release_year IS 'セットの発売年';
COMMENT ON COLUMN cards.justtcg_id IS 'JustTCG API のカードID';
COMMENT ON COLUMN cards.tcgplayer_id IS 'TCGPlayer の商品ID';
COMMENT ON COLUMN cards.pricecharting_url IS 'PriceCharting 商品ページURL';
