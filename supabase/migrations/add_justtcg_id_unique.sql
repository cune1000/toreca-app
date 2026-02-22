-- justtcg_id のUNIQUE制約追加（重複登録のレースコンディション防止）
-- 既存のINDEXがある場合はDROP後にUNIQUE INDEXとして再作成
DO $$
BEGIN
  -- 既存の非UNIQUEインデックスを削除（存在する場合のみ）
  IF EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_cards_justtcg_id'
  ) THEN
    DROP INDEX idx_cards_justtcg_id;
  END IF;
END $$;

-- UNIQUE制約を追加（NULLは複数許可 — justtcg_id未設定のカードが既存）
CREATE UNIQUE INDEX IF NOT EXISTS idx_cards_justtcg_id_unique
  ON cards (justtcg_id)
  WHERE justtcg_id IS NOT NULL;
