-- スニダン売買履歴テーブル
CREATE TABLE snkrdunk_sales_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  
  -- グレード情報
  grade VARCHAR(20) NOT NULL,
  
  -- 価格情報
  price INTEGER NOT NULL,
  
  -- 時間情報
  sold_at TIMESTAMPTZ NOT NULL,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- 順序情報（同じ時刻・同じグレード・同じ価格の複数売却に対応）
  sequence_number INTEGER NOT NULL DEFAULT 0,
  
  -- メタデータ
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- 一意性制約（同じカード・グレード・時刻・順序番号の組み合わせは1つのみ）
  CONSTRAINT unique_card_grade_sold_seq UNIQUE (card_id, grade, sold_at, sequence_number)
);

-- インデックス（検索パフォーマンス向上）
CREATE INDEX idx_snkrdunk_sales_card_id ON snkrdunk_sales_history(card_id);
CREATE INDEX idx_snkrdunk_sales_sold_at ON snkrdunk_sales_history(sold_at DESC);
CREATE INDEX idx_snkrdunk_sales_grade ON snkrdunk_sales_history(grade);
CREATE INDEX idx_snkrdunk_sales_card_grade ON snkrdunk_sales_history(card_id, grade);

-- コメント
COMMENT ON TABLE snkrdunk_sales_history IS 'スニーカーダンクの売買履歴（グレード別）';
COMMENT ON COLUMN snkrdunk_sales_history.grade IS 'グレード: PSA10, PSA9, A, B, C など';
COMMENT ON COLUMN snkrdunk_sales_history.sequence_number IS '同じ時刻・グレード・価格の複数売却を区別するための連番';
COMMENT ON COLUMN snkrdunk_sales_history.sold_at IS '売却時刻（相対時間から計算）';
COMMENT ON COLUMN snkrdunk_sales_history.scraped_at IS 'スクレイピング実行時刻';
