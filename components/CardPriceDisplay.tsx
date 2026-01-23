'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { TrendingUp, TrendingDown, Minus, Package, Eye, EyeOff } from 'lucide-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface PriceData {
  source: string
  price: number
  stock: number
  condition: string
  recorded_at: string
}

interface DailyPrice {
  date: string
  avg_price: number
  min_price: number
  max_price: number
}

interface Props {
  cardId: string
  showSources?: boolean  // 内部用：サイト別表示するか
}

const SOURCE_NAMES: { [key: string]: string } = {
  snkrdunk: 'サイトA',
  torecacamp: 'サイトB',
  cardrush: 'サイトC',
}

// 公開用のサイト名（実名を隠す）
const PUBLIC_SOURCE_NAMES: { [key: string]: string } = {
  snkrdunk: 'サイトA',
  torecacamp: 'サイトB',
  cardrush: 'サイトC',
}

export default function CardPriceDisplay({ cardId, showSources = false }: Props) {
  const [loading, setLoading] = useState(true)
  const [latestPrices, setLatestPrices] = useState<PriceData[]>([])
  const [dailyPrices, setDailyPrices] = useState<DailyPrice[]>([])
  const [avgPrice, setAvgPrice] = useState<number | null>(null)
  const [priceChange, setPriceChange] = useState<number>(0)
  const [totalStock, setTotalStock] = useState<number>(0)

  useEffect(() => {
    if (cardId) {
      fetchPriceData()
    }
  }, [cardId])

  const fetchPriceData = async () => {
    setLoading(true)
    try {
      // 最新の価格（各サイトから）
      const { data: latest } = await supabase
        .from('sale_price_history')
        .select('source, price, stock, condition, recorded_at')
        .eq('card_id', cardId)
        .order('recorded_at', { ascending: false })
        .limit(20)

      if (latest) {
        // 各サイトの最新価格を取得
        const latestBySource: { [key: string]: PriceData } = {}
        latest.forEach(p => {
          if (!latestBySource[p.source]) {
            latestBySource[p.source] = p
          }
        })
        setLatestPrices(Object.values(latestBySource))

        // 平均価格を計算
        const prices = Object.values(latestBySource).map(p => p.price).filter(Boolean)
        if (prices.length > 0) {
          setAvgPrice(Math.round(prices.reduce((a, b) => a + b, 0) / prices.length))
        }

        // 在庫合計
        const stocks = Object.values(latestBySource).map(p => p.stock || 0)
        setTotalStock(stocks.reduce((a, b) => a + b, 0))
      }

      // 日別価格履歴（グラフ用）
      const { data: daily } = await supabase
        .from('sale_price_history')
        .select('recorded_at, price')
        .eq('card_id', cardId)
        .order('recorded_at', { ascending: true })

      if (daily && daily.length > 0) {
        // 日別に集計
        const byDate: { [key: string]: number[] } = {}
        daily.forEach(d => {
          const date = new Date(d.recorded_at).toISOString().split('T')[0]
          if (!byDate[date]) byDate[date] = []
          if (d.price) byDate[date].push(d.price)
        })

        const dailyData = Object.entries(byDate).map(([date, prices]) => ({
          date,
          avg_price: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
          min_price: Math.min(...prices),
          max_price: Math.max(...prices),
        }))

        setDailyPrices(dailyData)

        // 前日比を計算
        if (dailyData.length >= 2) {
          const today = dailyData[dailyData.length - 1].avg_price
          const yesterday = dailyData[dailyData.length - 2].avg_price
          setPriceChange(today - yesterday)
        }
      }
    } catch (err) {
      console.error('Price fetch error:', err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        <div className="h-32 bg-gray-200 rounded"></div>
      </div>
    )
  }

  if (!avgPrice && latestPrices.length === 0) {
    return (
      <div className="text-gray-500 text-center py-8">
        価格データがありません
      </div>
    )
  }

  // グラフの最大値・最小値を計算
  const allPrices = dailyPrices.flatMap(d => [d.min_price, d.max_price])
  const maxPrice = Math.max(...allPrices)
  const minPrice = Math.min(...allPrices)
  const priceRange = maxPrice - minPrice || 1

  return (
    <div className="space-y-6">
      {/* 平均価格（公開用） */}
      <div className="bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl p-6 text-white">
        <div className="text-sm opacity-80 mb-1">平均販売価格</div>
        <div className="flex items-end gap-4">
          <div className="text-4xl font-bold">
            ¥{avgPrice?.toLocaleString() || '---'}
          </div>
          {priceChange !== 0 && (
            <div className={`flex items-center gap-1 text-lg ${
              priceChange > 0 ? 'text-red-200' : 'text-green-200'
            }`}>
              {priceChange > 0 ? (
                <TrendingUp size={20} />
              ) : (
                <TrendingDown size={20} />
              )}
              <span>{priceChange > 0 ? '+' : ''}{priceChange.toLocaleString()}</span>
              <span className="text-sm opacity-80">前日比</span>
            </div>
          )}
        </div>
        <div className="mt-2 flex items-center gap-4 text-sm opacity-80">
          <span className="flex items-center gap-1">
            <Package size={16} />
            在庫: {totalStock}点
          </span>
          <span>{latestPrices.length}サイトから取得</span>
        </div>
      </div>

      {/* 価格推移グラフ */}
      {dailyPrices.length > 1 && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <h3 className="font-bold text-gray-700 mb-4">📈 価格推移</h3>
          <div className="h-40 flex items-end gap-1">
            {dailyPrices.slice(-14).map((day, i) => {
              const height = ((day.avg_price - minPrice) / priceRange) * 100 + 10
              const isToday = i === dailyPrices.slice(-14).length - 1
              
              return (
                <div
                  key={day.date}
                  className="flex-1 flex flex-col items-center"
                  title={`${day.date}: ¥${day.avg_price.toLocaleString()}`}
                >
                  <div
                    className={`w-full rounded-t transition-all ${
                      isToday ? 'bg-blue-500' : 'bg-blue-200 hover:bg-blue-300'
                    }`}
                    style={{ height: `${height}%` }}
                  />
                  <div className="text-xs text-gray-400 mt-1 truncate w-full text-center">
                    {new Date(day.date).getDate()}
                  </div>
                </div>
              )
            })}
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-2">
            <span>¥{minPrice.toLocaleString()}</span>
            <span>¥{maxPrice.toLocaleString()}</span>
          </div>
        </div>
      )}

      {/* サイト別価格（内部用・非公開） */}
      {showSources && latestPrices.length > 0 && (
        <div className="bg-white rounded-xl p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <EyeOff size={16} className="text-gray-400" />
            <h3 className="font-bold text-gray-700">サイト別価格（非公開）</h3>
          </div>
          <div className="space-y-3">
            {latestPrices.map((price) => (
              <div
                key={price.source}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div>
                  <div className="font-medium">
                    {SOURCE_NAMES[price.source] || price.source}
                  </div>
                  {price.condition && (
                    <div className="text-xs text-gray-500">{price.condition}</div>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-bold text-blue-600">
                    ¥{price.price?.toLocaleString() || '---'}
                  </div>
                  {price.stock !== null && (
                    <div className="text-xs text-gray-500">
                      在庫: {price.stock}点
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-xs text-gray-400">
            最終更新: {latestPrices[0] && new Date(latestPrices[0].recorded_at).toLocaleString('ja-JP')}
          </div>
        </div>
      )}
    </div>
  )
}
