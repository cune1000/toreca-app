-- sale_prices テーブルに grade カラムを追加
-- グレード別の最安値を記録するため（PSA10, A, BOX など）
ALTER TABLE sale_prices ADD COLUMN IF NOT EXISTS grade TEXT;

-- インデックス追加（card_id + grade での検索を高速化）
CREATE INDEX IF NOT EXISTS idx_sale_prices_card_grade ON sale_prices(card_id, grade);
