/**
 * スニダン チャートデータ異常値検出・補完ロジック
 *
 * 二段階フィルタ:
 *  Step 1: 同一日に複数取引がある場合 → 中央値を取る
 *  Step 2: Modified Z-Score（前後7日ローリング窓）で異常値検出
 *  Step 3: 異常値 → 前後5日中央値で補完
 */

export interface ChartPoint {
    date: number      // timestamp_ms
    price: number     // 元の価格
}

export interface CleanedChartPoint extends ChartPoint {
    priceCleaned: number  // 補完後の価格
    isAnomaly: boolean
}

/**
 * 中央値を計算
 */
function median(values: number[]): number {
    if (values.length === 0) return 0
    const sorted = [...values].sort((a, b) => a - b)
    const mid = Math.floor(sorted.length / 2)
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid]
}

/**
 * MAD (Median Absolute Deviation) を計算
 */
function mad(values: number[]): number {
    const med = median(values)
    const deviations = values.map(v => Math.abs(v - med))
    return median(deviations)
}

/**
 * Modified Z-Score を計算
 * Modified Z-Score = 0.6745 × (xi - median) / MAD
 * MAD = 0 の場合は 0 を返す（全データが同値）
 */
function modifiedZScore(value: number, med: number, madValue: number): number {
    if (madValue === 0) return 0
    return 0.6745 * (value - med) / madValue
}

/**
 * チャートデータの異常値検出・補完
 *
 * @param points - [timestamp_ms, price] のペア配列（APIレスポンスそのまま）
 * @param windowSize - ローリング窓サイズ（前後何日）。デフォルト7
 * @param threshold - Modified Z-Score の閾値。デフォルト3.5
 * @param interpolationWindow - 補完に使う前後日数。デフォルト5
 */
export function cleanChartData(
    points: [number, number][],
    windowSize: number = 7,
    threshold: number = 3.5,
    interpolationWindow: number = 5
): CleanedChartPoint[] {
    if (points.length === 0) return []

    // Step 1: 同一日のデータを中央値に集約（APIチャートは既に日次集計されているが念のため）
    const dayMap = new Map<string, number[]>()
    for (const [ts, price] of points) {
        const dayKey = new Date(ts).toISOString().slice(0, 10)
        if (!dayMap.has(dayKey)) dayMap.set(dayKey, [])
        dayMap.get(dayKey)!.push(price)
    }

    // 日次データに変換（同一日は中央値）
    const dailyPoints: ChartPoint[] = []
    // タイムスタンプも保持するため、元のpointsから日付→最初のタイムスタンプを取得
    const dayTimestamps = new Map<string, number>()
    for (const [ts] of points) {
        const dayKey = new Date(ts).toISOString().slice(0, 10)
        if (!dayTimestamps.has(dayKey)) dayTimestamps.set(dayKey, ts)
    }

    for (const [dayKey, prices] of dayMap) {
        dailyPoints.push({
            date: dayTimestamps.get(dayKey)!,
            price: Math.round(median(prices)),
        })
    }

    // 日付順にソート
    dailyPoints.sort((a, b) => a.date - b.date)

    if (dailyPoints.length < 5) {
        // データが少なすぎる場合は異常値検出をスキップ
        return dailyPoints.map(p => ({
            ...p,
            priceCleaned: p.price,
            isAnomaly: false,
        }))
    }

    // Step 2: Modified Z-Score（ローリング窓）で異常値検出
    const prices = dailyPoints.map(p => p.price)
    const anomalyFlags: boolean[] = new Array(prices.length).fill(false)

    for (let i = 0; i < prices.length; i++) {
        // 前後 windowSize 日の窓を構築
        const start = Math.max(0, i - windowSize)
        const end = Math.min(prices.length - 1, i + windowSize)
        const window = prices.slice(start, end + 1)

        const med = median(window)
        const madValue = mad(window)
        const zScore = modifiedZScore(prices[i], med, madValue)

        if (Math.abs(zScore) > threshold) {
            anomalyFlags[i] = true
        }
    }

    // Step 3: 異常値を前後 interpolationWindow 日の中央値で補完
    const result: CleanedChartPoint[] = dailyPoints.map((point, i) => {
        if (!anomalyFlags[i]) {
            return {
                ...point,
                priceCleaned: point.price,
                isAnomaly: false,
            }
        }

        // 前後 interpolationWindow 日の正常値を収集
        const start = Math.max(0, i - interpolationWindow)
        const end = Math.min(prices.length - 1, i + interpolationWindow)
        const normalValues: number[] = []
        for (let j = start; j <= end; j++) {
            if (j !== i && !anomalyFlags[j]) {
                normalValues.push(prices[j])
            }
        }

        const replacement = normalValues.length > 0
            ? Math.round(median(normalValues))
            : point.price  // 周辺に正常値がなければ元値を維持

        return {
            ...point,
            priceCleaned: replacement,
            isAnomaly: true,
        }
    })

    return result
}

/**
 * 条件ラベルの正規化
 * APIの salesChartOption.localizedName → DB保存用のキー
 */
export function normalizeConditionLabel(localizedName: string): string {
    // そのまま使う（"A", "B", "PSA10", "1個" 等）
    return localizedName.trim()
}
