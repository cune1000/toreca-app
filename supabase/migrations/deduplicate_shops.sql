-- 重複ショップの統合・クリーンアップ
-- 各shop_nameの最小IDを正規IDとし、card_purchase_linksの参照を統合後、重複を削除

-- 1. card_purchase_linksのshop_idを、同名ショップの最小IDに更新
UPDATE card_purchase_links cpl
SET shop_id = (
    SELECT MIN(ps2.id) 
    FROM purchase_shops ps2 
    WHERE ps2.name = (
        SELECT ps3.name 
        FROM purchase_shops ps3 
        WHERE ps3.id = cpl.shop_id
    )
)
WHERE EXISTS (
    SELECT 1 
    FROM purchase_shops ps 
    WHERE ps.id = cpl.shop_id 
    AND ps.id != (
        SELECT MIN(ps4.id) 
        FROM purchase_shops ps4 
        WHERE ps4.name = ps.name
    )
);

-- 2. 重複ショップを削除（各名前の最小IDだけ残す）
DELETE FROM purchase_shops ps
WHERE ps.id NOT IN (
    SELECT MIN(ps2.id)
    FROM purchase_shops ps2
    GROUP BY ps2.name
);

-- 3. 残っているショップを確認
SELECT id, name, status FROM purchase_shops ORDER BY name;
