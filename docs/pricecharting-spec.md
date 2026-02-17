# PriceCharting API 連携仕様書

toreca-app に海外価格データ（PriceCharting）を統合するための仕様。

## 背景

- 日本のカード名と英語のカード名は直訳できない
- 日英でカード番号体系も異なる
- **手動でPriceChartingのURL/IDをカードに紐付ける方式を採用**
- 一度紐付ければ、以降は定期自動更新

---

## PriceCharting API 仕様

### 認証
- トークン: `t` パラメータで渡す
- `.env.local` に `PRICECHARTING_TOKEN` として保存

### エンドポイント

#### `/api/product` - 単体取得
```
GET https://www.pricecharting.com/api/product?t=TOKEN&id=PRICECHARTING_ID
```

レスポンス（価格はペニー単位の整数。例: $17.32 → `1732`）:
```json
{
  "status": "success",
  "id": "6910",
  "product-name": "Charizard",
  "console-name": "Pokemon Base Set",
  "loose-price": 17244,
  "cib-price": 42995,
  "new-price": 53000,
  "graded-price": 100000,
  "release-date": "1999-01-09"
}
```

#### `/api/products` - テキスト検索（紐付け時の候補検索用）
```
GET https://www.pricecharting.com/api/products?t=TOKEN&q=charizard+pokemon
```
→ 最大20件の候補を返す

#### パラメータ
| パラメータ | 用途 | 例 |
|---|---|---|
| `id` | PriceCharting固有ID | `id=6910` |
| `upc` | UPCバーコード | `upc=045496830434` |
| `q` | テキスト検索 | `q=charizard #4` |

### 取得可能データ（APIキー）
| キー | 内容 | 用途 |
|---|---|---|
| `id` | PriceCharting 固有ID | カードの一意識別子 |
| `product-name` | 英語カード名 | 表示用 |
| `console-name` | セット名 | 表示用 |
| `loose-price` | 素体価格（ペニー） | **最も参考になる** |
| `cib-price` | 箱付き価格 | トレカでは使用しない場合あり |
| `new-price` | 未開封価格 | 未開封品の価格 |
| `graded-price` | 鑑定品価格 | PSA等の価格 |
| `release-date` | 発売日 | 参考情報 |

### 通貨対応
PriceCharting は **JPY を含む17通貨に対応**。サイト上で通貨切り替え可能。
ただしAPIで通貨指定するパラメータがあるか要確認。なければ USD で取得して為替変換。

### レート制限
- **1リクエスト/秒**（超過するとアカウント停止リスク）
- CSV一括ダウンロードは10分に1回（Legendaryプラン）

---

## 為替レート取得

### 推奨: Frankfurter API
- **完全無料、APIキー不要**
- 1,000リクエスト/日
- ECB（欧州中央銀行）のレート使用
```
GET https://api.frankfurter.dev/v1/latest?base=USD&symbols=JPY
→ { "rates": { "JPY": 149.50 } }
```

---

## 更新頻度の設計

### 計算
- レート制限: 1req/sec = **3,600req/hour = 86,400req/day**
- 対象カード: 数千枚（仮に3,000枚）
- 1回の全カード更新: 3,000秒 = **約50分**
- **1日1〜2回の更新が適切**

### 推奨スケジュール
| ジョブ | 頻度 | 理由 |
|---|---|---|
| 全カード価格更新 | 1日1回（深夜） | PriceChartingの更新頻度が不明のため |
| 為替レート取得 | 1日1回（更新前） | 日次更新で十分 |
| 高額カードのみ更新 | 1日2回（朝・夜） | 重要カードだけ頻度を上げる（オプション） |

### Cron設定例
```
# 毎日AM3:00に全カード更新
0 3 * * * overseas-price-sync

# 毎日AM2:55に為替レート取得
55 2 * * * exchange-rate-sync
```

---

## 実装タスク

### Phase 1: 基盤
1. [ ] `cards` テーブルに `pricecharting_id` カラム追加
2. [ ] `overseas_prices` テーブル新規作成
3. [ ] `lib/pricecharting-api.ts` — APIクライアント
4. [ ] `lib/exchange-rate.ts` — 為替レート取得
5. [ ] `.env.local` に `PRICECHARTING_TOKEN` 追加

### Phase 2: 紐付けUI
6. [ ] カード詳細画面に PriceCharting URL/検索入力欄追加
7. [ ] `/api/overseas-prices/link` — URL→ID紐付けエンドポイント
8. [ ] `/api/overseas-prices/search` — PriceCharting検索エンドポイント

### Phase 3: 自動更新
9. [ ] `/api/cron/overseas-price-sync` — 定期価格同期Cron
10. [ ] `/api/cron/exchange-rate-sync` — 為替レート同期Cron
11. [ ] カード詳細画面に海外価格グラフ表示

---

## DB設計

### `cards` テーブル変更
```sql
ALTER TABLE cards ADD COLUMN pricecharting_id TEXT NULL;
ALTER TABLE cards ADD COLUMN pricecharting_name TEXT NULL;
```

### `overseas_prices` テーブル（新規）
```sql
CREATE TABLE overseas_prices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  card_id UUID REFERENCES cards(id),
  pricecharting_id TEXT NOT NULL,
  loose_price_usd INTEGER,      -- ペニー単位
  cib_price_usd INTEGER,
  new_price_usd INTEGER,
  graded_price_usd INTEGER,
  exchange_rate DECIMAL(10,4),   -- USD/JPY
  loose_price_jpy INTEGER,       -- 円換算
  graded_price_jpy INTEGER,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_overseas_prices_card_id ON overseas_prices(card_id);
CREATE INDEX idx_overseas_prices_recorded_at ON overseas_prices(recorded_at);
```

### `exchange_rates` テーブル（新規）
```sql
CREATE TABLE exchange_rates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  base_currency TEXT DEFAULT 'USD',
  target_currency TEXT DEFAULT 'JPY',
  rate DECIMAL(10,4),
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);
```
