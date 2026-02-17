'use client'

import { ExternalLink, RefreshCw, Plus } from 'lucide-react'
import ShinsokuLink from '@/components/chart/ShinsokuLink'
import LoungeLink from '@/components/chart/LoungeLink'
import PriceChartingLink from '@/components/chart/PriceChartingLink'
import { formatRelativeTime } from './constants'

interface SettingsTabProps {
  card: any
  saleUrls: any[]
  purchaseLinks: any[]
  snkrdunkScraping: boolean
  scraping: boolean
  onScrapeSnkrdunk: () => void
  onUpdateAutoScrapeMode: (saleUrlId: string, mode: string) => void
  onUpdateScrapeInterval: (saleUrlId: string, intervalMinutes: number) => void
  onUpdateCheckInterval: (saleUrlId: string, intervalMinutes: number) => void
  onUpdatePrice: (saleUrl: any) => void
  onShowSaleUrlForm: () => void
  onLinksChanged: () => void
  onUpdated?: () => void
}

export default function SettingsTab({
  card, saleUrls, purchaseLinks,
  snkrdunkScraping, scraping,
  onScrapeSnkrdunk, onUpdateAutoScrapeMode, onUpdateScrapeInterval,
  onUpdateCheckInterval, onUpdatePrice, onShowSaleUrlForm,
  onLinksChanged, onUpdated,
}: SettingsTabProps) {
  const snkrdunkUrl = saleUrls.find((url: any) =>
    url.site?.name?.toLowerCase().includes('スニダン') ||
    url.site?.name?.toLowerCase().includes('snkrdunk') ||
    url.product_url?.toLowerCase().includes('snkrdunk')
  )

  return (
    <div className="space-y-6">
      {/* スニダン自動更新設定 */}
      <div className="bg-gray-50 rounded-xl p-4">
        <h4 className="font-bold text-sm mb-3">🤖 スニダン自動更新設定</h4>
        {snkrdunkUrl ? (
          <>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-gray-600">🔗 URL:</span>
              <a
                href={snkrdunkUrl.product_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-500 hover:underline flex items-center gap-1 truncate max-w-xs"
              >
                {snkrdunkUrl.product_url}
                <ExternalLink size={12} />
              </a>
            </div>

            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-gray-600">🔄 自動更新:</span>
              <select
                value={snkrdunkUrl.auto_scrape_mode || 'off'}
                onChange={(e) => onUpdateAutoScrapeMode(snkrdunkUrl.id, e.target.value)}
                className="px-2 py-1 border rounded text-xs"
              >
                <option value="off">停止</option>
                <option value="auto">オートメーション（3時間～72時間）</option>
                <option value="manual">手動設定</option>
              </select>
            </div>

            {snkrdunkUrl.auto_scrape_mode === 'manual' && (
              <div className="flex items-center gap-2 mb-3 ml-4">
                <span className="text-xs text-gray-600">⏱️ 更新間隔:</span>
                <select
                  value={snkrdunkUrl.auto_scrape_interval_minutes || 1440}
                  onChange={(e) => onUpdateScrapeInterval(snkrdunkUrl.id, parseInt(e.target.value))}
                  className="px-2 py-1 border rounded text-xs"
                >
                  <option value="180">3時間</option>
                  <option value="360">6時間</option>
                  <option value="720">12時間</option>
                  <option value="1440">24時間</option>
                  <option value="2880">48時間</option>
                  <option value="4320">72時間</option>
                </select>
              </div>
            )}

            {snkrdunkUrl.last_scraped_at && (
              <div className="text-xs text-gray-500 mb-2">
                📊 最終更新: {new Date(snkrdunkUrl.last_scraped_at).toLocaleString('ja-JP')}
                {' '}({formatRelativeTime(snkrdunkUrl.last_scraped_at)})
              </div>
            )}

            {snkrdunkUrl.next_scrape_at && snkrdunkUrl.auto_scrape_mode !== 'off' && (
              <div className="text-xs text-gray-500 mb-2">
                ⏰ 次回更新: {new Date(snkrdunkUrl.next_scrape_at).toLocaleString('ja-JP')}
                {' '}({formatRelativeTime(snkrdunkUrl.next_scrape_at)})
              </div>
            )}

            {snkrdunkUrl.last_scrape_status === 'error' && (
              <div className="bg-red-50 border border-red-200 rounded p-2 mb-2">
                <p className="text-xs text-red-700">⚠️ エラーが発生しました</p>
                <p className="text-xs text-red-600 mt-1">{snkrdunkUrl.last_scrape_error}</p>
              </div>
            )}

            <button
              onClick={onScrapeSnkrdunk}
              disabled={snkrdunkScraping}
              className="px-3 py-1 bg-purple-500 text-white rounded text-xs hover:bg-purple-600 disabled:opacity-50 flex items-center gap-1"
            >
              {snkrdunkScraping ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              今すぐ更新
            </button>
          </>
        ) : (
          <div className="text-xs text-gray-500">
            ⚠️ スニダンURLが未設定です。下の販売サイトからURLを追加してください。
          </div>
        )}
      </div>

      {/* 販売URL一覧 */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-bold text-sm">🌐 販売サイト</h4>
          <button
            onClick={onShowSaleUrlForm}
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
                  <span className="text-lg">{url.site?.icon || '🌐'}</span>
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{url.site?.name || 'Unknown'}</p>
                    <a
                      href={url.product_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-500 hover:underline flex items-center gap-1"
                    >
                      {url.product_url.substring(0, 50)}...
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {url.last_price && (
                    <div className="text-right">
                      <p className="font-bold text-green-700 text-sm">¥{url.last_price.toLocaleString()}</p>
                      {url.last_stock !== null && (
                        <p className="text-xs text-gray-500">在庫: {url.last_stock}</p>
                      )}
                    </div>
                  )}
                  <select
                    value={url.check_interval || 180}
                    onChange={(e) => onUpdateCheckInterval(url.id, parseInt(e.target.value))}
                    className="px-2 py-1 border rounded text-xs"
                    title="価格チェック間隔"
                  >
                    <option value="180">3h</option>
                    <option value="360">6h</option>
                    <option value="720">12h</option>
                    <option value="1440">24h</option>
                    <option value="2880">48h</option>
                    <option value="4320">72h</option>
                  </select>
                  <button
                    onClick={() => onUpdatePrice(url)}
                    disabled={scraping}
                    className="px-3 py-1 bg-blue-500 text-white rounded-lg text-sm hover:bg-blue-600 disabled:opacity-50 flex items-center gap-1"
                  >
                    {scraping ? <RefreshCw size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                    更新
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-center py-4 text-sm">販売URLが登録されていません</p>
        )}
      </div>

      {/* 紐付け設定 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <h4 className="font-bold text-sm mb-2 flex items-center gap-2">
            <span className="text-green-500">🔗</span>
            シンソク買取
          </h4>
          <p className="text-xs text-gray-400 mb-3">
            シンソクの商品と紐付けると、買取価格を自動追跡します（6時間ごと）。
          </p>
          <ShinsokuLink
            cardId={card.id}
            cardName={card.name}
            links={purchaseLinks.filter((l: any) => l.shop?.name === 'シンソク（郵送買取）')}
            onLinksChanged={onLinksChanged}
          />
        </div>

        <div>
          <h4 className="font-bold text-sm mb-2 flex items-center gap-2">
            <span className="text-orange-500">🏪</span>
            トレカラウンジ買取
          </h4>
          <p className="text-xs text-gray-400 mb-3">
            トレカラウンジの商品と紐付けると、買取価格を自動追跡します。
          </p>
          <LoungeLink
            cardId={card.id}
            cardName={card.name}
            links={purchaseLinks.filter((l: any) => l.shop?.name === 'トレカラウンジ（郵送買取）')}
            onLinksChanged={onLinksChanged}
          />
        </div>

        <div>
          <h4 className="font-bold text-sm mb-2 flex items-center gap-2">
            <span className="text-blue-500">🌐</span>
            PriceCharting 海外価格
          </h4>
          <p className="text-xs text-gray-400 mb-3">
            PriceChartingの商品と紐付けると、海外価格（USD）を自動追跡します。
          </p>
          <PriceChartingLink
            cardId={card.id}
            cardName={card.name}
            pricechartingId={card.pricecharting_id}
            pricechartingName={card.pricecharting_name}
            onLinked={() => onUpdated?.()}
          />
        </div>
      </div>
    </div>
  )
}
