-- api_keys テーブル作成
-- Supabase SQL Editor で実行

CREATE TABLE IF NOT EXISTS api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,              -- キーの用途名（'POS連携', '公開サイト' 等）
  key TEXT NOT NULL UNIQUE,        -- APIキー本体 (例: tk_live_xxxxxxxxxxxx)
  is_active BOOLEAN DEFAULT true,  -- 有効/無効
  rate_limit INTEGER DEFAULT 60,   -- リクエスト/分の上限
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ         -- 最終使用日時
);

-- RLS有効化
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- サービスロールのみ読み取り可能
CREATE POLICY "Service role only" ON api_keys
FOR ALL USING (true);

-- 初期APIキーを生成（必要に応じて変更してください）
-- INSERT INTO api_keys (name, key) VALUES ('公開サイト', 'tk_live_' || encode(gen_random_bytes(24), 'hex'));
-- INSERT INTO api_keys (name, key) VALUES ('POS連携', 'tk_live_' || encode(gen_random_bytes(24), 'hex'));
