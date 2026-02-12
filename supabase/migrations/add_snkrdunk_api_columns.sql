-- スニダン API移行用のカラム追加

-- card_sale_urls に apparel_id カラム追加（URLから抽出した数値IDを保存）
ALTER TABLE card_sale_urls ADD COLUMN apparel_id INTEGER;

-- snkrdunk_sales_history にBOX対応用カラム追加
ALTER TABLE snkrdunk_sales_history
  ADD COLUMN product_type VARCHAR(30) DEFAULT 'single',  -- 'single' or 'box'
  ADD COLUMN size VARCHAR(20),       -- BOX: "1個", "2個" etc
  ADD COLUMN condition VARCHAR(30),  -- シングル: "PSA10", "A" etc (APIのconditionフィールド)
  ADD COLUMN label VARCHAR(20);      -- "中古" etc (APIのlabelフィールド)

COMMENT ON COLUMN card_sale_urls.apparel_id IS 'スニダン商品ID（URLから抽出）';
COMMENT ON COLUMN snkrdunk_sales_history.product_type IS '商品タイプ: single=シングルカード, box=BOX・パック';
COMMENT ON COLUMN snkrdunk_sales_history.size IS 'BOXの場合の数量表示（1個, 2個 etc）';
COMMENT ON COLUMN snkrdunk_sales_history.condition IS '商品状態（PSA10, A, B等）';
COMMENT ON COLUMN snkrdunk_sales_history.label IS 'ラベル（中古 等）';
