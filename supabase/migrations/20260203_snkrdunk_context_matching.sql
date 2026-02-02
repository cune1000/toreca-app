-- スニダン売買履歴: 前後取引パターンマッチング対応

-- user_icon_number カラムを追加
ALTER TABLE snkrdunk_sales_history
ADD COLUMN user_icon_number INTEGER;

-- context_fingerprint カラムを追加（前後取引情報）
ALTER TABLE snkrdunk_sales_history
ADD COLUMN context_fingerprint JSONB;

-- 既存のユニーク制約を削除
ALTER TABLE snkrdunk_sales_history
DROP CONSTRAINT IF EXISTS unique_card_grade_sold_seq;

-- 新しいユニーク制約を追加
-- user_icon_number がある場合はそれを使用、ない場合は sequence_number を使用
ALTER TABLE snkrdunk_sales_history
ADD CONSTRAINT unique_card_grade_sold_icon_seq UNIQUE (card_id, grade, sold_at, COALESCE(user_icon_number, -1), sequence_number);

-- インデックスを追加
CREATE INDEX idx_snkrdunk_sales_user_icon ON snkrdunk_sales_history(user_icon_number);
CREATE INDEX idx_snkrdunk_sales_context ON snkrdunk_sales_history USING GIN (context_fingerprint);

-- コメント
COMMENT ON COLUMN snkrdunk_sales_history.user_icon_number IS '購入者アイコン番号（1-20）';
COMMENT ON COLUMN snkrdunk_sales_history.context_fingerprint IS '前後取引情報（重複判定用）';
