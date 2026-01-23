'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { X, TrendingUp, TrendingDown, ExternalLink, RefreshCw, Store, Globe, Edit, Plus } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import CardEditForm from './CardEditForm'
import SaleUrlForm from './SaleUrlForm'

export default function CardDetail({ card, onClose, onUpdated }) {
  const [purchasePrices, setPurchasePrices] = useState([])
  const [salePrices, setSalePrices] = useState([])
  const [saleUrls, setSaleUrls] = useState([])
  const [loading, setLoading] = useState(true)
  const [scraping, setScraping] = useState(false)
  const [showEditForm, setShowEditForm] = useState(false)
  const [showSaleUrlForm, setShowSaleUrlForm] = useState(false)

  useEffect(() => {
    if (card?.id) {
      fetchPrices()
    }
  }, [card?.id])

  const fetchPrices = async () => {
    setLoading(true)

    // 買取価格履歴
    const { data: purchaseData, error: purchaseError } = await supabase
      .from('purchase_prices')
      .select('*, shop:shop_id(name, icon)')
      .eq('card_id', card.id)
      .order('created_at', { ascending: false })
      .limit(50)
    console.log('Purchase data:', purchaseData, purchaseError)
    setPurchasePrices(purchaseData || [])

    // 販売価格履歴
    const { data: saleData, error: saleError } = await supabase
      .from('sale_prices')
      .select('*, site:site_id(name, icon)')
      .eq('card_id', card.id)
      .order('created_at', { ascending: false })
      .limit(50)
    console.log('Sale data:', saleData, saleError)
    setSalePrices(saleData || [])

    // 販売URL
    const { data: urlData, error: urlError } = await supabase
      .from('card_sale_urls')
      .select('*, site:site_id(name, icon, url)')
      .eq('card_id', card.id)
    console.log('URL data:', urlData, urlError)
    setSaleUrls(urlData || [])

    setLoading(false)
  }

  // スクレイピングで価格更新
  const updatePrice = async (saleUrl: any) => {
    setScraping(true)
    try {
      const res = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: saleUrl.product_url }),
      })
      const data = await res.json()

      if (data.success && data.priceNumber) {
        // 価格をDBに保存
        const { error } = await supabase.from('sale_prices').insert([{
          card_id: card.id,
          site_id: saleUrl.site_id,
          price: data.priceNumber,
        }])
        
        if (error) {
          console.error('DB保存エラー:', error)
          alert('価格の保存に失敗しました: ' + error.message)
        } else {
          alert(`価格を更新しました: ¥${data.priceNumber.toLocaleString()}`)
          fetchPrices()
        }
      } else {
        alert('価格の取得に失敗しました')
      }
    } catch (err: any) {
      alert('エラー: ' + err.message)
    }
    setScraping(false)
  }

  // グラフ用データを作成
  const chartData = () => {
    const dataMap = new Map()

    // 買取価格をマップに追加
    purchasePrices.forEach((p: any) => {
      const date = new Date(p.recorded_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
      if (!dataMap.has(date)) {
        dataMap.set(date, { date })
      }
      dataMap.get(date).purchase = p.price
    })

    // 販売価格をマップに追加
    salePrices.forEach((p: any) => {
      const date = new Date(p.recorded_at).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric' })
      if (!dataMap.has(date)) {
        dataMap.set(date, { date })
      }
      dataMap.get(date).sale = p.price
    })

    return Array.from(dataMap.values()).reverse().slice(-14)
  }

  // 最新価格
  const latestPurchase = purchasePrices[0]?.price
  const latestSale = salePrices[0]?.price
  const profit = latestSale && latestPurchase ? latestSale - latestPurchase : null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-[900px] max-h-[90vh] overflow-auto">
        {/* ヘッダー */}
        <div className="p-6 border-b border-gray-100 flex items-start gap-6">
          {card?.image_url ? (
            <img src={card.image_url} alt={card.name} className="w-40 h-56 object-cover rounded-xl shadow-lg" />
          ) : (
            <div className="w-40 h-56 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400">
              No Image
            </div>
          )}
          <div className="flex-1">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-800">{card?.name}</h2>
                <div className="flex items-center gap-2 mt-2">
                  {card?.card_number && (
                    <span className="text-gray-500">{card.card_number}</span>
                  )}
                  {card?.rarity && (
                    <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium">
                      {card.rarity.name || card.rarity}
                    </span>
                  )}
                </div>
                {card?.category_large && (
                  <p className="mt-2 text-gray-600">
                    {card.category_large.icon} {card.category_large.name}
                  </p>
                )}
              </div>
              <div className="flex items-start gap-2">
                <button 
                  onClick={() => setShowEditForm(true)} 
                  className="p-2 hover:bg-blue-100 rounded-lg text-blue-600"
                  title="編集"
                >
                  <Edit size={20} />
                </button>
                <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                  <X size={20} className="text-gray-500" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-12 text-center">
            <RefreshCw className="animate-spin mx-auto text-gray-400" size={32} />
            <p className="mt-2 text-gray-500">読み込み中...</p>
          </div>
        ) : (
          <div className="p-6 space-y-6">
            {/* 価格サマリー */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-blue-600 mb-1">
                  <Store size={16} />
                  <span className="text-sm">最新買取価格</span>
                </div>
                <p className="text-2xl font-bold text-blue-700">
                  {latestPurchase ? `¥${latestPurchase.toLocaleString()}` : '-'}
                </p>
              </div>
              <div className="bg-green-50 rounded-xl p-4">
                <div className="flex items-center gap-2 text-green-600 mb-1">
                  <Globe size={16} />
                  <span className="text-sm">最新販売価格</span>
                </div>
                <p className="text-2xl font-bold text-green-700">
                  {latestSale ? `¥${latestSale.toLocaleString()}` : '-'}
                </p>
              </div>
              <div className={`rounded-xl p-4 ${profit && profit > 0 ? 'bg-emerald-50' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-2 text-gray-600 mb-1">
                  {profit && profit > 0 ? <TrendingUp size={16} className="text-emerald-600" /> : <TrendingDown size={16} />}
                  <span className="text-sm">差額（利益）</span>
                </div>
                <p className={`text-2xl font-bold ${profit && profit > 0 ? 'text-emerald-700' : 'text-gray-700'}`}>
                  {profit ? `¥${profit.toLocaleString()}` : '-'}
                </p>
              </div>
            </div>

            {/* 価格推移グラフ */}
            {chartData().length > 0 ? (
              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h3 className="font-bold text-gray-800 mb-4">価格推移</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartData()}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `¥${(v/1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: number) => `¥${value.toLocaleString()}`} />
                    <Legend />
                    <Line type="monotone" dataKey="purchase" stroke="#3b82f6" strokeWidth={2} name="買取価格" dot={false} />
                    <Line type="monotone" dataKey="sale" stroke="#10b981" strokeWidth={2} name="販売価格" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-500">
                <p>価格データがまだありません</p>
              </div>
            )}

            {/* 販売URL一覧 */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-800">販売サイト</h3>
                <button
                  onClick={() => setShowSaleUrlForm(true)}
                  className="px-3 py-1 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 flex items-center gap-1"
                >
                  <Plus size={14} />
                  URL追加
                </button>
              </div>
              {saleUrls.length > 0 ? (
                <div className="space-y-2">
                  {saleUrls.map((url: any) => (
                    <div key={url.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-xl">{url.site?.icon}</span>
                        <div>
                          <p className="font-medium text-gray-800">{url.site?.name}</p>
                          <a 
                            href={url.product_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-blue-500 hover:underline flex items-center gap-1"
                          >
                            商品ページを開く <ExternalLink size={12} />
                          </a>
                        </div>
                      </div>
                      <button
                        onClick={() => updatePrice(url)}
                        disabled={scraping}
                        className="px-3 py-1.5 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1"
                      >
                        {scraping ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                        価格更新
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 bg-gray-50 rounded-lg text-center text-gray-500">
                  <p>販売URLが登録されていません</p>
                </div>
              )}
            </div>

            {/* 価格履歴 */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-bold text-gray-800 mb-3">買取価格履歴</h3>
                <div className="bg-gray-50 rounded-lg max-h-48 overflow-auto">
                  {purchasePrices.length > 0 ? (
                    <div className="divide-y divide-gray-100">
                      {purchasePrices.slice(0, 10).map((p: any) => (
                        <div key={p.id} className="p-2 flex justify-between text-sm">
                          <span className="text-gray-600">
                            {p.shop?.icon} {p.shop?.name}
                          </span>
                          <span className="font-medium">¥{p.price.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="p-4 text-center text-gray-500 text-sm">データなし</p>
                  )}
                </div>
              </div>
              <div>
                <h3 className="font-bold text-gray-800 mb-3">販売価格履歴</h3>
                <div className="bg-gray-50 rounded-lg max-h-48 overflow-auto">
                  {salePrices.length > 0 ? (
                    <div className="divide-y divide-gray-100">
                      {salePrices.slice(0, 10).map((p: any) => (
                        <div key={p.id} className="p-2 flex justify-between text-sm">
                          <span className="text-gray-600">
                            {p.site?.icon} {p.site?.name}
                          </span>
                          <span className="font-medium">¥{p.price.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="p-4 text-center text-gray-500 text-sm">データなし</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {showEditForm && (
        <CardEditForm
          card={card}
          onClose={() => setShowEditForm(false)}
          onSaved={() => {
            setShowEditForm(false)
            if (onUpdated) onUpdated()
            onClose()
          }}
        />
      )}

      {showSaleUrlForm && (
        <SaleUrlForm
          card={card}
          onClose={() => setShowSaleUrlForm(false)}
          onSaved={() => {
            setShowSaleUrlForm(false)
            fetchPrices()
          }}
        />
      )}
    </div>
  )
}
