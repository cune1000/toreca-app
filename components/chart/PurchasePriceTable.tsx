'use client'

import { PurchaseShopPrice } from '@/lib/chart/types'
import { formatPrice, formatRelativeTime } from '@/lib/chart/format'

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

    return (
        <div className="space-y-1.5">
            {prices.map((shop) => (
                <div
                    key={shop.shop_name}
                    className="flex items-center justify-between bg-white rounded-lg px-3 py-2.5 border border-gray-100"
                >
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-500">
                            {shop.shop_icon || shop.shop_name[0]}
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-800">{shop.shop_name}</p>
                            <p className="text-[10px] text-gray-400">
                                {formatRelativeTime(shop.updated_at)}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-sm font-bold text-gray-900">
                            {formatPrice(shop.price)}
                        </p>
                        {shop.change_pct !== undefined && shop.change_pct !== 0 && (
                            <p
                                className="text-[10px] font-medium"
                                style={{ color: shop.change_pct > 0 ? '#ef4444' : '#3b82f6' }}
                            >
                                {shop.change_pct > 0 ? '+' : ''}{shop.change_pct.toFixed(1)}%
                            </p>
                        )}
                    </div>
                </div>
            ))}
            <p className="text-[10px] text-gray-400 mt-2 text-center">
                ※ 買取価格は各店舗のX投稿から自動取得しています
            </p>
        </div>
    )
}
