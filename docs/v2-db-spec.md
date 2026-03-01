# toreca-app v2 DB設計仕様書 (Rev.4)

SQLスキーマ: `docs/v2-db-schema.sql`

## Context

toreca-app v1の問題点（テストゼロ、4層カテゴリの複雑さ、テーブル乱立、手動紐付け）を踏まえ、
新規Supabaseプロジェクトに1からDB設計を行う。JustTCG APIの実データ調査結果に基づいた設計。

**Rev.4ではTCG API (tcgapi.dev) の統合を考慮。** `tcgplayer_id`を3ソース共通キーとして復活。

**この仕様書はDB設計のみ。** 実装（Next.js、UI、API）は別途。

---

## Rev.4 変更点（Rev.3からの差分）

| 変更 | 内容 |
|---|---|
| cards.tcgplayer_id復活 | 3ソース共通キーをcard_external_idsから昇格 |
| cards.tcgapi_card_id追加 | TCG API固有カードID |
| cards.image_source追加 | 画像ソース追跡（tcgapi/pricecharting/tcgplayer/manual） |
| sets.tcgapi_set_id追加 | TCG API固有セットID |
| sets.tcgplayer_set_id追加 | TCGPlayerセットID |
| sets.image_url追加 | セット画像URL（TCG API提供） |
| card_external_ids明確化 | 低頻度ソース専用（snkrdunk/shinsoku/toreca_lounge） |
| 外部ID整合性ルール廃止 | cards直接保持との二重保持ルール削除 |

---

## テーブル一覧（11テーブル）

| # | テーブル | 用途 |
|---|---|---|
| 1 | `sets` | セット（収録弾）マスタ。JustTCG set_id = PK |
| 2 | `rarity_mappings` | レアリティ英語→日本語マッピング（game_type別） |
| 3 | `cards` | カタログ。全カラム個別保存。is_manual で手動/API区別 |
| 4 | `card_search_terms` | 検索ワード・通称（1:N） |
| 5 | `card_external_ids` | 低頻度外部サービス紐付け |
| 6 | `prices` | 販売価格（統合） |
| 7 | `daily_price_stats` | 日別集計 |
| 8 | `buyback_prices` | 買取価格 |
| 9 | `exchange_rates` | 為替レート |
| 10 | `cron_jobs` | 定期実行設定 |
| 11 | `cron_logs` | 実行ログ |

---

## データソースと役割

| ソース | 役割 | データ |
|---|---|---|
| **JustTCG API** (Pro) | カタログ元データ + 海外素体価格 | カード名(英語)、型番、セット、レアリティ、状態別価格、180日履歴 |
| **TCG API** (将来メイン) | カタログ + 画像 + メタデータ | カード名、画像URL、HP/技/弱点、market_price |
| **PriceCharting** | 海外PSA10価格 + カード画像 | graded価格、loose価格、画像URL |
| **Gemini AI** | 日本語名生成 | 英語カード名 → 日本語カード名 |
| **シンソク** | 日本国内買取価格 | Webスクレイピング |
| **トレカラウンジ** | 日本国内買取価格 | Webスクレイピング |
| **スニダン** | 日本販売価格 | API |
| **オークファン（メルカリ）** | メルカリ相場 | CSV |
| **オークファン（ヤフオク）** | ヤフオク相場 | CSV |

---

## 外部ID管理方針

### 高頻度ID（cardsテーブルに直接保持）

| カラム | 用途 | ソース |
|---|---|---|
| `justtcg_id` | カタログインポート、差分同期 | JustTCG API |
| `tcgplayer_id` | **3ソース共通キー**、ソース間マッチング | TCG API / JustTCG / PriceCharting |
| `pricecharting_id` | 画像取得・eBay実売・PSA10価格 | PriceCharting |
| `tcgapi_card_id` | メインカタログID、画像・メタデータ | TCG API |

### 低頻度ID（card_external_idsテーブル）

snkrdunk, shinsoku, toreca_lounge等。将来の新ソースもここに格納。

---

## 画像優先順位

| 優先度 | ソース | image_source値 | 取得方法 |
|---|---|---|---|
| 1 | TCG API | `tcgapi` | APIが直接URLを返す |
| 2 | PriceCharting | `pricecharting` | HTMLスクレイピング |
| 3 | TCGPlayer構築 | `tcgplayer` | `tcgplayer_id`からURL構築 |
| 4 | 手動 | `manual` | ユーザーアップロード |

---

## prices.source 一覧

| source | データ内容 | currency | condition |
|---|---|---|---|
| `justtcg` | NM/LP/MP/HP/Damaged状態別価格 | USD | NM/LP/MP/HP/Damaged |
| `tcgapi` | market_price（単一価格） | USD | NULL |
| `pricecharting` | loose/graded価格 | USD | loose/graded |
| `mercari` | メルカリ実売 | JPY | 自由記述 |
| `yahoo_auction` | ヤフオク落札 | JPY | 自由記述 |
| `snkrdunk` | スニダン販売 | JPY | PSA等 |

---

## テーブル関連図

```
sets ──────────────────┐
  id (PK, TEXT)         │  ← JustTCG slug
  game_type (CHECK)     │
  series                │
  name_en / name_ja     │
  tcgapi_set_id         │
  tcgplayer_set_id      │
  image_url             │
                        │
cards ◄────────────────┘ (set_id FK)
  id (PK, UUID)
  game_type (CHECK)
  card_name / card_name_en
  card_number, rarity
  image_url / image_source
  justtcg_id (UNIQUE)
  tcgplayer_id (UNIQUE)      ← 3ソース共通
  pricecharting_id
  tcgapi_card_id (UNIQUE)
  metadata (JSONB)
       │
       ├── card_search_terms (1:N, CASCADE)
       ├── card_external_ids (1:N, CASCADE) ← 低頻度専用
       ├── prices (1:N, CASCADE)
       │       └── daily_price_stats (集計)
       └── buyback_prices (1:N, CASCADE)

rarity_mappings (独立マスタ)
exchange_rates / cron_jobs / cron_logs (独立)
```

---

## カテゴリ設計

v1の4層 → v2は3層:
```
game_type(CHECK制約) → series(setsカラム) → set(setsテーブル)
```

---

## TCG API統合フェーズ

### Phase 1: 現行維持
- JustTCG Explorerのまま運用
- `tcgplayer_id`をJustTCG APIから正しく取得・保存

### Phase 2: TCG API Explorer構築
- `/tcgapi`ルートに新規Explorer
- 登録時: `tcgapi_card_id` + `tcgplayer_id` + `image_url`(tcgapi)を同時設定
- 画像直接取得 → PriceCharting検索不要で登録フロー簡素化

### Phase 3: 既存カードの一括紐付け
- `tcgplayer_id`をキーにTCG API側の`tcgapi_card_id`を一括設定
- TCG API画像で`image_source`が下位のカードを上書き

---

## v1 → v2 マイグレーション概要

1. 新Supabaseプロジェクト作成
2. `docs/v2-db-schema.sql`一括実行
3. v1 cardsデータETL（category_large_id→game_type変換、カラム名マッピング）
4. v1 purchase_prices/sale_prices → v2 prices/buyback_prices統合
5. v1 overseas_prices → v2 prices (source='pricecharting')
6. アプリ側接続先切り替え

---

## v1からの改善点

| 項目 | v1 | v2 |
|---|---|---|
| カテゴリ | 4テーブル | game_type CHECK + sets |
| レアリティ | rarities(8件)+テキスト二重管理 | rarity原文 + rarity_mappings |
| 価格 | 3テーブル分離 | prices + buyback_prices統合 |
| 外部ID | カラム乱立 | 高頻度4つ直接 + card_external_ids |
| 検索ワード | なし | card_search_terms |
| 手動追加 | 区別なし | is_manual フラグ |
| 画像管理 | 出典不明 | image_source追跡 |
| TCG API | 未対応 | tcgapi_card_id + tcgapi_set_id |
