-- justtcg_price_history: RLSが有効でanon keyからSELECTできない問題を修正
-- cronはservice roleで書き込むが、フロントはanon keyで読み取るため
ALTER TABLE IF EXISTS justtcg_price_history DISABLE ROW LEVEL SECURITY;
