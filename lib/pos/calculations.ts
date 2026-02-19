// =============================================================================
// POS 利益計算ロジック
// =============================================================================

export interface ProfitResult {
    perUnit: number
    total: number
    rate: number // %
    expenseTotal: number
    netTotal: number
    netRate: number // %
}

/** 利益計算（経費別計算対応） */
export function calculateProfit(
    sellPrice: number,
    avgPurchasePrice: number,
    quantity: number,
    avgExpensePerUnit: number = 0
): ProfitResult {
    const perUnit = sellPrice - avgPurchasePrice
    const total = perUnit * quantity
    const expenseTotal = avgExpensePerUnit * quantity
    const netTotal = total - expenseTotal
    return {
        perUnit,
        total,
        rate: avgPurchasePrice > 0
            ? Math.round((perUnit / avgPurchasePrice) * 10000) / 100
            : 0,
        expenseTotal,
        netTotal,
        netRate: avgPurchasePrice > 0
            ? Math.round(((perUnit - avgExpensePerUnit) / avgPurchasePrice) * 10000) / 100
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
