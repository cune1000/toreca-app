-- Phase 1: ロット管理（仕入先トレーサビリティ）
-- 仕入先マスタ + ロットテーブル + 既存テーブル拡張

-- =============================================================================
-- 1. 仕入先マスタ
-- =============================================================================
CREATE TABLE IF NOT EXISTS pos_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'other',             -- 'wholesale' | 'individual' | 'event' | 'other'
  trust_level TEXT NOT NULL DEFAULT 'unverified',  -- 'trusted' | 'unverified'
  contact_info TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 2. ロット（仕入れバッチ）
-- =============================================================================
CREATE TABLE IF NOT EXISTS pos_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lot_number TEXT NOT NULL UNIQUE,
  source_id UUID REFERENCES pos_sources(id),
  inventory_id UUID NOT NULL REFERENCES pos_inventory(id),
  quantity INT NOT NULL,
  remaining_qty INT NOT NULL,
  unit_cost INT NOT NULL,
  expenses INT NOT NULL DEFAULT 0,
  unit_expense INT NOT NULL DEFAULT 0,
  purchase_date DATE NOT NULL,
  transaction_id UUID REFERENCES pos_transactions(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- 3. 既存テーブル拡張
-- =============================================================================

-- カタログにトラッキングモード追加
ALTER TABLE pos_catalogs
  ADD COLUMN IF NOT EXISTS tracking_mode TEXT NOT NULL DEFAULT 'average';

-- 取引にロット・仕入先参照追加
ALTER TABLE pos_transactions
  ADD COLUMN IF NOT EXISTS lot_id UUID REFERENCES pos_lots(id),
  ADD COLUMN IF NOT EXISTS source_id UUID REFERENCES pos_sources(id);

-- チェックアウトアイテムにロット参照追加
ALTER TABLE pos_checkout_items
  ADD COLUMN IF NOT EXISTS lot_id UUID REFERENCES pos_lots(id);

-- =============================================================================
-- 4. インデックス
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_pos_lots_inventory ON pos_lots(inventory_id);
CREATE INDEX IF NOT EXISTS idx_pos_lots_remaining ON pos_lots(inventory_id) WHERE remaining_qty > 0;
CREATE INDEX IF NOT EXISTS idx_pos_lots_source ON pos_lots(source_id);
CREATE INDEX IF NOT EXISTS idx_pos_transactions_lot ON pos_transactions(lot_id);

-- =============================================================================
-- 5. RLS ポリシー
-- =============================================================================
ALTER TABLE pos_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_lots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pos_sources_all" ON pos_sources FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "pos_lots_all" ON pos_lots FOR ALL USING (true) WITH CHECK (true);
