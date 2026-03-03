/**
 * Snkrdunk スクレイピング用ヘルパー関数
 * 
 * 手動・自動スクレイピングの両方で使用される共通関数
 */

/**
 * 相対時刻または絶対日付をパースしてDateオブジェクトを返す
 * @param timeStr - "3日前", "2時間前", "25分前", "2026/01/17" など
 * @param baseTime - 相対時刻の基準となる日時
 * @returns パースされたDate、または失敗時はnull
 */
export function parseRelativeTime(timeStr: string, baseTime: Date): Date | null {
    if (!timeStr || typeof timeStr !== 'string') return null

    // 西暦表記のパターン（2026/01/17, 2025/11/25など）
    const absoluteDatePattern = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/
    const absoluteMatch = timeStr.match(absoluteDatePattern)
    if (absoluteMatch) {
        const year = parseInt(absoluteMatch[1], 10)
        const month = parseInt(absoluteMatch[2], 10) - 1 // 月は0-indexed
        const day = parseInt(absoluteMatch[3], 10)
        const result = new Date(year, month, day, 0, 0, 0, 0)
        return isNaN(result.getTime()) ? null : result
    }

    // 相対時刻のパターン（3日前、2時間前、5秒前、18h agoなど）
    const pattern = /(\d+)\s*(秒|分|時間|日|s|m|h|d|secs?|mins?|hours?|days?)\s*(前|ago)?/i
    const match = timeStr.match(pattern)
    if (!match) return null

    const value = parseInt(match[1], 10)
    const unit = match[2].toLowerCase()
    const result = new Date(baseTime)

    if (unit === '秒' || unit.startsWith('s')) {
        result.setSeconds(result.getSeconds() - value)
    } else if (unit === '分' || unit.startsWith('m')) {
        result.setMinutes(result.getMinutes() - value)
    } else if (unit === '時間' || unit.startsWith('h')) {
        result.setHours(result.getHours() - value)
    } else if (unit === '日' || unit.startsWith('d')) {
        result.setDate(result.getDate() - value)
    } else {
        return null
    }

    return result
}

/**
 * グレード文字列を正規化する
 * @param gradeText - "PSA10", "B", "1個" など
 * @returns 正規化されたグレード、または失敗時はnull
 */
export function normalizeGrade(gradeText: string): string | null {
    if (!gradeText || typeof gradeText !== 'string') return null
    const cleaned = gradeText.replace(/\s+/g, '').toUpperCase()

    // PSAグレード
    if (cleaned.includes('PSA10')) return 'PSA10'
    if (cleaned.includes('PSA9')) return 'PSA9'
    if (cleaned.includes('PSA8') || cleaned.includes('PSA7') || cleaned.includes('PSA6')) return 'PSA8以下'

    // BGSグレード
    if (cleaned.includes('BGS10BL')) return 'BGS10BL'
    if (cleaned.includes('BGS10GL')) return 'BGS10GL'
    if (cleaned.includes('BGS9.5')) return 'BGS9.5'
    if (cleaned.includes('BGS9')) return 'BGS9以下'

    // ARSグレード
    if (cleaned.includes('ARS10+')) return 'ARS10+'
    if (cleaned.includes('ARS10')) return 'ARS10'
    if (cleaned.includes('ARS9')) return 'ARS9'
    if (cleaned.includes('ARS8')) return 'ARS8以下'

    // 一般グレード（A, B, C, D）
    if (cleaned.includes('A') || cleaned === 'A') return 'A'
    if (cleaned.includes('B') || cleaned === 'B') return 'B'
    if (cleaned.includes('C') || cleaned === 'C') return 'C'
    if (cleaned.includes('D') || cleaned === 'D') return 'D'

    // BOX/パック用: 数量パターン (1個, 2個, 3個, など)
    const quantityMatch = gradeText.match(/(\d+)個/)
    if (quantityMatch) {
        return `${quantityMatch[1]}個`
    }

    return null
}

/**
 * スニダン出品一覧からグレード別最安値・在庫数・トップ3を抽出
 */
export interface GradePriceEntry {
    grade: string
    price: number
    stock: number
    topPrices: number[]
}

export function extractGradePrices(listings: { price: number; condition: string }[]): GradePriceEntry[] {
    const grades: { grade: string; filter: (c: string) => boolean }[] = [
        { grade: 'PSA10', filter: c => c.includes('PSA10') },
        {
            grade: 'A', filter: c =>
                (c.startsWith('A') || c.includes('A（')) &&
                !c.includes('PSA') && !c.includes('ARS') && !c.includes('BGS')
        },
        {
            grade: 'B', filter: c =>
                (c.startsWith('B') || c.includes('B（')) &&
                !c.includes('PSA') && !c.includes('ARS') && !c.includes('BGS')
        },
    ]

    const result: GradePriceEntry[] = []
    for (const { grade, filter } of grades) {
        const items = listings.filter(l => filter(l.condition))
        if (items.length > 0) {
            const sorted = [...items].sort((a, b) => a.price - b.price)
            result.push({
                grade,
                price: sorted[0].price,
                stock: sorted.length,
                topPrices: sorted.slice(0, 3).map(l => l.price),
            })
        }
    }
    return result
}

/**
 * 価格文字列をパースして数値を返す
 * @param priceText - "¥1,500", "1500" など
 * @returns パースされた価格、または失敗時はnull
 */
export function parsePrice(priceText: string): number | null {
    if (!priceText || typeof priceText !== 'string') return null
    const cleaned = priceText.replace(/[¥,]/g, '')
    const price = parseInt(cleaned, 10)
    return isNaN(price) ? null : price
}
