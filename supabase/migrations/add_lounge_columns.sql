-- cardsテーブルにトレカラウンジ連携カラムを追加
ALTER TABLE cards
ADD COLUMN IF NOT EXISTS lounge_card_key TEXT,
ADD COLUMN IF NOT EXISTS lounge_linked_at TIMESTAMPTZ;

-- インデックス
CREATE INDEX IF NOT EXISTS idx_cards_lounge_card_key
ON cards(lounge_card_key)
WHERE lounge_card_key IS NOT NULL;

-- コメント
COMMENT ON COLUMN cards.lounge_card_key IS 'トレカラウンジの一意キー（"カード名::型番" 例: "リーリエ::397/SM-P"）';
COMMENT ON COLUMN cards.lounge_linked_at IS 'トレカラウンジと紐付けた日時';

-- purchase_shopsにトレカラウンジを登録
INSERT INTO purchase_shops (name, status)
VALUES (
  'トレカラウンジ（郵送買取）',
  'active'
)
ON CONFLICT DO NOTHING;
