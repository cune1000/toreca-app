# toreca-app v2 — DB設計仕様書 (Rev.3)

## Context

toreca-app v1 の問題点（テストゼロ、4層カテゴリの複雑さ、テーブル乱立、手動紐付け）を踏まえ、
新規Supabaseプロジェクトに1からDB設計を行う。JustTCG APIの実データ調査結果に基づいた設計。

**この仕様書はDB設計のみ。** 実装（Next.js、UI、API）は別途。

### Rev.3 変更点

| 変更 | 内容 |
|---|---|
| game_type制約追加 | CHECK制約で有効値を強制 |
| imported_count削除 | sets テーブルから削除。COUNT(*)で都度計算 |
| cards.release_date明確化 | NULLable。通常はsets.release_dateを参照、プロモ等のみ個別設定 |
| ON DELETE CASCADE追加 | prices, buyback_prices にカード削除時のCASCADE追加 |
| 複合インデックス追加 | prices, buyback_prices にスケーラビリティ対策 |
| 外部ID方針明確化 | cards に高頻度ID（justtcg_id, pricecharting_id）を残し、card_external_ids は追加ソース用と明記 |
| メルカリ/ヤフオク分離 | source を "mercari" / "yahoo_auction" に分離 |
| prices拡張 | title, thumbnail_url, listing_url, sold_at, is_excluded, exclude_reason 追加 |
| daily_price_stats追加 | 日別集計テーブル（11テーブル目）。ノイズ除去後のクリーンデータからチャート用に集計 |

---

## データソースと役割

| ソース | 役割 | データ |
|---|---|---|
| **JustTCG API** (Pro) | カタログ元データ + 海外素体価格 | カード名(英語)、型番、セット、レアリティ、販売価格、180日履歴 |
| **PriceCharting** | 海外PSA10価格 + カード画像 | graded価格、loose価格、画像URL |
| **Gemini AI** | 日本語名生成 | 英語カード名 → 日本語カード名 |
| **シンソク** | 日本国内買取価格 | Webスクレイピング |
| **トレカラウンジ** | 日本国内買取価格 | Webスクレイピング |
| **スニダン** | 日本販売価格 | API |
| **オークファン（メルカリ）** | メルカリ相場 | CSV/API |
| **オークファン（ヤフオク）** | ヤフオク相場 | CSV/API |

### JustTCG API仕様（実測済み）

- 認証: `X-API-Key` ヘッダー
- Proプラン: 月50,000リクエスト / 日5,000 / 分100 / バッチ100件
- 価格単位: **USD直値**（ペニーではない）
- 価格履歴: 7d / 30d / 90d / 180d
- 差分同期: `updated_after` パラメータ
- カード名: **全ゲーム英語表記**（pokemon-japanも英語名）
- `details` フィールド: 現時点で全ゲーム `null`

---

## 対応ゲーム

| ゲーム | API識別子 | 備考 |
|---|---|---|
| ポケモン（日本語版） | `pokemon-japan` | メインカタログ |
| ワンピース | `one-piece-card-game` | サブカタログ |

---

## テーブル一覧（11テーブル）

| # | テーブル | 用途 |
|---|---|---|
| 1 | `sets` | セット（収録弾）マスタ。JustTCG set_id = PK |
| 2 | `rarity_mappings` | レアリティ英語→日本語マッピング |
| 3 | `cards` | カタログ。全カラム個別保存。is_manual で手動/API区別 |
| 4 | `card_search_terms` | 検索ワード・通称（1:N）。メルカリ/POS/チャートで共通使用 |
| 5 | `card_external_ids` | 外部サービス紐付け（1:N）。source + external_id |
| 6 | `prices` | 販売価格。title/thumbnail_urlでノイズ弾き。is_excluded で除外管理 |
| 7 | `daily_price_stats` | 日別集計（min/max/avg/median/count）。ノイズ除去後に集計 |
| 8 | `buyback_prices` | 買取価格（shinsoku/toreca_lounge） |
| 9 | `exchange_rates` | 為替レート |
| 10 | `cron_jobs` | 定期実行設定 |
| 11 | `cron_logs` | 実行ログ |

---

## テーブル関連図

```
sets ──────────────────┐
  id (PK, TEXT)         │
  game_type (CHECK)     │
  series                │
  name_en / name_ja     │
  release_date          │
  cards_count           │
                        │
cards ◄────────────────┘ (set_id FK)
  id (PK, UUID)
  game_type (CHECK)
  card_name / card_name_en
  card_number
  rarity (英語原文)
  release_date (通常NULL)
  is_manual
  justtcg_id (デノーマライズ)
  pricecharting_id (デノーマライズ)
       │
       ├── card_search_terms (1:N, CASCADE)
       │     term, type
       │
       ├── card_external_ids (1:N, CASCADE)
       │     source, external_id, match_method
       │
       ├── prices (1:N, CASCADE)
       │     source, price, title, thumbnail_url, listing_url, sold_at
       │     is_excluded, exclude_reason, raw_data
       │         │
       │         └── daily_price_stats (集計テーブル)
       │               card_id + source + date → min/max/avg/median/count
       │
       └── buyback_prices (1:N, CASCADE)
             source, price, condition, fetched_at

rarity_mappings (独立マスタ)
  game_type (CHECK) + rarity_en → rarity_ja, short_name

exchange_rates (独立)
cron_jobs (独立)
cron_logs (独立)
```

---

## カテゴリ設計（v1の4層 → v2の3層）

```
v1: category_large → category_medium → category_small → category_detail（4テーブル）
v2: game_type(CHECK制約) → series(setsカラム) → set(setsテーブル)（1テーブル + CHECK制約）
```

```
ポケモンカード (game_type = "pokemon-japan")
├── SV: スカーレット&バイオレット (series = "SV")
│   ├── SV1S: Scarlet ex
│   ├── SV1V: Violet ex
│   ├── SV2a: Pokemon Card 151
│   └── ...
├── M: メガシリーズ (series = "M")
│   └── M3: Nihil Zero
└── SM: サン&ムーン (series = "SM")
    └── ...

ワンピース (game_type = "one-piece-card-game")
├── OP01〜 (series from set prefix)
│   └── ...
```

---

## 外部ID管理方針

```
■ 高頻度アクセスID（cardsテーブルに直接保持）
  - justtcg_id    → インポート時に必ず設定。差分同期で毎回参照
  - pricecharting_id → 画像取得・海外価格取得で毎回参照

■ 追加ソースID（card_external_idsテーブルで管理）
  - snkrdunk      → スニダン販売価格取得時に参照
  - shinsoku      → シンソク買取価格取得時に参照
  - toreca_lounge → トレカラウンジ買取価格取得時に参照
  - tcgplayer     → 必要になった場合に追加

■ 整合性ルール
  - cards.justtcg_id に値がある場合、card_external_ids にも (source='justtcg') のレコードが存在すること
  - cards.pricecharting_id に値がある場合、card_external_ids にも (source='pricecharting') のレコードが存在すること
  - → アプリ層で保証（トリガーは使わない。シンプルさ優先）
```

---

## 完全なスキーマ定義

`docs/v2-db-schema.sql` を参照。
