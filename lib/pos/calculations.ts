// =============================================================================
// POS 利益計算ロジック
// =============================================================================

export interface ProfitResult {
    perUnit: number
    total: number
    rate: number // %
}

/** 利益計算 */
export function calculateProfit(
    sellPrice: number,
    avgPurchasePrice: number,
    quantity: number
): ProfitResult {
    const perUnit = sellPrice - avgPurchasePrice
    return {
        perUnit,
        total: perUnit * quantity,
        rate: avgPurchasePrice > 0
            ? Math.round((perUnit / avgPurchasePrice) * 10000) / 100
            : 0,
    }
}

/** 移動平均の再計算 */
export function recalcMovingAverage(
    currentAvg: number,
    currentTotal: number,
    newUnitPrice: number,
    newQuantity: number
): number {
    const newTotal = currentTotal + newQuantity
    if (newTotal === 0) return 0
    return Math.round(
        (currentAvg * currentTotal + newUnitPrice * newQuantity) / newTotal
    )
}
