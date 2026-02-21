-- pos_transactions に is_checkout フラグを追加
-- チェックアウト由来の取引を recalculateInventory で正しく扱うため
ALTER TABLE pos_transactions
  ADD COLUMN IF NOT EXISTS is_checkout BOOLEAN NOT NULL DEFAULT false;

-- 既存の checkout 由来取引を特定してフラグを立てる
-- pos_checkout_items.transaction_id で正確に特定
UPDATE pos_transactions t
SET is_checkout = true
WHERE EXISTS (
  SELECT 1 FROM pos_checkout_items ci
  WHERE ci.transaction_id = t.id
);

-- recalculateInventory のパフォーマンス用インデックス
CREATE INDEX IF NOT EXISTS idx_pos_transactions_inventory_checkout
  ON pos_transactions(inventory_id, is_checkout);
