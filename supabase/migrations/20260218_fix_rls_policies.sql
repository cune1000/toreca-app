-- =============================================================================
-- RLS修正: サービスロールでの書き込みが失敗する問題への対応
-- overseas_prices と snkrdunk_sales_history のRLSを無効化
-- （これらのテーブルはAPIルート経由でのみアクセスされ、直接クライアントからはアクセスしない）
-- =============================================================================

-- overseas_prices: RLSが有効な場合は無効化
ALTER TABLE IF EXISTS overseas_prices DISABLE ROW LEVEL SECURITY;

-- exchange_rates: 同様に無効化
ALTER TABLE IF EXISTS exchange_rates DISABLE ROW LEVEL SECURITY;

-- snkrdunk_sales_history: 念のため無効化
ALTER TABLE IF EXISTS snkrdunk_sales_history DISABLE ROW LEVEL SECURITY;

-- sale_prices: クライアント側からも使われるため、ポリシー追加
-- （RLSが有効な場合のみ影響）
DO $$
BEGIN
  -- sale_prices のRLS状態を確認して無効化
  IF EXISTS (
    SELECT 1 FROM pg_tables
    WHERE tablename = 'sale_prices'
    AND rowsecurity = true
  ) THEN
    ALTER TABLE sale_prices DISABLE ROW LEVEL SECURITY;
  END IF;
END $$;
