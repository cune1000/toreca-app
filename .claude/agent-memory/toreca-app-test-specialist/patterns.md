# toreca-app テストパターン集

## 1. vitest.config.ts の最小構成

```ts
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    alias: { '@': path.resolve(__dirname, '.') },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
})
```

## 2. モジュールスコープで Supabase を初期化するファイルのモック方法

route.ts の `const supabase = createServiceClient()` はモジュールロード時に実行される。
`vi.mock()` のファクトリは巻き上げられるが、ファクトリ外の変数は TDZ のためアクセス不可。
→ **`vi.hoisted()` で変数を先に宣言してからファクトリ内で参照する**

```ts
const { mockFrom } = vi.hoisted(() => {
  const mockFrom = vi.fn()
  return { mockFrom, mockSupabaseClient: { from: mockFrom } }
})
vi.mock('@/lib/supabase', () => ({ createServiceClient: () => ({ from: mockFrom }) }))
```

## 3. Supabase チェーンモックの構造（card_sale_urls）

```ts
mockFrom.mockImplementation((table: string) => {
  if (table === 'card_sale_urls') {
    return {
      select: () => ({
        like: () => ({
          or: () => ({
            order: () => ({
              limit: () => Promise.resolve({ data: [...], error: null }),
            }),
          }),
        }),
      }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }
  }
  // 他テーブル...
})
```

## 4. プライベート関数の間接テスト方針

route.ts の `isSameTransaction`, `extractIconNumber` はエクスポートされていない。
GET ハンドラを通じて結果（salesInserted/salesSkipped や insert 引数）を検査することで間接テストする。

- `isSameTransaction` → salesInserted/salesSkipped のカウントで検証
- `extractIconNumber` → insert() に渡された `user_icon_number` 引数で検証

## 5. cron-gate のモック

```ts
vi.mock('@/lib/cron-gate', () => ({
  shouldRunCronJob: vi.fn().mockResolvedValue({ shouldRun: true, reason: 'test' }),
  markCronJobRun: vi.fn().mockResolvedValue(undefined),
}))
```

スキップテスト: `vi.mocked(shouldRunCronJob).mockResolvedValue({ shouldRun: false, reason: 'disabled' })`

## 6. next_scrape_at のタイミング検証

Date.now() を before/after で挟んで許容範囲を確認する。

```ts
const before = Date.now()
await GET(req)
const after = Date.now()
const nextScrapeAt = new Date(updateArg.next_scrape_at).getTime()
expect(nextScrapeAt).toBeGreaterThanOrEqual(before + 30 * 60 * 1000)
expect(nextScrapeAt).toBeLessThanOrEqual(after + 30 * 60 * 1000)
```
