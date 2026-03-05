'use client'

import { useState } from 'react'
import { ExternalLink, RefreshCw, Zap, Clock, AlertTriangle, Link2, ChevronRight, Pencil, Trash2, Check, X } from 'lucide-react'
import PriceChartingLink from '@/components/chart/PriceChartingLink'
import { formatRelativeTime } from './constants'
import { isSnkrdunkSiteName, isSnkrdunkUrl } from '@/lib/snkrdunk-api'

interface SettingsTabProps {
  card: any
  saleUrls: any[]
  purchaseLinks: any[]
  snkrdunkScraping: boolean
  onScrapeSnkrdunk: () => void
  onLinksChanged: () => void
  onUpdated?: () => void
  onEditSaleUrl?: (saleUrlId: string, newUrl: string) => Promise<void>
  onDeleteSaleUrl?: (saleUrlId: string) => Promise<void>
}

export default function SettingsTab({
  card, saleUrls, purchaseLinks,
  snkrdunkScraping,
  onScrapeSnkrdunk,
  onLinksChanged, onUpdated, onEditSaleUrl, onDeleteSaleUrl,
}: SettingsTabProps) {
  const [editingUrlId, setEditingUrlId] = useState<string | null>(null)
  const [editingUrlValue, setEditingUrlValue] = useState('')

  const snkrdunkUrl = saleUrls.find((url: any) =>
    isSnkrdunkSiteName(url.site?.name || '') || isSnkrdunkUrl(url.product_url || '')
  )

  return (
    <div className="space-y-8">
      {/* ━━━ Section 1: スニダン自動更新設定 ━━━ */}
      <section className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-violet-50 via-purple-50 to-fuchsia-50 px-5 py-4 border-b border-purple-100/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center">
                <Zap size={16} className="text-purple-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800 tracking-tight">スニダン自動更新</h3>
                <p className="text-xs text-slate-400 mt-0.5">売買履歴・価格データを自動取得</p>
              </div>
            </div>
          </div>
        </div>

        {/* コンテンツ */}
        <div className="px-5 py-4">
          {snkrdunkUrl ? (
            <div className="space-y-4">
              {/* URL表示 */}
              <div className="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2">
                <Link2 size={13} className="text-slate-400 flex-shrink-0" />
                <a
                  href={snkrdunkUrl.product_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:text-blue-600 truncate transition-colors flex items-center gap-1"
                >
                  {snkrdunkUrl.product_url}
                  <ExternalLink size={10} className="flex-shrink-0" />
                </a>
              </div>

              {/* タイムスタンプ行 */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {snkrdunkUrl.last_scraped_at && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <Clock size={11} />
                    <span>最終: <span className="text-slate-600 font-medium">{formatRelativeTime(snkrdunkUrl.last_scraped_at)}</span></span>
                  </div>
                )}
                {snkrdunkUrl.next_scrape_at && (
                  <div className="flex items-center gap-1.5 text-xs text-slate-400">
                    <ChevronRight size={11} />
                    <span>次回: <span className="text-slate-600 font-medium">{formatRelativeTime(snkrdunkUrl.next_scrape_at)}</span></span>
                  </div>
                )}
              </div>

              {/* エラー表示 */}
              {snkrdunkUrl.last_scrape_status === 'error' && (
                <div className="flex items-start gap-2.5 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">
                  <AlertTriangle size={14} className="text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-red-700">スクレイピングエラー</p>
                    <p className="text-xs text-red-500 mt-0.5 leading-relaxed">{snkrdunkUrl.last_scrape_error}</p>
                  </div>
                </div>
              )}

              {/* 手動更新ボタン */}
              <button
                onClick={onScrapeSnkrdunk}
                disabled={snkrdunkScraping}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-medium
                           hover:bg-purple-700 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none
                           transition-all shadow-sm shadow-purple-200"
              >
                <RefreshCw size={13} className={snkrdunkScraping ? 'animate-spin' : ''} />
                {snkrdunkScraping ? '更新中...' : '今すぐ更新'}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-lg px-4 py-3">
              <AlertTriangle size={16} className="text-amber-400 flex-shrink-0" />
              <p className="text-xs text-amber-700 leading-relaxed">
                スニダンURLが未設定です。下の「販売サイト」からURLを追加してください。
              </p>
            </div>
          )}
        </div>
      </section>

      {/* ━━━ Section 2: 販売サイト管理 ━━━ */}
      <section className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-teal-50 via-emerald-50 to-cyan-50 px-5 py-4 border-b border-emerald-100/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
                <ExternalLink size={16} className="text-emerald-600" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800 tracking-tight">販売サイト</h3>
                <p className="text-xs text-slate-400 mt-0.5">登録URL: {saleUrls.length}件</p>
              </div>
            </div>
          </div>
        </div>

        {/* コンテンツ */}
        <div className="px-5 py-4">
          {saleUrls.length > 0 ? (
            <div className="space-y-2.5">
              {saleUrls.map((url: any) => (
                <div
                  key={url.id}
                  className="group flex items-center gap-4 p-3.5 bg-white border border-slate-100 rounded-xl
                             hover:border-slate-200 hover:shadow-sm transition-all"
                >
                  {/* サイトアイコン */}
                  <div className="w-10 h-10 rounded-lg bg-slate-50 flex items-center justify-center text-lg flex-shrink-0
                                  group-hover:bg-slate-100 transition-colors">
                    {url.site?.icon || '🌐'}
                  </div>

                  {/* サイト情報 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700">{url.site?.name || 'Unknown'}</p>
                    {editingUrlId === url.id ? (
                      <div className="flex items-center gap-1 mt-0.5">
                        <input
                          value={editingUrlValue}
                          onChange={(e) => setEditingUrlValue(e.target.value)}
                          className="flex-1 px-2 py-0.5 border border-blue-300 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                          autoFocus
                        />
                        <button
                          onClick={async () => {
                            if (onEditSaleUrl && editingUrlValue.trim()) {
                              await onEditSaleUrl(url.id, editingUrlValue.trim())
                            }
                            setEditingUrlId(null)
                          }}
                          className="p-0.5 text-green-600 hover:bg-green-50 rounded"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          onClick={() => setEditingUrlId(null)}
                          className="p-0.5 text-slate-400 hover:bg-slate-50 rounded"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 mt-0.5">
                        <a
                          href={url.product_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-400 hover:text-blue-500 truncate flex items-center gap-1 transition-colors"
                        >
                          <span className="truncate">{url.product_url.substring(0, 50)}...</span>
                          <ExternalLink size={10} className="flex-shrink-0" />
                        </a>
                        {onEditSaleUrl && (
                          <button
                            onClick={() => { setEditingUrlId(url.id); setEditingUrlValue(url.product_url) }}
                            className="p-0.5 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                            title="URL変更"
                          >
                            <Pencil size={12} />
                          </button>
                        )}
                        {onDeleteSaleUrl && (
                          <button
                            onClick={() => {
                              if (confirm(`${url.site?.name || ''}のURLを削除しますか？`)) {
                                onDeleteSaleUrl(url.id)
                              }
                            }}
                            className="p-0.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-all"
                            title="URL削除"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 最新価格 */}
                  {url.last_price != null && (
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-emerald-700 tabular-nums">
                        ¥{url.last_price.toLocaleString()}
                      </p>
                      {url.last_stock != null && (
                        <p className="text-xs text-slate-400 mt-0.5">在庫: {url.last_stock}</p>
                      )}
                    </div>
                  )}

                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
                <ExternalLink size={20} className="text-slate-300" />
              </div>
              <p className="text-sm text-slate-400">販売URLが登録されていません</p>
              <p className="text-xs text-slate-300 mt-1">「URL追加」から販売サイトを登録してください</p>
            </div>
          )}
        </div>
      </section>

      {/* ━━━ Section 3: 紐付け設定 ━━━ */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
            <Link2 size={16} className="text-blue-600" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800 tracking-tight">買取・海外価格 紐付け</h3>
            <p className="text-xs text-slate-400 mt-0.5">外部サービスと連携して価格を自動追跡</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* PriceCharting */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-blue-100/60">
              <div className="flex items-center gap-2">
                <span className="text-base">🌐</span>
                <div>
                  <h4 className="text-xs font-semibold text-slate-700">PriceCharting 海外価格</h4>
                  <p className="text-xs text-slate-400 mt-0.5">海外価格（USD）を自動追跡</p>
                </div>
              </div>
            </div>
            <div className="p-4">
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
      </section>
    </div>
  )
}
