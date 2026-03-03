# toreca-app テスト専門エージェント メモリ

## テストインフラ

- **テストランナー**: Vitest v4.0.18（package.jsonに追加済み）
- **設定ファイル**: `vitest.config.ts`（プロジェクトルートに作成済み）
- **パスエイリアス**: `@/*` → プロジェクトルート（`vitest.config.ts` の `resolve.alias` で設定）
- **実行コマンド**: `node_modules/.bin/vitest run` （グローバルnpxは `vitest/config` モジュールが見つからずエラーになるため使用不可）
- **テストスクリプト**: `npm test`（vitest run）, `npm run test:watch`

## 重要パターン: vi.hoisted() の必須使用

route.ts はモジュールスコープで `createServiceClient()` を即時呼び出す。
`vi.mock()` ファクトリ内で外部変数を参照すると TDZ エラーになるため、
**必ず `vi.hoisted()` でモック変数を宣言する**。

```ts
const { mockFrom, mockSupabaseClient } = vi.hoisted(() => {
  const mockFrom = vi.fn()
  const mockSupabaseClient = { from: mockFrom }
  return { mockFrom, mockSupabaseClient }
})

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => mockSupabaseClient,
}))
```

## Supabase モックの構造

各 `from()` テーブルはチェーン可能なビルダーを返す必要がある。
`mockFrom.mockImplementation((table) => { ... })` で테이블別に分岐。
`card_sale_urls` は select チェーン（like→or→order→limit）と update チェーン（eq）の両方が必要。

## 既存テストファイル

- `app/api/cron/snkrdunk-sync/__tests__/route.test.ts` — 45テスト、全通過

## プロジェクト構造メモ

- **プロジェクト**: Next.js 16 App Router + Supabase + TypeScript（strict: false）
- **Cronジョブ**: `app/api/cron/` 配下の8ルート、Bearer認証必須
- **依存ライブラリ**: `lib/supabase.ts`, `lib/cron-gate.ts`, `lib/snkrdunk-api.ts`, `lib/scraping/helpers.ts`
- **テスト対象パターン**: プライベート関数はGETハンドラ経由で間接テスト

詳細は `patterns.md` を参照。
