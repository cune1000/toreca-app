/**
 * lib/scraping/helpers.ts — normalizeGrade のユニットテスト
 *
 * テスト対象:
 *   normalizeGrade(gradeText: string): string | null
 *
 * L78 修正内容:
 *   includes('A') → /^A([^A-Z]|$)/.test(cleaned)
 *   同様に B, C, D も修正。
 *   目的: "SEALED"/"DAMAGED" 等の英単語が一般グレード A/B/C/D に誤マッチする問題を防止。
 */

import { describe, it, expect } from 'vitest'
import { normalizeGrade } from '@/lib/scraping/helpers'

// ────────────────────────────────────────────────────────────────────────────
// 正常ケース — 単一グレード文字
// ────────────────────────────────────────────────────────────────────────────

describe('normalizeGrade — 正常ケース（単一グレード文字）', () => {
  it('"A" → "A"', () => {
    expect(normalizeGrade('A')).toBe('A')
  })

  it('"B" → "B"', () => {
    expect(normalizeGrade('B')).toBe('B')
  })

  it('"C" → "C"', () => {
    expect(normalizeGrade('C')).toBe('C')
  })

  it('"D" → "D"', () => {
    expect(normalizeGrade('D')).toBe('D')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// 正常ケース — PSA グレード
// ────────────────────────────────────────────────────────────────────────────

describe('normalizeGrade — PSA グレード', () => {
  it('"PSA10" → "PSA10"', () => {
    expect(normalizeGrade('PSA10')).toBe('PSA10')
  })

  it('"PSA9" → "PSA9"', () => {
    expect(normalizeGrade('PSA9')).toBe('PSA9')
  })

  it('"PSA8" → "PSA8以下"', () => {
    expect(normalizeGrade('PSA8')).toBe('PSA8以下')
  })

  it('"PSA7" → "PSA8以下"', () => {
    expect(normalizeGrade('PSA7')).toBe('PSA8以下')
  })

  it('"PSA6" → "PSA8以下"', () => {
    expect(normalizeGrade('PSA6')).toBe('PSA8以下')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// 正常ケース — BGS グレード
// ────────────────────────────────────────────────────────────────────────────

describe('normalizeGrade — BGS グレード', () => {
  it('"BGS10BL" → "BGS10BL"', () => {
    expect(normalizeGrade('BGS10BL')).toBe('BGS10BL')
  })

  it('"BGS10GL" → "BGS10GL"', () => {
    expect(normalizeGrade('BGS10GL')).toBe('BGS10GL')
  })

  it('"BGS9.5" → "BGS9.5"', () => {
    expect(normalizeGrade('BGS9.5')).toBe('BGS9.5')
  })

  it('"BGS9" → "BGS9以下"', () => {
    expect(normalizeGrade('BGS9')).toBe('BGS9以下')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// 正常ケース — ARS グレード
// ────────────────────────────────────────────────────────────────────────────

describe('normalizeGrade — ARS グレード', () => {
  it('"ARS10+" → "ARS10+"', () => {
    expect(normalizeGrade('ARS10+')).toBe('ARS10+')
  })

  it('"ARS10" → "ARS10"', () => {
    expect(normalizeGrade('ARS10')).toBe('ARS10')
  })

  it('"ARS9" → "ARS9"', () => {
    expect(normalizeGrade('ARS9')).toBe('ARS9')
  })

  it('"ARS8" → "ARS8以下"', () => {
    expect(normalizeGrade('ARS8')).toBe('ARS8以下')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// 正常ケース — 数量グレード（BOX / パック用）
// ────────────────────────────────────────────────────────────────────────────

describe('normalizeGrade — 数量グレード', () => {
  it('"1個" → "1個"', () => {
    expect(normalizeGrade('1個')).toBe('1個')
  })

  it('"2個" → "2個"', () => {
    expect(normalizeGrade('2個')).toBe('2個')
  })

  it('"10個" → "10個"', () => {
    expect(normalizeGrade('10個')).toBe('10個')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// 日本語混在ケース
// ────────────────────────────────────────────────────────────────────────────

describe('normalizeGrade — 日本語混在ケース', () => {
  // cleaned = "A（美品）" → /^A([^A-Z]|$)/ は先頭Aの直後が大文字A-Z以外（"（"）なのでマッチ
  it('"A（美品）" → "A"', () => {
    expect(normalizeGrade('A（美品）')).toBe('A')
  })

  it('"B（良品）" → "B"', () => {
    expect(normalizeGrade('B（良品）')).toBe('B')
  })

  it('"C（傷あり）" → "C"', () => {
    expect(normalizeGrade('C（傷あり）')).toBe('C')
  })

  it('"D（難あり）" → "D"', () => {
    expect(normalizeGrade('D（難あり）')).toBe('D')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// 大文字小文字の正規化
// ────────────────────────────────────────────────────────────────────────────

describe('normalizeGrade — 大文字小文字の正規化', () => {
  // cleaned = toUpperCase() 済みなので小文字入力もマッチする
  it('"psa10" → "PSA10"', () => {
    expect(normalizeGrade('psa10')).toBe('PSA10')
  })

  it('"a" → "A"', () => {
    expect(normalizeGrade('a')).toBe('A')
  })

  it('"b" → "B"', () => {
    expect(normalizeGrade('b')).toBe('B')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// 空白除去の正規化
// ────────────────────────────────────────────────────────────────────────────

describe('normalizeGrade — 空白除去の正規化', () => {
  it('"PSA 10"（スペースあり）→ "PSA10"', () => {
    expect(normalizeGrade('PSA 10')).toBe('PSA10')
  })

  it('" A "（前後スペース）→ "A"', () => {
    expect(normalizeGrade(' A ')).toBe('A')
  })

  it('"B　"（全角スペース）→ "B"', () => {
    // 全角スペース U+3000 は \s+ にマッチしないため cleaned = "B　" になる。
    // /^B([^A-Z]|$)/ は 'B' の直後が非大文字英字なのでマッチする。
    expect(normalizeGrade('B　')).toBe('B')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// 誤マッチ防止 — SEALED, DAMAGED 等の英単語
// ────────────────────────────────────────────────────────────────────────────

describe('normalizeGrade — 誤マッチ防止（修正の核心）', () => {
  // "SEALED" → cleaned = "SEALED"
  // 旧実装: includes('A') → 'A' に誤マッチ
  // 新実装: /^A([^A-Z]|$)/.test("SEALED") → false（先頭が'S'）→ null
  it('"SEALED" → null（Aへの誤マッチなし）', () => {
    expect(normalizeGrade('SEALED')).toBeNull()
  })

  // "DAMAGED" → cleaned = "DAMAGED"
  // 旧実装: includes('D') → 'D' に誤マッチ
  // 新実装: /^D([^A-Z]|$)/.test("DAMAGED") → false（先頭は'D'だが直後が大文字'A'）→ null
  it('"DAMAGED" → null（Dへの誤マッチなし）', () => {
    expect(normalizeGrade('DAMAGED')).toBeNull()
  })

  // "BLACKLABEL" → cleaned = "BLACKLABEL"
  // 旧実装: includes('B') → 'B' に誤マッチ
  // 新実装: /^B([^A-Z]|$)/.test("BLACKLABEL") → false（先頭'B'直後が大文字'L'）→ null
  it('"BLACKLABEL" → null（Bへの誤マッチなし）', () => {
    expect(normalizeGrade('BLACKLABEL')).toBeNull()
  })

  // "COMPLETE" → cleaned = "COMPLETE"
  // 旧実装: includes('C') → 'C' に誤マッチ
  // 新実装: /^C([^A-Z]|$)/.test("COMPLETE") → false（先頭'C'直後が大文字'O'）→ null
  it('"COMPLETE" → null（Cへの誤マッチなし）', () => {
    expect(normalizeGrade('COMPLETE')).toBeNull()
  })

  // "AUTHENTIC" → cleaned = "AUTHENTIC"
  // 先頭が 'A' ではなく includes('A') で旧実装はマッチしていた可能性あり。
  // 新実装: /^A([^A-Z]|$)/.test("AUTHENTIC") → false（先頭が'A'直後が大文字'U'）→ null
  it('"AUTHENTIC" → null（Aへの誤マッチなし）', () => {
    expect(normalizeGrade('AUTHENTIC')).toBeNull()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// 既知の有効な BGS / ARS グレードへの誤影響がないことを確認
// ────────────────────────────────────────────────────────────────────────────

describe('normalizeGrade — BGS/ARS は一般グレード判定より前に処理される', () => {
  // "BGS10BL" は cleaned に先頭'B'があるが、BGSチェックが先行するため 'B' に落ちない
  it('"BGS10BL" → "BGS10BL"（Bグレードに誤落ちしない）', () => {
    expect(normalizeGrade('BGS10BL')).toBe('BGS10BL')
  })

  // "ARS10+" は cleaned に先頭'A'があるが、ARSチェックが先行するため 'A' に落ちない
  it('"ARS10+" → "ARS10+"（Aグレードに誤落ちしない）', () => {
    expect(normalizeGrade('ARS10+')).toBe('ARS10+')
  })
})

// ────────────────────────────────────────────────────────────────────────────
// null / 空文字 / 非文字列 — ガード節のテスト
// ────────────────────────────────────────────────────────────────────────────

describe('normalizeGrade — null / 空文字 / 非文字列', () => {
  it('null → null', () => {
    // 型シグネチャは string だが、実装は null チェックを行っているため
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(normalizeGrade(null as any)).toBeNull()
  })

  it('空文字 "" → null', () => {
    expect(normalizeGrade('')).toBeNull()
  })

  it('undefined → null', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(normalizeGrade(undefined as any)).toBeNull()
  })

  it('数値 42 → null', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(normalizeGrade(42 as any)).toBeNull()
  })
})

// ────────────────────────────────────────────────────────────────────────────
// 未知グレード文字列 → null
// ────────────────────────────────────────────────────────────────────────────

describe('normalizeGrade — 未知グレード文字列', () => {
  it('"UNKNOWN" → null', () => {
    expect(normalizeGrade('UNKNOWN')).toBeNull()
  })

  it('"MINT" → null', () => {
    expect(normalizeGrade('MINT')).toBeNull()
  })

  it('"NM" → null', () => {
    expect(normalizeGrade('NM')).toBeNull()
  })

  it('"EX" → null', () => {
    expect(normalizeGrade('EX')).toBeNull()
  })

  it('"---" → null', () => {
    expect(normalizeGrade('---')).toBeNull()
  })
})
