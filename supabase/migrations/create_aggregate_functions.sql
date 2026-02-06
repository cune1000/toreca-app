-- Supabase RPC関数: スニダン売買履歴の集計
-- Supabase SQL Editor で実行

CREATE OR REPLACE FUNCTION aggregate_snkrdunk_sales(target_date DATE)
RETURNS TABLE (
  category TEXT,
  rarity TEXT,
  grade TEXT,
  avg_price NUMERIC,
  median_price NUMERIC,
  card_count BIGINT,
  trade_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cl.name::TEXT as category,
    COALESCE(r.name, 'UNKNOWN')::TEXT as rarity,
    s.grade::TEXT as grade,
    AVG(s.price) as avg_price,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY s.price) as median_price,
    COUNT(DISTINCT c.id) as card_count,
    COUNT(*) as trade_count
  FROM snkrdunk_sales_history s
  JOIN cards c ON c.id = s.card_id
  LEFT JOIN rarities r ON r.id = c.rarity_id
  JOIN category_large cl ON cl.id = c.category_large_id
  WHERE DATE(s.sold_at AT TIME ZONE 'Asia/Tokyo') = target_date
    AND s.grade IN ('PSA10', 'A')  -- PSA10と状態Aのみ
    AND s.price > 0
  GROUP BY cl.name, r.name, s.grade
  HAVING COUNT(*) >= 1;  -- 最低1件以上
END;
$$ LANGUAGE plpgsql;

-- Supabase RPC関数: 買取価格の集計
CREATE OR REPLACE FUNCTION aggregate_purchase_prices(target_date DATE)
RETURNS TABLE (
  category TEXT,
  rarity TEXT,
  avg_price NUMERIC,
  median_price NUMERIC,
  card_count BIGINT,
  trade_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cl.name::TEXT as category,
    COALESCE(r.name, 'UNKNOWN')::TEXT as rarity,
    AVG(pp.price) as avg_price,
    PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY pp.price) as median_price,
    COUNT(DISTINCT c.id) as card_count,
    COUNT(*) as trade_count
  FROM purchase_prices pp
  JOIN cards c ON c.id = pp.card_id
  LEFT JOIN rarities r ON r.id = c.rarity_id
  JOIN category_large cl ON cl.id = c.category_large_id
  WHERE DATE(pp.created_at AT TIME ZONE 'Asia/Tokyo') = target_date
    AND pp.price > 0
  GROUP BY cl.name, r.name
  HAVING COUNT(*) >= 1;
END;
$$ LANGUAGE plpgsql;
