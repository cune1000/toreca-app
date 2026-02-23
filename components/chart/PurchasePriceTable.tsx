'use client'

import { PurchaseShopPrice } from '@/lib/chart/types'
import { formatPrice, formatRelativeTime } from '@/lib/chart/format'

const CONDITION_STYLES: Record<string, { bg: string; text: string }> = {
    '素体': { bg: 'bg-blue-50', text: 'text-blue-600' },
    'PSA10': { bg: 'bg-purple-50', text: 'text-purple-600' },
    '未開封': { bg: 'bg-cyan-50', text: 'text-cyan-600' },
}

interface Props {
    prices: PurchaseShopPrice[]
}

export default function PurchasePriceTable({ prices }: Props) {
    if (prices.length === 0) {
        return (
            <div className="py-8 text-center text-gray-400 text-sm">
                買取価格データがありません
            </div>
        )
    }

    // 条件別にグループ化
    const grouped = new Map<string, PurchaseShopPrice[]>()
    for (const p of prices) {
        const cond = p.condition || '素体'
        if (!grouped.has(cond)) grouped.set(cond, [])
        grouped.get(cond)!.push(p)
    }

    // 表示順: 素体 → PSA10 → その他
    const order = ['素体', 'PSA10', '未開封']
    const sortedKeys = [...grouped.keys()].sort((a, b) => {
        const ai = order.indexOf(a)
        const bi = order.indexOf(b)
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })

    return (
        <div className="space-y-4">
            {sortedKeys.map(condition => {
                const items = grouped.get(condition)!
                const style = CONDITION_STYLES[condition] || { bg: 'bg-gray-50', text: 'text-gray-600' }

                return (
                    <div key={condition}>
                        <div className="flex items-center gap-2 mb-1.5">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${style.bg} ${style.text}`}>
                                {condition}
                            </span>
                            <span className="text-[10px] text-gray-400">{items.length}店舗</span>
                        </div>
                        <div className="space-y-1">
                            {items.map((shop, i) => (
                                <div
                                    key={`${shop.shop_name}-${i}`}
                                    className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100"
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-[10px] font-bold text-gray-500">
                                            {shop.shop_icon || shop.shop_name[0]}
                                        </div>
                                        <div>
                                            <p className="text-xs font-medium text-gray-800">{shop.shop_name}</p>
                                            <p className="text-[10px] text-gray-400">
                                                {formatRelativeTime(shop.updated_at)}
                                            </p>
                                        </div>
                                    </div>
                                    <p className="text-sm font-bold text-gray-900">
                                        {formatPrice(shop.price)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            })}
            <p className="text-[10px] text-gray-400 mt-2 text-center">
                ※ 買取価格は各店舗から自動取得しています
            </p>
        </div>
    )
}
