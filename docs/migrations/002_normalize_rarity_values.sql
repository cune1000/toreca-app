-- 002_normalize_rarity_values.sql
-- cards.rarity に混在する英語フルネームを日本語短縮名に正規化
--
-- 実行前に SELECT count(*), rarity FROM cards GROUP BY rarity ORDER BY rarity; で現状確認推奨
-- 実行後に同じクエリで正規化結果を確認

BEGIN;

UPDATE cards SET rarity = 'コモン' WHERE rarity = 'Common';
UPDATE cards SET rarity = 'アンコモン' WHERE rarity = 'Uncommon';
UPDATE cards SET rarity = 'R' WHERE rarity IN ('Rare', 'Holo Rare');
UPDATE cards SET rarity = 'RR' WHERE rarity = 'Double Rare';
UPDATE cards SET rarity = 'RRR' WHERE rarity = 'Triple Rare';
UPDATE cards SET rarity = 'SR' WHERE rarity IN ('Secret Rare', 'Super Rare');
UPDATE cards SET rarity = 'UR' WHERE rarity = 'Ultra Rare';
UPDATE cards SET rarity = 'AR' WHERE rarity IN ('Illustration Rare', 'Art Rare');
UPDATE cards SET rarity = 'SAR' WHERE rarity = 'Special Art Rare';
UPDATE cards SET rarity = 'HR' WHERE rarity = 'Hyper Rare';
UPDATE cards SET rarity = 'プロモ' WHERE rarity = 'Promo';
UPDATE cards SET rarity = 'A' WHERE rarity = 'Amazing Rare';
UPDATE cards SET rarity = 'S' WHERE rarity = 'Shiny Rare';
UPDATE cards SET rarity = 'CHR' WHERE rarity IN ('Character Rare', 'Trainer Gallery Rare Holo');
UPDATE cards SET rarity = 'CSR' WHERE rarity = 'Character Super Rare';
UPDATE cards SET rarity = 'ACE' WHERE rarity = 'Ace Spec Rare';
UPDATE cards SET rarity = 'V' WHERE rarity = 'Rare Holo V';
UPDATE cards SET rarity = 'VMAX' WHERE rarity = 'Rare Holo VMAX';
UPDATE cards SET rarity = 'VSTAR' WHERE rarity = 'Rare Holo VSTAR';
UPDATE cards SET rarity = 'GX' WHERE rarity = 'Rare Holo GX';
UPDATE cards SET rarity = 'BREAK' WHERE rarity = 'Rare BREAK';
UPDATE cards SET rarity = 'EX' WHERE rarity = 'Rare Holo EX';
UPDATE cards SET rarity = 'K' WHERE rarity IN ('Radiant Rare', 'Kagayaku');
UPDATE cards SET rarity = 'BWR' WHERE rarity = 'Black White Rare';
UPDATE cards SET rarity = 'SSR' WHERE rarity = 'Shiny Secret Rare';
UPDATE cards SET rarity = 'MUR' WHERE rarity = 'Mega Ultra Rare';
UPDATE cards SET rarity = 'MAR' WHERE rarity = 'Mega Attack Rare';
UPDATE cards SET rarity = '−' WHERE rarity = 'None';

-- daily_price_index テーブルの rarity カラムも同様に正規化
-- （過去の集約データとの整合性を保つため）
UPDATE daily_price_index SET rarity = 'コモン' WHERE rarity = 'Common';
UPDATE daily_price_index SET rarity = 'アンコモン' WHERE rarity = 'Uncommon';
UPDATE daily_price_index SET rarity = 'R' WHERE rarity IN ('Rare', 'Holo Rare');
UPDATE daily_price_index SET rarity = 'RR' WHERE rarity = 'Double Rare';
UPDATE daily_price_index SET rarity = 'RRR' WHERE rarity = 'Triple Rare';
UPDATE daily_price_index SET rarity = 'SR' WHERE rarity IN ('Secret Rare', 'Super Rare');
UPDATE daily_price_index SET rarity = 'UR' WHERE rarity = 'Ultra Rare';
UPDATE daily_price_index SET rarity = 'AR' WHERE rarity IN ('Illustration Rare', 'Art Rare');
UPDATE daily_price_index SET rarity = 'SAR' WHERE rarity = 'Special Art Rare';
UPDATE daily_price_index SET rarity = 'HR' WHERE rarity = 'Hyper Rare';
UPDATE daily_price_index SET rarity = 'プロモ' WHERE rarity = 'Promo';
UPDATE daily_price_index SET rarity = 'A' WHERE rarity = 'Amazing Rare';
UPDATE daily_price_index SET rarity = 'S' WHERE rarity = 'Shiny Rare';
UPDATE daily_price_index SET rarity = 'CHR' WHERE rarity IN ('Character Rare', 'Trainer Gallery Rare Holo');
UPDATE daily_price_index SET rarity = 'CSR' WHERE rarity = 'Character Super Rare';
UPDATE daily_price_index SET rarity = 'K' WHERE rarity IN ('Radiant Rare', 'Kagayaku');
UPDATE daily_price_index SET rarity = 'BWR' WHERE rarity = 'Black White Rare';
UPDATE daily_price_index SET rarity = 'SSR' WHERE rarity = 'Shiny Secret Rare';
UPDATE daily_price_index SET rarity = 'MUR' WHERE rarity = 'Mega Ultra Rare';
UPDATE daily_price_index SET rarity = 'MAR' WHERE rarity = 'Mega Attack Rare';
UPDATE daily_price_index SET rarity = '−' WHERE rarity = 'None';

COMMIT;
