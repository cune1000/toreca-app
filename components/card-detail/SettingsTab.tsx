'use client'

import { ExternalLink, RefreshCw, Plus, Zap, Clock, AlertTriangle, Link2, ChevronRight } from 'lucide-react'
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

const STATUS_CONFIG: Record<string, { label: string; dotClass: string; bgClass: string }> = {
  off: { label: '停止中', dotClass: 'bg-slate-300', bgClass: 'bg-slate-50 text-slate-500' },
  auto: { label: '自動', dotClass: 'bg-emerald-400 animate-pulse', bgClass: 'bg-emerald-50 text-emerald-700' },
  manual: { label: '手動', dotClass: 'bg-amber-400', bgClass: 'bg-amber-50 text-amber-700' },
}

const INTERVAL_OPTIONS = [
  { value: 180, label: '3時間' },
  { value: 360, label: '6時間' },
  { value: 720, label: '12時間' },
  { value: 1440, label: '24時間' },
  { value: 2880, label: '48時間' },
  { value: 4320, label: '72時間' },
]

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

  const currentMode = snkrdunkUrl?.auto_scrape_mode || 'off'
  const statusConfig = STATUS_CONFIG[currentMode] || STATUS_CONFIG.off

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
                <p className="text-[11px] text-slate-400 mt-0.5">売買履歴・価格データを自動取得</p>
              </div>
            </div>
            {snkrdunkUrl && (
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${statusConfig.bgClass}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dotClass}`} />
                {statusConfig.label}
              </span>
            )}
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
                  className="text-[11px] text-blue-500 hover:text-blue-600 truncate transition-colors flex items-center gap-1"
                >
                  {snkrdunkUrl.product_url}
                  <ExternalLink size={10} className="flex-shrink-0" />
                </a>
              </div>

              {/* コントロール行 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* 自動更新モード */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">更新モード</label>
                  <select
                    value={currentMode}
                    onChange={(e) => onUpdateAutoScrapeMode(snkrdunkUrl.id, e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 font-medium
                               focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300 transition-all
                               hover:border-slate-300 appearance-none cursor-pointer"
                    style={{ backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.25em 1.25em', paddingRight: '2rem' }}
                  >
                    <option value="off">停止</option>
                    <option value="auto">オートメーション（自動間隔調整）</option>
                    <option value="manual">手動で間隔を設定</option>
                  </select>
                </div>

                {/* 更新間隔（手動時のみ） */}
                {currentMode === 'manual' && (
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">更新間隔</label>
                    <select
                      value={snkrdunkUrl.auto_scrape_interval_minutes || 1440}
                      onChange={(e) => onUpdateScrapeInterval(snkrdunkUrl.id, parseInt(e.target.value))}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-700 font-medium
                                 focus:outline-none focus:ring-2 focus:ring-purple-200 focus:border-purple-300 transition-all
                                 hover:border-slate-300 appearance-none cursor-pointer"
                      style={{ backgroundImage: "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")", backgroundPosition: 'right 0.5rem center', backgroundRepeat: 'no-repeat', backgroundSize: '1.25em 1.25em', paddingRight: '2rem' }}
                    >
                      {INTERVAL_OPTIONS.map(opt => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* タイムスタンプ行 */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                {snkrdunkUrl.last_scraped_at && (
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <Clock size={11} />
                    <span>最終: <span className="text-slate-600 font-medium">{formatRelativeTime(snkrdunkUrl.last_scraped_at)}</span></span>
                  </div>
                )}
                {snkrdunkUrl.next_scrape_at && currentMode !== 'off' && (
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
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
                    <p className="text-[11px] font-medium text-red-700">スクレイピングエラー</p>
                    <p className="text-[11px] text-red-500 mt-0.5 leading-relaxed">{snkrdunkUrl.last_scrape_error}</p>
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
                <p className="text-[11px] text-slate-400 mt-0.5">登録URL: {saleUrls.length}件</p>
              </div>
            </div>
            <button
              onClick={onShowSaleUrlForm}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white rounded-lg text-xs font-medium
                         hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-sm shadow-emerald-200"
            >
              <Plus size={13} />
              URL追加
            </button>
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
                    <a
                      href={url.product_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-blue-400 hover:text-blue-500 truncate flex items-center gap-1 mt-0.5 transition-colors"
                    >
                      <span className="truncate">{url.product_url.substring(0, 50)}...</span>
                      <ExternalLink size={10} className="flex-shrink-0" />
                    </a>
                  </div>

                  {/* 最新価格 */}
                  {url.last_price != null && (
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-emerald-700 tabular-nums">
                        ¥{url.last_price.toLocaleString()}
                      </p>
                      {url.last_stock != null && (
                        <p className="text-[10px] text-slate-400 mt-0.5">在庫: {url.last_stock}</p>
                      )}
                    </div>
                  )}

                  {/* チェック間隔 */}
                  <select
                    value={url.check_interval || 180}
                    onChange={(e) => onUpdateCheckInterval(url.id, parseInt(e.target.value))}
                    className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600 font-medium
                               focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-300 transition-all
                               hover:border-slate-300 cursor-pointer flex-shrink-0"
                    title="価格チェック間隔"
                  >
                    {INTERVAL_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>

                  {/* 更新ボタン */}
                  <button
                    onClick={() => onUpdatePrice(url)}
                    disabled={scraping}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-700 text-white rounded-lg text-[11px] font-medium
                               hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none
                               transition-all flex-shrink-0"
                  >
                    <RefreshCw size={11} className={scraping ? 'animate-spin' : ''} />
                    更新
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center mb-3">
                <ExternalLink size={20} className="text-slate-300" />
              </div>
              <p className="text-sm text-slate-400">販売URLが登録されていません</p>
              <p className="text-[11px] text-slate-300 mt-1">「URL追加」から販売サイトを登録してください</p>
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
            <p className="text-[11px] text-slate-400 mt-0.5">外部サービスと連携して価格を自動追跡</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* シンソク */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 px-4 py-3 border-b border-green-100/60">
              <div className="flex items-center gap-2">
                <span className="text-base">🔗</span>
                <div>
                  <h4 className="text-xs font-semibold text-slate-700">シンソク買取</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">6時間ごとに自動追跡</p>
                </div>
              </div>
            </div>
            <div className="p-4">
              <ShinsokuLink
                cardId={card.id}
                cardName={card.name}
                links={purchaseLinks.filter((l: any) => l.shop?.name === 'シンソク（郵送買取）')}
                onLinksChanged={onLinksChanged}
              />
            </div>
          </div>

          {/* トレカラウンジ */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-gradient-to-r from-orange-50 to-amber-50 px-4 py-3 border-b border-orange-100/60">
              <div className="flex items-center gap-2">
                <span className="text-base">🏪</span>
                <div>
                  <h4 className="text-xs font-semibold text-slate-700">トレカラウンジ買取</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">買取価格を自動追跡</p>
                </div>
              </div>
            </div>
            <div className="p-4">
              <LoungeLink
                cardId={card.id}
                cardName={card.name}
                links={purchaseLinks.filter((l: any) => l.shop?.name === 'トレカラウンジ（郵送買取）')}
                onLinksChanged={onLinksChanged}
              />
            </div>
          </div>

          {/* PriceCharting */}
          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b border-blue-100/60">
              <div className="flex items-center gap-2">
                <span className="text-base">🌐</span>
                <div>
                  <h4 className="text-xs font-semibold text-slate-700">PriceCharting 海外価格</h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">海外価格（USD）を自動追跡</p>
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
