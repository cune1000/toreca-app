/**
 * snkrdunk-sync/route.ts のユニットテスト
 *
 * テスト対象:
 * 1. isSameTransaction  — 10分以内を同一取引とみなすロジック
 * 2. extractIconNumber  — imageUrl からアイコン番号を抽出
 * 3. syncSalesHistory   — 売買履歴の重複判定とバッチ INSERT ロジック
 * 4. syncListingPrices  — グレード別最安値の抽出と sale_prices へのバッチ INSERT
 * 5. GET handler        — 認証チェック / cron-gate / バッチ処理フロー
 *
 * route.ts でモジュールスコープに createServiceClient() を呼ぶため、
 * Supabase モックは vi.mock() でホイスト必須。
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ────────────────────────────────────────────────────────────────────────────
// vi.hoisted() で変数をホイスト — vi.mock() ファクトリ内から安全に参照可能
// ────────────────────────────────────────────────────────────────────────────

const { mockFrom, mockSupabaseClient } = vi.hoisted(() => {
  const mockFrom = vi.fn()
  const mockSupabaseClient = { from: mockFrom }
  return { mockFrom, mockSupabaseClient }
})

/** Supabase クエリビルダーのチェーン可能なモックファクトリ */
function makeQueryBuilder(overrides: Partial<Record<string, any>> = {}) {
  const builder: any = {}
  const noop = () => builder
  builder.select = overrides.select ?? noop
  builder.insert = overrides.insert ?? vi.fn().mockResolvedValue({ error: null })
  builder.update = overrides.update ?? noop
  builder.upsert = overrides.upsert ?? noop
  builder.eq = overrides.eq ?? noop
  builder.gte = overrides.gte ?? noop
  builder.or = overrides.or ?? noop
  builder.order = overrides.order ?? noop
  builder.limit = overrides.limit ?? noop
  builder.like = overrides.like ?? noop
  builder.single = overrides.single ?? vi.fn().mockResolvedValue({ data: null, error: null })
  return builder
}

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => mockSupabaseClient,
}))

vi.mock('@/lib/cron-gate', () => ({
  shouldRunCronJob: vi.fn(),
  markCronJobRun: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/snkrdunk-api', () => ({
  extractApparelId: vi.fn(),
  getProductInfo: vi.fn(),
  getSalesHistory: vi.fn(),
  getAllListings: vi.fn(),
  getBoxSizes: vi.fn(),
}))

vi.mock('@/lib/scraping/helpers', () => ({
  normalizeGrade: vi.fn(),
  parseRelativeTime: vi.fn(),
  extractGradePrices: vi.fn(),
}))

// ────────────────────────────────────────────────────────────────────────────
// インポート（モックの後で行う）
// ────────────────────────────────────────────────────────────────────────────

import { GET } from '../route'
import { shouldRunCronJob, markCronJobRun } from '@/lib/cron-gate'
import {
  extractApparelId,
  getProductInfo,
  getSalesHistory,
  getAllListings,
  getBoxSizes,
} from '@/lib/snkrdunk-api'
import { normalizeGrade, parseRelativeTime, extractGradePrices } from '@/lib/scraping/helpers'

// ────────────────────────────────────────────────────────────────────────────
// テスト用ヘルパー
// ────────────────────────────────────────────────────────────────────────────

function makeRequest(authHeader?: string): Request {
  return new Request('https://example.com/api/cron/snkrdunk-sync', {
    headers: authHeader ? { authorization: authHeader } : {},
  })
}

// 基本的な saleUrl フィクスチャ（単枚カード）
const BASE_SALE_URL = {
  id: 'url-1',
  card_id: 'card-abc',
  site_id: 'site-xyz',
  product_url: 'https://snkrdunk.com/apparels/12345',
  card: { id: 'card-abc', name: 'テストカード' },
  site: { id: 'site-xyz', name: 'スニダン' },
  apparel_id: null,
  product_type: null,
  error_count: 0,
}

/**
 * snkrdunk_sales_history の select チェーン:
 * .select().eq('card_id', x).gte('sold_at', x).order()
 */
function makeSalesHistorySelectChain(existingItems: any[]) {
  return () => ({
    eq: () => ({
      gte: () => ({
        order: () => Promise.resolve({ data: existingItems, error: null }),
      }),
    }),
  })
}

// ────────────────────────────────────────────────────────────────────────────
// beforeEach: 環境変数・共通モックのリセット
// ────────────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks()
  process.env.CRON_SECRET = 'test-secret'

  // デフォルト: cron-gate は実行許可
  vi.mocked(shouldRunCronJob).mockResolvedValue({ shouldRun: true, reason: 'test' })

  // デフォルト: extractApparelId は 12345 を返す
  vi.mocked(extractApparelId).mockReturnValue(12345)

  // デフォルト: 商品情報はシングルカード
  vi.mocked(getProductInfo).mockResolvedValue({
    id: 12345,
    productNumber: 'PN-001',
    name: 'Test Card',
    localizedName: 'テストカード',
    minPrice: 1000,
    totalListingCount: 5,
    isSingleCard: true,
    isBox: false,
    category: 'trading-card-single',
    imageUrl: null,
  })

  // デフォルト: 売買履歴は空
  vi.mocked(getSalesHistory).mockResolvedValue({ history: [], minPrice: null })

  // デフォルト: 出品一覧は空
  vi.mocked(getAllListings).mockResolvedValue([])

  // デフォルト: getBoxSizes は空
  vi.mocked(getBoxSizes).mockResolvedValue([])

  // デフォルト: extractGradePrices は空配列
  vi.mocked(extractGradePrices).mockReturnValue([])

  // デフォルト: parseRelativeTime は固定日時を返す
  vi.mocked(parseRelativeTime).mockReturnValue(new Date('2026-01-15T10:00:00.000Z'))

  // デフォルト: normalizeGrade は入力をそのまま返す
  vi.mocked(normalizeGrade).mockImplementation((g: string) => g || null)
})

afterEach(() => {
  delete process.env.CRON_SECRET
})

// ============================================================================
// 1. isSameTransaction — ユニットテスト
// ============================================================================

describe('isSameTransaction (間接テスト: syncSalesHistory の重複判定)', () => {
  async function runWithSalesHistory(
    history: any[],
    existing: any[]
  ) {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'card_sale_urls') {
        return {
          select: () => ({
            like: () => ({
              or: () => ({
                order: () => ({
                  limit: () => Promise.resolve({ data: [BASE_SALE_URL], error: null }),
                }),
              }),
            }),
          }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        }
      }
      if (table === 'snkrdunk_sales_history') {
        return {
          select: makeSalesHistorySelectChain(existing),
          insert: vi.fn().mockResolvedValue({ error: null }),
        }
      }
      if (table === 'sale_prices') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) }
      }
      return makeQueryBuilder()
    })

    vi.mocked(getSalesHistory).mockResolvedValue({ history, minPrice: null })
    vi.mocked(parseRelativeTime).mockReturnValue(new Date('2026-01-15T10:00:00.000Z'))
    vi.mocked(normalizeGrade).mockReturnValue('A')

    const req = makeRequest(`Bearer test-secret`)
    const res = await GET(req)
    const body = await res.json()
    return body
  }

  it('sold_at の差が5分（300秒）なら同一取引とみなしてスキップする', async () => {
    const baseTime = '2026-01-15T10:00:00.000Z'
    const closeTime = '2026-01-15T10:05:00.000Z' // 5分差

    const history = [
      { price: 5000, date: '1時間前', condition: 'A', imageUrl: 'https://example.com/user-icon-7.png' },
    ]
    const existing = [
      { grade: 'A', price: 5000, sold_at: closeTime, user_icon_number: 7 },
    ]

    vi.mocked(parseRelativeTime).mockReturnValue(new Date(baseTime))

    const body = await runWithSalesHistory(history, existing)

    expect(body.results[0].salesSkipped).toBe(1)
    expect(body.results[0].salesInserted).toBe(0)
  })

  it('sold_at の差が15分なら別取引としてINSERTする', async () => {
    const newTime = '2026-01-15T10:00:00.000Z'
    const existingTime = '2026-01-15T09:45:00.000Z' // 15分差

    const history = [
      { price: 5000, date: '1時間前', condition: 'A', imageUrl: 'https://example.com/user-icon-7.png' },
    ]
    const existing = [
      { grade: 'A', price: 5000, sold_at: existingTime, user_icon_number: 7 },
    ]

    vi.mocked(parseRelativeTime).mockReturnValue(new Date(newTime))

    const body = await runWithSalesHistory(history, existing)

    expect(body.results[0].salesInserted).toBe(1)
    expect(body.results[0].salesSkipped).toBe(0)
  })

  it('sold_at がちょうど10分差（境界値）なら同一取引とみなさない', async () => {
    const newTime = '2026-01-15T10:00:00.000Z'
    const existingTime = '2026-01-15T09:50:00.000Z' // ちょうど10分差

    const history = [
      { price: 3000, date: '2時間前', condition: 'B', imageUrl: 'https://example.com/user-icon-1.png' },
    ]
    const existing = [
      { grade: 'B', price: 3000, sold_at: existingTime, user_icon_number: 1 },
    ]

    vi.mocked(parseRelativeTime).mockReturnValue(new Date(newTime))
    vi.mocked(normalizeGrade).mockReturnValue('B')

    const body = await runWithSalesHistory(history, existing)

    // 10分ちょうどは < 600000ms を満たさないため別取引 → INSERT
    expect(body.results[0].salesInserted).toBe(1)
  })

  it('sold_at に無効な日付文字列が含まれている場合は同一取引とみなさない', async () => {
    const history = [
      { price: 2000, date: '30分前', condition: 'C', imageUrl: '' },
    ]
    const existing = [
      { grade: 'C', price: 2000, sold_at: 'invalid-date', user_icon_number: null },
    ]

    vi.mocked(parseRelativeTime).mockReturnValue(new Date('2026-01-15T10:00:00.000Z'))
    vi.mocked(normalizeGrade).mockReturnValue('C')

    const body = await runWithSalesHistory(history, existing)

    // isNaN チェックにより同一取引と判定されず、INSERT される
    expect(body.results[0].salesInserted).toBe(1)
  })
})

// ============================================================================
// 2. extractIconNumber — ユニットテスト（間接的に syncSalesHistory で検証）
// ============================================================================

describe('extractIconNumber (imageUrl からアイコン番号抽出)', () => {
  async function captureInsertArgs(imageUrl: string) {
    let capturedInsertArg: any = null

    mockFrom.mockImplementation((table: string) => {
      if (table === 'card_sale_urls') {
        return {
          select: () => ({
            like: () => ({
              or: () => ({
                order: () => ({
                  limit: () => Promise.resolve({ data: [BASE_SALE_URL], error: null }),
                }),
              }),
            }),
          }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        }
      }
      if (table === 'snkrdunk_sales_history') {
        return {
          select: makeSalesHistorySelectChain([]),
          insert: vi.fn().mockImplementation((arg: any) => {
            capturedInsertArg = arg
            return Promise.resolve({ error: null })
          }),
        }
      }
      if (table === 'sale_prices') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) }
      }
      return makeQueryBuilder()
    })

    vi.mocked(getSalesHistory).mockResolvedValue({
      history: [{ price: 1000, date: '1時間前', condition: 'A', size: '', label: '', imageUrl }],
      minPrice: null,
    })
    vi.mocked(parseRelativeTime).mockReturnValue(new Date('2026-01-15T10:00:00.000Z'))
    vi.mocked(normalizeGrade).mockReturnValue('A')

    await GET(makeRequest('Bearer test-secret'))
    return capturedInsertArg
  }

  it('user-icon-42 のような URL からアイコン番号 42 を抽出する', async () => {
    const arg = await captureInsertArgs('https://cdn.snkrdunk.com/photos/user-icon-42.png')
    // バッチINSERT（配列）なので最初の要素を検査
    const item = Array.isArray(arg) ? arg[0] : arg
    expect(item?.user_icon_number).toBe(42)
  })

  it('user-icon-1 の URL からアイコン番号 1 を抽出する', async () => {
    const arg = await captureInsertArgs('https://cdn.snkrdunk.com/photos/user-icon-1.jpg')
    const item = Array.isArray(arg) ? arg[0] : arg
    expect(item?.user_icon_number).toBe(1)
  })

  it('user-icon パターンを含まない URL は null を返す', async () => {
    const arg = await captureInsertArgs('https://cdn.snkrdunk.com/photos/avatar.png')
    const item = Array.isArray(arg) ? arg[0] : arg
    expect(item?.user_icon_number).toBeNull()
  })

  it('空文字列は null を返す', async () => {
    const arg = await captureInsertArgs('')
    const item = Array.isArray(arg) ? arg[0] : arg
    expect(item?.user_icon_number).toBeNull()
  })

  it('複数桁のアイコン番号（user-icon-999）を正しく抽出する', async () => {
    const arg = await captureInsertArgs('https://cdn.snkrdunk.com/photos/user-icon-999/avatar.jpg')
    const item = Array.isArray(arg) ? arg[0] : arg
    expect(item?.user_icon_number).toBe(999)
  })
})

// ============================================================================
// 3. syncSalesHistory — 売買履歴の重複判定とバッチ INSERT ロジック
// ============================================================================

describe('syncSalesHistory (売買履歴同期)', () => {
  function setupMocks({
    historyItems = [] as any[],
    existingItems = [] as any[],
    insertResult = { error: null } as any,
  } = {}) {
    const insertMock = vi.fn().mockResolvedValue(insertResult)

    mockFrom.mockImplementation((table: string) => {
      if (table === 'card_sale_urls') {
        return {
          select: () => ({
            like: () => ({
              or: () => ({
                order: () => ({
                  limit: () => Promise.resolve({ data: [BASE_SALE_URL], error: null }),
                }),
              }),
            }),
          }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        }
      }
      if (table === 'snkrdunk_sales_history') {
        return {
          select: makeSalesHistorySelectChain(existingItems),
          insert: insertMock,
        }
      }
      if (table === 'sale_prices') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) }
      }
      return makeQueryBuilder()
    })

    vi.mocked(getSalesHistory).mockResolvedValue({ history: historyItems, minPrice: null })

    return { insertMock }
  }

  it('有効な売買履歴1件を正しくバッチ INSERT する', async () => {
    const { insertMock } = setupMocks({
      historyItems: [
        { price: 10000, date: '1時間前', condition: 'PSA10', size: '', label: '中古', imageUrl: 'https://cdn.snkrdunk.com/user-icon-3.png' },
      ],
    })
    vi.mocked(parseRelativeTime).mockReturnValue(new Date('2026-01-15T09:00:00.000Z'))
    vi.mocked(normalizeGrade).mockReturnValue('PSA10')

    const res = await GET(makeRequest('Bearer test-secret'))
    const body = await res.json()

    expect(body.results[0].salesInserted).toBe(1)
    expect(body.results[0].salesSkipped).toBe(0)
    // バッチINSERT: 配列で渡される
    expect(insertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          card_id: 'card-abc',
          apparel_id: 12345,
          grade: 'PSA10',
          price: 10000,
          product_type: 'single',
          user_icon_number: 3,
        }),
      ])
    )
  })

  it('parseRelativeTime が null を返す場合はそのアイテムをスキップする', async () => {
    setupMocks({
      historyItems: [
        { price: 5000, date: '', condition: 'A', size: '', label: '', imageUrl: '' },
      ],
    })
    vi.mocked(parseRelativeTime).mockReturnValue(null)

    const res = await GET(makeRequest('Bearer test-secret'))
    const body = await res.json()

    // processedData.filter(Boolean) で除外され INSERT なし
    expect(body.results[0].salesInserted).toBe(0)
    expect(body.results[0].salesSkipped).toBe(0)
  })

  it('normalizeGrade が null を返す場合はそのアイテムをスキップする', async () => {
    setupMocks({
      historyItems: [
        { price: 5000, date: '2時間前', condition: '不明グレード', size: '', label: '', imageUrl: '' },
      ],
    })
    vi.mocked(parseRelativeTime).mockReturnValue(new Date('2026-01-15T08:00:00.000Z'))
    vi.mocked(normalizeGrade).mockReturnValue(null)

    const res = await GET(makeRequest('Bearer test-secret'))
    const body = await res.json()

    expect(body.results[0].salesInserted).toBe(0)
    expect(body.results[0].salesSkipped).toBe(0)
  })

  it('price が 0 の場合はそのアイテムをスキップする', async () => {
    setupMocks({
      historyItems: [
        { price: 0, date: '1時間前', condition: 'B', size: '', label: '', imageUrl: '' },
      ],
    })
    vi.mocked(parseRelativeTime).mockReturnValue(new Date('2026-01-15T09:00:00.000Z'))
    vi.mocked(normalizeGrade).mockReturnValue('B')

    const res = await GET(makeRequest('Bearer test-secret'))
    const body = await res.json()

    expect(body.results[0].salesInserted).toBe(0)
    expect(body.results[0].salesSkipped).toBe(0)
  })

  it('user_icon_number あり: grade/price/icon/sold_at がすべて一致（10分以内）なら重複スキップ', async () => {
    const soldAt = '2026-01-15T10:02:00.000Z' // 2分差

    setupMocks({
      historyItems: [
        { price: 8000, date: '30分前', condition: 'A', size: '', label: '', imageUrl: 'https://cdn.snkrdunk.com/user-icon-5.png' },
      ],
      existingItems: [
        { grade: 'A', price: 8000, sold_at: soldAt, user_icon_number: 5 },
      ],
    })
    vi.mocked(parseRelativeTime).mockReturnValue(new Date('2026-01-15T10:00:00.000Z'))
    vi.mocked(normalizeGrade).mockReturnValue('A')

    const res = await GET(makeRequest('Bearer test-secret'))
    const body = await res.json()

    expect(body.results[0].salesSkipped).toBe(1)
    expect(body.results[0].salesInserted).toBe(0)
  })

  it('user_icon_number なし: grade/price/sold_at が一致（10分以内）かつ既存もiconなしなら重複スキップ', async () => {
    const soldAt = '2026-01-15T10:03:00.000Z' // 3分差

    setupMocks({
      historyItems: [
        { price: 3000, date: '1時間前', condition: 'C', size: '', label: '', imageUrl: '' },
      ],
      existingItems: [
        { grade: 'C', price: 3000, sold_at: soldAt, user_icon_number: null },
      ],
    })
    vi.mocked(parseRelativeTime).mockReturnValue(new Date('2026-01-15T10:00:00.000Z'))
    vi.mocked(normalizeGrade).mockReturnValue('C')

    const res = await GET(makeRequest('Bearer test-secret'))
    const body = await res.json()

    expect(body.results[0].salesSkipped).toBe(1)
  })

  it('バッチ INSERT でユニーク制約違反（23505）→ 1件ずつフォールバック INSERT', async () => {
    const insertMock = vi.fn()
      // 1回目（バッチ）: ユニーク制約違反
      .mockResolvedValueOnce({ error: { code: '23505', message: 'duplicate key value' } })
      // 2回目（フォールバック: 1件目）: 成功
      .mockResolvedValueOnce({ error: null })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'card_sale_urls') {
        return {
          select: () => ({
            like: () => ({
              or: () => ({
                order: () => ({
                  limit: () => Promise.resolve({ data: [BASE_SALE_URL], error: null }),
                }),
              }),
            }),
          }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        }
      }
      if (table === 'snkrdunk_sales_history') {
        return {
          select: makeSalesHistorySelectChain([]),
          insert: insertMock,
        }
      }
      if (table === 'sale_prices') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) }
      }
      return makeQueryBuilder()
    })

    vi.mocked(getSalesHistory).mockResolvedValue({
      history: [{ price: 2000, date: '1時間前', condition: 'B', size: '', label: '', imageUrl: '' }],
      minPrice: null,
    })
    vi.mocked(parseRelativeTime).mockReturnValue(new Date('2026-01-15T10:00:00.000Z'))
    vi.mocked(normalizeGrade).mockReturnValue('B')

    const res = await GET(makeRequest('Bearer test-secret'))
    const body = await res.json()

    // バッチ失敗 → 個別INSERT 1件成功
    expect(insertMock).toHaveBeenCalledTimes(2)
    expect(body.results[0].salesInserted).toBe(1)
  })

  it('INSERT でその他のエラーが返った場合もスキップカウントを増やす', async () => {
    setupMocks({
      historyItems: [
        { price: 4000, date: '2時間前', condition: 'A', size: '', label: '', imageUrl: '' },
      ],
      insertResult: { error: { code: '42501', message: 'permission denied' } },
    })
    vi.mocked(parseRelativeTime).mockReturnValue(new Date('2026-01-15T09:00:00.000Z'))
    vi.mocked(normalizeGrade).mockReturnValue('A')

    const res = await GET(makeRequest('Bearer test-secret'))
    const body = await res.json()

    expect(body.results[0].salesSkipped).toBe(1)
    expect(body.results[0].salesInserted).toBe(0)
  })

  it('BOX 商品は item.size をグレードソースとして使う', async () => {
    // isBox=true の商品情報を返す
    vi.mocked(getProductInfo).mockResolvedValue({
      id: 99999,
      productNumber: 'BOX-001',
      name: 'Test Box',
      localizedName: 'テストBOX',
      minPrice: 50000,
      totalListingCount: 3,
      isSingleCard: false,
      isBox: true,
      category: 'trading-card-box-pack',
      imageUrl: null,
    })

    const { insertMock } = setupMocks({
      historyItems: [
        { price: 50000, date: '3時間前', condition: '', size: '1個', label: '', imageUrl: '' },
      ],
    })
    vi.mocked(parseRelativeTime).mockReturnValue(new Date('2026-01-15T07:00:00.000Z'))
    vi.mocked(normalizeGrade).mockReturnValue('1個')
    vi.mocked(getBoxSizes).mockResolvedValue([])

    const res = await GET(makeRequest('Bearer test-secret'))
    const body = await res.json()

    // BOX の場合 normalizeGrade には item.size ('1個') が渡される
    expect(normalizeGrade).toHaveBeenCalledWith('1個')
    // バッチINSERT（配列）
    expect(insertMock).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          grade: '1個',
          product_type: 'box',
        }),
      ])
    )
  })

  it('複数のアイテムで一部が重複・一部が新規の場合を正しくカウントする', async () => {
    const existing = [
      { grade: 'A', price: 5000, sold_at: '2026-01-15T10:01:00.000Z', user_icon_number: 10 },
    ]

    setupMocks({
      historyItems: [
        // 重複: grade=A, price=5000, icon=10, 1分差
        { price: 5000, date: '30分前', condition: 'A', size: '', label: '', imageUrl: 'https://cdn.snkrdunk.com/user-icon-10.png' },
        // 新規: grade=B, price=3000
        { price: 3000, date: '1時間前', condition: 'B', size: '', label: '', imageUrl: 'https://cdn.snkrdunk.com/user-icon-2.png' },
      ],
      existingItems: existing,
    })

    // 1件目は10:00→重複（sold_at 2026-01-15T10:01:00 と比較）
    // 2件目は09:00→新規
    let callCount = 0
    vi.mocked(parseRelativeTime).mockImplementation(() => {
      callCount++
      return callCount === 1
        ? new Date('2026-01-15T10:00:00.000Z')
        : new Date('2026-01-15T09:00:00.000Z')
    })
    vi.mocked(normalizeGrade).mockImplementation((g: string) => {
      if (g === 'A') return 'A'
      if (g === 'B') return 'B'
      return null
    })

    const res = await GET(makeRequest('Bearer test-secret'))
    const body = await res.json()

    expect(body.results[0].salesInserted).toBe(1)
    expect(body.results[0].salesSkipped).toBe(1)
  })
})

// ============================================================================
// 4. syncListingPrices — グレード別最安値の抽出と sale_prices へのバッチ INSERT
// ============================================================================

describe('syncListingPrices (出品最安値同期)', () => {
  function setupListingMocks({
    singleListings = [] as any[],
    gradePrices = [] as any[],
    boxSizes = [] as any[],
    isBox = false,
    salePricesInsertResult = { error: null } as any,
  } = {}) {
    const salePricesInsertMock = vi.fn().mockResolvedValue(salePricesInsertResult)

    mockFrom.mockImplementation((table: string) => {
      if (table === 'card_sale_urls') {
        return {
          select: () => ({
            like: () => ({
              or: () => ({
                order: () => ({
                  limit: () => Promise.resolve({ data: [BASE_SALE_URL], error: null }),
                }),
              }),
            }),
          }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        }
      }
      if (table === 'snkrdunk_sales_history') {
        return {
          select: makeSalesHistorySelectChain([]),
          insert: vi.fn().mockResolvedValue({ error: null }),
        }
      }
      if (table === 'sale_prices') {
        return { insert: salePricesInsertMock }
      }
      return makeQueryBuilder()
    })

    vi.mocked(getSalesHistory).mockResolvedValue({ history: [], minPrice: null })
    vi.mocked(getAllListings).mockResolvedValue(singleListings)
    vi.mocked(extractGradePrices).mockReturnValue(gradePrices)
    vi.mocked(getBoxSizes).mockResolvedValue(boxSizes)

    if (isBox) {
      vi.mocked(getProductInfo).mockResolvedValue({
        id: 12345, productNumber: '', name: '', localizedName: '',
        minPrice: null, totalListingCount: 0,
        isSingleCard: false, isBox: true,
        category: 'trading-card-box-pack', imageUrl: null,
      })
    }

    return { salePricesInsertMock }
  }

  it('シングル: 出品一覧から全体最安値 + グレード別をバッチ INSERT する', async () => {
    const { salePricesInsertMock } = setupListingMocks({
      singleListings: [
        { id: 1, price: 3000, condition: 'A', size: '', status: '', note: '', accessoriesNote: null, createdAt: '', updatedAt: '', imageUrl: null },
        { id: 2, price: 2500, condition: 'B', size: '', status: '', note: '', accessoriesNote: null, createdAt: '', updatedAt: '', imageUrl: null },
        { id: 3, price: 4000, condition: 'A', size: '', status: '', note: '', accessoriesNote: null, createdAt: '', updatedAt: '', imageUrl: null },
      ],
      gradePrices: [
        { grade: 'A', price: 3000, stock: 2, topPrices: [3000, 4000] },
        { grade: 'B', price: 2500, stock: 1, topPrices: [2500] },
      ],
    })

    const res = await GET(makeRequest('Bearer test-secret'))
    const body = await res.json()

    // バッチ INSERT（配列1回）
    expect(salePricesInsertMock).toHaveBeenCalledTimes(1)
    const insertedRows = salePricesInsertMock.mock.calls[0][0]
    expect(Array.isArray(insertedRows)).toBe(true)

    // 全体最安値行
    const overallRow = insertedRows.find((r: any) => r.grade === null)
    expect(overallRow).toBeDefined()
    expect(overallRow.price).toBe(2500)
    expect(overallRow.stock).toBe(3)

    // グレード別行
    const gradeARow = insertedRows.find((r: any) => r.grade === 'A')
    expect(gradeARow).toBeDefined()
    expect(gradeARow.price).toBe(3000)

    const gradeBRow = insertedRows.find((r: any) => r.grade === 'B')
    expect(gradeBRow).toBeDefined()
    expect(gradeBRow.price).toBe(2500)

    expect(body.results[0].overallMin).toBe(2500)
    expect(body.results[0].totalListings).toBe(3)
    expect(body.results[0].gradePrices).toBe(2)
  })

  it('シングル: 出品が0件のとき sale_prices に INSERT しない', async () => {
    const { salePricesInsertMock } = setupListingMocks({ singleListings: [] })

    const res = await GET(makeRequest('Bearer test-secret'))
    const body = await res.json()

    expect(salePricesInsertMock).not.toHaveBeenCalled()
    expect(body.results[0].overallMin).toBeNull()
    expect(body.results[0].totalListings).toBe(0)
  })

  it('BOX: 1個サイズが存在する場合はそのminPriceをoverallMinとして使用する', async () => {
    const { salePricesInsertMock } = setupListingMocks({
      isBox: true,
      boxSizes: [
        { sizeId: 1, name: '1個', quantity: 1, minPrice: 80000, listingCount: 3 },
        { sizeId: 2, name: '2個', quantity: 2, minPrice: 150000, listingCount: 1 },
      ],
    })

    const res = await GET(makeRequest('Bearer test-secret'))
    const body = await res.json()

    // バッチ INSERT
    expect(salePricesInsertMock).toHaveBeenCalledTimes(1)
    const insertedRows = salePricesInsertMock.mock.calls[0][0]

    // 全体最安値
    const overallRow = insertedRows.find((r: any) => r.grade === null)
    expect(overallRow.price).toBe(80000)

    // BOXグレード
    const boxRow = insertedRows.find((r: any) => r.grade === 'BOX')
    expect(boxRow.price).toBe(80000)

    expect(body.results[0].overallMin).toBe(80000)
    expect(body.results[0].totalListings).toBe(4) // 3+1
  })

  it('BOX: 1個サイズがない場合は最安のサイズを使用する', async () => {
    const { salePricesInsertMock } = setupListingMocks({
      isBox: true,
      boxSizes: [
        { sizeId: 2, name: '2個', quantity: 2, minPrice: 150000, listingCount: 5 },
        { sizeId: 3, name: '3個', quantity: 3, minPrice: 120000, listingCount: 2 },
      ],
    })

    const res = await GET(makeRequest('Bearer test-secret'))
    const body = await res.json()

    // 最安は 120000（3個）
    expect(body.results[0].overallMin).toBe(120000)

    const insertedRows = salePricesInsertMock.mock.calls[0][0]
    const boxRow = insertedRows.find((r: any) => r.grade === 'BOX')
    expect(boxRow.price).toBe(120000)
  })

  it('BOX: サイズ一覧が空のとき sale_prices に INSERT しない', async () => {
    const { salePricesInsertMock } = setupListingMocks({
      isBox: true,
      boxSizes: [],
    })

    const res = await GET(makeRequest('Bearer test-secret'))
    const body = await res.json()

    expect(salePricesInsertMock).not.toHaveBeenCalled()
    expect(body.results[0].overallMin).toBeNull()
  })

  it('sale_prices バッチINSERTで top_prices カラムエラー（42703）→ top_prices除去してリトライ', async () => {
    const salePricesInsertMock = vi.fn()
      // 1回目（バッチ全体）: top_prices エラー
      .mockResolvedValueOnce({ error: { code: '42703', message: 'column "top_prices" does not exist' } })
      // 2回目（フォールバック）: 成功
      .mockResolvedValueOnce({ error: null })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'card_sale_urls') {
        return {
          select: () => ({
            like: () => ({
              or: () => ({
                order: () => ({
                  limit: () => Promise.resolve({ data: [BASE_SALE_URL], error: null }),
                }),
              }),
            }),
          }),
          update: () => ({ eq: () => Promise.resolve({ error: null }) }),
        }
      }
      if (table === 'snkrdunk_sales_history') {
        return {
          select: makeSalesHistorySelectChain([]),
          insert: vi.fn().mockResolvedValue({ error: null }),
        }
      }
      if (table === 'sale_prices') {
        return { insert: salePricesInsertMock }
      }
      return makeQueryBuilder()
    })

    vi.mocked(getAllListings).mockResolvedValue([
      { id: 1, price: 5000, condition: 'A', size: '', status: '', note: '', accessoriesNote: null, createdAt: '', updatedAt: '', imageUrl: null },
    ])
    vi.mocked(extractGradePrices).mockReturnValue([
      { grade: 'A', price: 5000, stock: 1, topPrices: [5000] },
    ])

    await GET(makeRequest('Bearer test-secret'))

    // 2回呼ばれる: バッチ(失敗) + フォールバック(成功)
    expect(salePricesInsertMock).toHaveBeenCalledTimes(2)
    // フォールバック呼び出しには top_prices なし
    const fallbackRows = salePricesInsertMock.mock.calls[1][0]
    for (const row of fallbackRows) {
      expect(row).not.toHaveProperty('top_prices')
    }
  })

  it('grade が price=0 以下のエントリは INSERT しない', async () => {
    const { salePricesInsertMock } = setupListingMocks({
      singleListings: [
        { id: 1, price: 1000, condition: 'A', size: '', status: '', note: '', accessoriesNote: null, createdAt: '', updatedAt: '', imageUrl: null },
      ],
      gradePrices: [
        { grade: 'A', price: 1000, stock: 1, topPrices: [1000] },
        { grade: 'B', price: 0, stock: 0, topPrices: [] },     // price=0 → スキップ
      ],
    })

    await GET(makeRequest('Bearer test-secret'))

    // バッチINSERT の中身を検査
    const insertedRows = salePricesInsertMock.mock.calls[0][0]
    const bInsert = insertedRows.find((r: any) => r.grade === 'B')
    expect(bInsert).toBeUndefined()
  })
})

// ============================================================================
// 5. GET handler — 認証チェック / cron-gate / バッチ処理フロー
// ============================================================================

describe('GET handler', () => {
  describe('認証チェック', () => {
    it('Authorization ヘッダーがない場合は 401 を返す', async () => {
      const res = await GET(makeRequest())
      expect(res.status).toBe(401)
      expect(await res.text()).toBe('Unauthorized')
    })

    it('Authorization ヘッダーが誤っている場合は 401 を返す', async () => {
      const res = await GET(makeRequest('Bearer wrong-secret'))
      expect(res.status).toBe(401)
    })

    it('Authorization ヘッダーが正しい場合は処理を続行する', async () => {
      mockFrom.mockReturnValue({
        select: () => ({
          like: () => ({
            or: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        }),
        update: () => ({ eq: () => Promise.resolve({ error: null }) }),
      })

      const res = await GET(makeRequest('Bearer test-secret'))
      expect(res.status).not.toBe(401)
    })

    it('CRON_SECRET が未設定の場合は空文字と比較するため 401 になる', async () => {
      delete process.env.CRON_SECRET
      const res = await GET(makeRequest('Bearer test-secret'))
      expect(res.status).toBe(401)
    })
  })

  describe('cron-gate', () => {
    beforeEach(() => {
      vi.mocked(shouldRunCronJob).mockResolvedValue({ shouldRun: false, reason: 'disabled' })
    })

    it('cron-gate がスキップを返した場合は skipped:true を返す', async () => {
      const res = await GET(makeRequest('Bearer test-secret'))
      const body = await res.json()

      expect(body.skipped).toBe(true)
      expect(body.reason).toBe('disabled')
    })

    it('cron-gate スキップ時は Supabase の card_sale_urls を取得しない', async () => {
      await GET(makeRequest('Bearer test-secret'))

      expect(mockFrom).not.toHaveBeenCalled()
    })
  })

  describe('URLフェッチエラー', () => {
    it('card_sale_urls の取得でエラーが発生した場合は 500 を返す', async () => {
      mockFrom.mockReturnValue({
        select: () => ({
          like: () => ({
            or: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: null, error: { message: 'DB connection failed' } }),
              }),
            }),
          }),
        }),
      })

      const res = await GET(makeRequest('Bearer test-secret'))
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body.success).toBe(false)
      expect(body.error).toBe('DB connection failed')
    })

    it('card_sale_urls の取得でエラー時は markCronJobRun に "error" を渡す', async () => {
      mockFrom.mockReturnValue({
        select: () => ({
          like: () => ({
            or: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: null, error: { message: 'timeout' } }),
              }),
            }),
          }),
        }),
      })

      await GET(makeRequest('Bearer test-secret'))

      expect(markCronJobRun).toHaveBeenCalledWith('snkrdunk-sync', 'error', 'timeout')
    })
  })

  describe('処理対象URLなし', () => {
    beforeEach(() => {
      mockFrom.mockReturnValue({
        select: () => ({
          like: () => ({
            or: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        }),
      })
    })

    it('対象URLが0件の場合は processed:0 を返す', async () => {
      const res = await GET(makeRequest('Bearer test-secret'))
      const body = await res.json()

      expect(body.success).toBe(true)
      expect(body.processed).toBe(0)
      expect(body.message).toBe('No URLs to sync')
    })

    it('対象URLが0件でも markCronJobRun に "success" を渡す', async () => {
      await GET(makeRequest('Bearer test-secret'))

      expect(markCronJobRun).toHaveBeenCalledWith('snkrdunk-sync', 'success')
    })
  })

  describe('バッチ処理フロー', () => {
    it('処理成功時に processed と results を返す', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'card_sale_urls') {
          return {
            select: () => ({
              like: () => ({
                or: () => ({
                  order: () => ({
                    limit: () => Promise.resolve({ data: [BASE_SALE_URL], error: null }),
                  }),
                }),
              }),
            }),
            update: () => ({ eq: () => Promise.resolve({ error: null }) }),
          }
        }
        if (table === 'snkrdunk_sales_history') {
          return {
            select: makeSalesHistorySelectChain([]),
            insert: vi.fn().mockResolvedValue({ error: null }),
          }
        }
        if (table === 'sale_prices') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) }
        }
        return makeQueryBuilder()
      })

      const res = await GET(makeRequest('Bearer test-secret'))
      const body = await res.json()

      expect(body.success).toBe(true)
      expect(body.processed).toBe(1)
      expect(body.results).toHaveLength(1)
      expect(body.results[0].status).toBe('success')
      expect(body.results[0].cardName).toBe('テストカード')
    })

    it('成功時は card_sale_urls を success ステータスで更新する', async () => {
      const updateMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })

      mockFrom.mockImplementation((table: string) => {
        if (table === 'card_sale_urls') {
          return {
            select: () => ({
              like: () => ({
                or: () => ({
                  order: () => ({
                    limit: () => Promise.resolve({ data: [BASE_SALE_URL], error: null }),
                  }),
                }),
              }),
            }),
            update: updateMock,
          }
        }
        if (table === 'snkrdunk_sales_history') {
          return {
            select: makeSalesHistorySelectChain([]),
            insert: vi.fn().mockResolvedValue({ error: null }),
          }
        }
        if (table === 'sale_prices') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) }
        }
        return makeQueryBuilder()
      })

      await GET(makeRequest('Bearer test-secret'))

      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          last_scrape_status: 'success',
          last_scrape_error: null,
          apparel_id: 12345,
          error_count: 0,
        })
      )
    })

    it('カード処理でエラーが発生した場合は error ステータスで card_sale_urls を更新する', async () => {
      const updateMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })

      mockFrom.mockImplementation((table: string) => {
        if (table === 'card_sale_urls') {
          return {
            select: () => ({
              like: () => ({
                or: () => ({
                  order: () => ({
                    limit: () => Promise.resolve({ data: [BASE_SALE_URL], error: null }),
                  }),
                }),
              }),
            }),
            update: updateMock,
          }
        }
        return makeQueryBuilder()
      })

      // extractApparelId を null にして Invalid URL エラーを引き起こす
      vi.mocked(extractApparelId).mockReturnValue(null)

      const res = await GET(makeRequest('Bearer test-secret'))
      const body = await res.json()

      expect(body.results[0].status).toBe('error')
      expect(body.results[0].error).toContain('Invalid URL')
      expect(updateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          last_scrape_status: 'error',
          last_scrape_error: expect.stringContaining('Invalid URL'),
          error_count: 1,
        })
      )
    })

    it('カード処理エラー時の next_scrape_at はエクスポネンシャルバックオフ（初回60分後）になる', async () => {
      const updateEqMock = vi.fn().mockResolvedValue({ error: null })
      const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock })

      mockFrom.mockImplementation((table: string) => {
        if (table === 'card_sale_urls') {
          return {
            select: () => ({
              like: () => ({
                or: () => ({
                  order: () => ({
                    limit: () => Promise.resolve({
                      data: [{ ...BASE_SALE_URL, error_count: 0 }],
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
            update: updateMock,
          }
        }
        return makeQueryBuilder()
      })

      vi.mocked(extractApparelId).mockReturnValue(null)

      const before = Date.now()
      await GET(makeRequest('Bearer test-secret'))
      const after = Date.now()

      const updateArg = updateMock.mock.calls[0][0]
      const nextScrapeAt = new Date(updateArg.next_scrape_at).getTime()

      // ERROR_BASE_RETRY_MINUTES = 60, error_count=0+1=1, calculateErrorRetryMinutes(1) = 60 * 2^1 = 120分
      const expectedMin = before + 120 * 60 * 1000
      const expectedMax = after + 120 * 60 * 1000

      expect(nextScrapeAt).toBeGreaterThanOrEqual(expectedMin)
      expect(nextScrapeAt).toBeLessThanOrEqual(expectedMax)
    })

    it('全カードの処理後に markCronJobRun("success") が呼ばれる', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'card_sale_urls') {
          return {
            select: () => ({
              like: () => ({
                or: () => ({
                  order: () => ({
                    limit: () => Promise.resolve({ data: [BASE_SALE_URL], error: null }),
                  }),
                }),
              }),
            }),
            update: () => ({ eq: () => Promise.resolve({ error: null }) }),
          }
        }
        if (table === 'snkrdunk_sales_history') {
          return {
            select: makeSalesHistorySelectChain([]),
            insert: vi.fn().mockResolvedValue({ error: null }),
          }
        }
        if (table === 'sale_prices') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) }
        }
        return makeQueryBuilder()
      })

      await GET(makeRequest('Bearer test-secret'))

      expect(markCronJobRun).toHaveBeenCalledWith('snkrdunk-sync', 'success')
    })

    it('予期しない例外が発生した場合は 500 を返し markCronJobRun("error") を呼ぶ', async () => {
      vi.mocked(shouldRunCronJob).mockRejectedValue(new Error('Unexpected failure'))

      const res = await GET(makeRequest('Bearer test-secret'))
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body.success).toBe(false)
      expect(body.error).toBe('Unexpected failure')
      expect(markCronJobRun).toHaveBeenCalledWith('snkrdunk-sync', 'error', 'Unexpected failure')
    })

    it('成功時の next_scrape_at は SYNC_INTERVAL_MINUTES（120分後）になる', async () => {
      const updateEqMock = vi.fn().mockResolvedValue({ error: null })
      const updateMock = vi.fn().mockReturnValue({ eq: updateEqMock })

      mockFrom.mockImplementation((table: string) => {
        if (table === 'card_sale_urls') {
          return {
            select: () => ({
              like: () => ({
                or: () => ({
                  order: () => ({
                    limit: () => Promise.resolve({ data: [BASE_SALE_URL], error: null }),
                  }),
                }),
              }),
            }),
            update: updateMock,
          }
        }
        if (table === 'snkrdunk_sales_history') {
          return {
            select: makeSalesHistorySelectChain([]),
            insert: vi.fn().mockResolvedValue({ error: null }),
          }
        }
        if (table === 'sale_prices') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) }
        }
        return makeQueryBuilder()
      })

      const before = Date.now()
      await GET(makeRequest('Bearer test-secret'))
      const after = Date.now()

      const updateArg = updateMock.mock.calls[0][0]
      const nextScrapeAt = new Date(updateArg.next_scrape_at).getTime()

      // SYNC_INTERVAL_MINUTES = 120分
      const expectedMin = before + 120 * 60 * 1000
      const expectedMax = after + 120 * 60 * 1000

      expect(nextScrapeAt).toBeGreaterThanOrEqual(expectedMin)
      expect(nextScrapeAt).toBeLessThanOrEqual(expectedMax)
    })
  })

  describe('エッジケース', () => {
    it('card.name が null の場合も results に cardName: undefined が含まれる（エラーにならない）', async () => {
      const saleUrlWithoutCard = { ...BASE_SALE_URL, card: null }

      mockFrom.mockImplementation((table: string) => {
        if (table === 'card_sale_urls') {
          return {
            select: () => ({
              like: () => ({
                or: () => ({
                  order: () => ({
                    limit: () => Promise.resolve({ data: [saleUrlWithoutCard], error: null }),
                  }),
                }),
              }),
            }),
            update: () => ({ eq: () => Promise.resolve({ error: null }) }),
          }
        }
        if (table === 'snkrdunk_sales_history') {
          return {
            select: makeSalesHistorySelectChain([]),
            insert: vi.fn().mockResolvedValue({ error: null }),
          }
        }
        if (table === 'sale_prices') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) }
        }
        return makeQueryBuilder()
      })

      const res = await GET(makeRequest('Bearer test-secret'))
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.results).toHaveLength(1)
    })

    it('product_type がキャッシュ済みなら getProductInfo をスキップする', async () => {
      const saleUrlWithCachedType = { ...BASE_SALE_URL, product_type: 'single', apparel_id: 12345 }

      mockFrom.mockImplementation((table: string) => {
        if (table === 'card_sale_urls') {
          return {
            select: () => ({
              like: () => ({
                or: () => ({
                  order: () => ({
                    limit: () => Promise.resolve({ data: [saleUrlWithCachedType], error: null }),
                  }),
                }),
              }),
            }),
            update: () => ({ eq: () => Promise.resolve({ error: null }) }),
          }
        }
        if (table === 'snkrdunk_sales_history') {
          return {
            select: makeSalesHistorySelectChain([]),
            insert: vi.fn().mockResolvedValue({ error: null }),
          }
        }
        if (table === 'sale_prices') {
          return { insert: vi.fn().mockResolvedValue({ error: null }) }
        }
        return makeQueryBuilder()
      })

      await GET(makeRequest('Bearer test-secret'))

      // product_type がキャッシュ済みなので getProductInfo は呼ばれない
      expect(getProductInfo).not.toHaveBeenCalled()
    })

    it('calculateErrorRetryMinutes: error_count増加でバックオフが効く', async () => {
      const updateMock = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) })
      const saleUrlWithErrors = { ...BASE_SALE_URL, error_count: 2 }

      mockFrom.mockImplementation((table: string) => {
        if (table === 'card_sale_urls') {
          return {
            select: () => ({
              like: () => ({
                or: () => ({
                  order: () => ({
                    limit: () => Promise.resolve({ data: [saleUrlWithErrors], error: null }),
                  }),
                }),
              }),
            }),
            update: updateMock,
          }
        }
        return makeQueryBuilder()
      })

      vi.mocked(extractApparelId).mockReturnValue(null)

      const before = Date.now()
      await GET(makeRequest('Bearer test-secret'))
      const after = Date.now()

      const updateArg = updateMock.mock.calls[0][0]
      // error_count=2+1=3, calculateErrorRetryMinutes(3) = 60 * 2^3 = 480 → capped at 360
      expect(updateArg.error_count).toBe(3)
      const nextScrapeAt = new Date(updateArg.next_scrape_at).getTime()
      const expectedMin = before + 360 * 60 * 1000
      const expectedMax = after + 360 * 60 * 1000
      expect(nextScrapeAt).toBeGreaterThanOrEqual(expectedMin)
      expect(nextScrapeAt).toBeLessThanOrEqual(expectedMax)
    })
  })
})
