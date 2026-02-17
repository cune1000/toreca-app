'use client'

import React, { useState, useEffect } from 'react'
import {
  Home, Database, Store, Settings,
  ChevronLeft, ChevronRight, Plus,
  Globe, Layers, Tag, Inbox
} from 'lucide-react'

// Components
import DashboardContent from './DashboardContent'
import CardForm from './CardForm'
import ShopForm from './ShopForm'
import ImageRecognition from './ImageRecognition'
import TwitterFeed from './TwitterFeed'
import CategoryManager from './CategoryManager'
import CardImporter from './CardImporter'
import BulkRecognition from './BulkRecognition'
import CronDashboard from './CronDashboard'

// Pages
import { PendingPage, ShopsPage, SitesPage, CardsPage, SnkrdunkMonitorPage, ShopDetailPage } from './pages'

// API
import { getShops, getSaleSites, getPendingImages } from '@/lib/api'
import type { Shop, SaleSite, PendingImage } from '@/lib/types'

// =============================================================================
// Component
// =============================================================================

const TorekaApp = () => {
  // ページ状態（SSR-safe: 初期値は常に'dashboard'、クライアントマウント後にlocalStorageから復元）
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [isHydrated, setIsHydrated] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'cron' | 'snkrdunk'>('cron')

  // モーダル状態
  const [showCardForm, setShowCardForm] = useState(false)
  const [showShopForm, setShowShopForm] = useState(false)
  const [showImageRecognition, setShowImageRecognition] = useState(false)
  const [showTwitterFeed, setShowTwitterFeed] = useState(false)
  const [showCardImporter, setShowCardImporter] = useState(false)
  const [showBulkRecognition, setShowBulkRecognition] = useState(false)

  // 選択状態
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null)
  const [editingShop, setEditingShop] = useState<any>(null)

  // ★ 修正: pendingImageIdとaiResultを追加
  const [bulkRecognitionImage, setBulkRecognitionImage] = useState<{
    url?: string
    base64?: string
    tweetTime?: string
    tweetUrl?: string
    pendingImageId?: string    // ← 追加
    aiResult?: any             // ← 追加
  } | null>(null)

  // データ
  const [shops, setShops] = useState<Shop[]>([])
  const [sites, setSites] = useState<SaleSite[]>([])
  const [pendingImages, setPendingImages] = useState<PendingImage[]>([])
  const [refresh, setRefresh] = useState(0)

  // =============================================================================
  // Data Fetching
  // =============================================================================

  // SSR-safe: クライアントマウント後にlocalStorageからページ状態を復元
  useEffect(() => {
    const saved = localStorage.getItem('toreca-currentPage')
    if (saved) {
      setCurrentPage(saved)
    }

    setIsHydrated(true)
  }, [])

  useEffect(() => {
    fetchData()
  }, [refresh])

  const fetchData = async () => {
    const [shopsData, sitesData, pendingData] = await Promise.all([
      getShops(),
      getSaleSites(),
      getPendingImages('pending')
    ])
    setShops(shopsData)
    setSites(sitesData)
    setPendingImages(pendingData)
  }

  // ページ変更時にlocalStorageに保存＆オーバーレイを閉じる
  // isHydrated前はデフォルト値'dashboard'なので、保存するとlocalStorageを上書きしてしまう
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem('toreca-currentPage', currentPage)
    }
    setShowTwitterFeed(false)
  }, [currentPage, isHydrated])

  // =============================================================================
  // Handlers
  // =============================================================================

  const openShopEdit = (shop: Shop, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingShop(shop)
    setShowShopForm(true)
  }

  const openShopAdd = () => {
    setEditingShop(null)
    setShowShopForm(true)
  }

  const handleShopSelect = (shop: Shop) => {
    setSelectedShop(shop)
    setCurrentPage('shop-detail')
  }

  const handleOpenTwitterFromDetail = () => {
    setShowTwitterFeed(true)
  }

  // ★ 修正: pending.idとpending.ai_resultを渡す
  const handleProcessPendingImage = (pending: PendingImage) => {
    setBulkRecognitionImage({
      url: pending.image_url,
      base64: pending.image_base64,
      tweetTime: pending.tweet_time,
      tweetUrl: pending.tweet_url,
      pendingImageId: pending.id,        // ← 追加
      aiResult: pending.ai_result        // ← 追加
    })
    setSelectedShop(shops.find(s => s.id === pending.shop_id) || null)
    setShowBulkRecognition(true)
  }

  const handleRefresh = () => {
    setRefresh(r => r + 1)
  }

  // =============================================================================
  // Sidebar
  // =============================================================================

  const Sidebar = () => (
    <aside className={`fixed left-0 top-0 h-full bg-slate-900 text-white transition-all duration-300 z-50 overflow-y-auto ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
      <div className="p-4 border-b border-slate-700 flex items-center justify-between">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2">
            <Layers size={24} className="text-blue-400" />
            <span className="font-bold text-lg">トレカ価格管理</span>
          </div>
        )}
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="p-1 hover:bg-slate-700 rounded"
        >
          {sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
        </button>
      </div>

      <nav className="p-2">
        <div className="mb-2 px-3 py-2 text-xs text-slate-400 uppercase">メイン</div>
        {[
          { id: 'dashboard', icon: Home, label: 'ダッシュボード' },
          { id: 'cards', icon: Database, label: 'カード管理' },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setCurrentPage(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${currentPage === item.id
              ? 'bg-blue-600 text-white'
              : 'text-slate-300 hover:bg-slate-800'
              }`}
          >
            <item.icon size={20} />
            {!sidebarCollapsed && <span>{item.label}</span>}
          </button>
        ))}

        <div className="mb-2 mt-4 px-3 py-2 text-xs text-slate-400 uppercase">買取価格</div>
        {[
          { id: 'shops', icon: Store, label: '買取店舗', badge: 0 },
          { id: 'pending', icon: Inbox, label: '保留', badge: pendingImages.length },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setCurrentPage(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${currentPage === item.id
              ? 'bg-blue-600 text-white'
              : 'text-slate-300 hover:bg-slate-800'
              }`}
          >
            <item.icon size={20} />
            {!sidebarCollapsed && (
              <span className="flex-1 text-left">{item.label}</span>
            )}
            {!sidebarCollapsed && item.badge > 0 && (
              <span className="px-2 py-0.5 bg-orange-500 text-white text-xs rounded-full">
                {item.badge}
              </span>
            )}
          </button>
        ))}

        <div className="mb-2 mt-4 px-3 py-2 text-xs text-slate-400 uppercase">販売価格</div>
        {[
          { id: 'sites', icon: Globe, label: '販売サイト' },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setCurrentPage(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${currentPage === item.id
              ? 'bg-blue-600 text-white'
              : 'text-slate-300 hover:bg-slate-800'
              }`}
          >
            <item.icon size={20} />
            {!sidebarCollapsed && <span>{item.label}</span>}
          </button>
        ))}

        <div className="mb-2 mt-4 px-3 py-2 text-xs text-slate-400 uppercase">設定</div>
        {[
          { id: 'categories', icon: Tag, label: 'カテゴリ' },
          { id: 'settings', icon: Settings, label: '設定' },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setCurrentPage(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${currentPage === item.id
              ? 'bg-blue-600 text-white'
              : 'text-slate-300 hover:bg-slate-800'
              }`}
          >
            <item.icon size={20} />
            {!sidebarCollapsed && <span>{item.label}</span>}
          </button>
        ))}
      </nav>
    </aside>
  )

  // =============================================================================
  // Header
  // =============================================================================

  const Header = ({ title, subtitle, actions }: {
    title: string
    subtitle?: string
    actions?: React.ReactNode
  }) => (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {actions}
      </div>
    </header>
  )

  // =============================================================================
  // Page Rendering
  // =============================================================================

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <>
            <Header title="ダッシュボード" />
            <DashboardContent key={refresh} />
          </>
        )
      case 'cards':
        return (
          <>
            <Header title="カード管理" />
            <CardsPage
              onAddCard={() => setShowCardForm(true)}
              onImportCards={() => setShowCardImporter(true)}
              onAIRecognition={() => setShowImageRecognition(true)}
            />
          </>
        )
      case 'shops':
        return (
          <>
            <Header title="買取店舗" subtitle={`${shops.length}件の店舗`} />
            <ShopsPage
              shops={shops}
              onAddShop={openShopAdd}
              onEditShop={openShopEdit}
              onSelectShop={handleShopSelect}
            />
          </>
        )
      case 'shop-detail':
        if (!selectedShop) {
          setCurrentPage('shops')
          return null
        }
        return (
          <ShopDetailPage
            shop={selectedShop}
            onBack={() => setCurrentPage('shops')}
            onOpenTwitterFeed={handleOpenTwitterFromDetail}
          />
        )
      case 'sites':
        return (
          <>
            <Header title="販売サイト" subtitle={`${sites.length}件のサイト`} />
            <SitesPage sites={sites} />
          </>
        )
      case 'pending':
        return (
          <>
            <Header title="保留" subtitle={`${pendingImages.length}件の保留画像`} />
            <PendingPage
              shops={shops}
              pendingImages={pendingImages}
              onRefresh={handleRefresh}
              onProcessImage={handleProcessPendingImage}
            />
          </>
        )
      case 'categories':
        return (
          <>
            <Header title="カテゴリ管理" />
            <CategoryManager />
          </>
        )
      case 'settings':
        return (
          <>
            <Header title="設定" />
            <div className="p-6">
              <div className="flex gap-2 mb-6 border-b">
                <button
                  onClick={() => setSettingsTab('cron')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${settingsTab === 'cron'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  Cron設定
                </button>
                <button
                  onClick={() => setSettingsTab('snkrdunk')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${settingsTab === 'snkrdunk'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                    }`}
                >
                  監視状況（スニダン）
                </button>
              </div>
              {settingsTab === 'cron' ? <CronDashboard /> : <SnkrdunkMonitorPage />}
            </div>
          </>
        )
      default:
        return (
          <>
            <Header title="ダッシュボード" />
            <DashboardContent key={refresh} />
          </>
        )
    }
  }

  // =============================================================================
  // Render
  // =============================================================================

  // Hydration完了前はスケルトンを表示（フラッシュ防止）
  if (!isHydrated) {
    return <div className="min-h-screen bg-gray-50" />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className={`transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        {renderPage()}
      </main>

      {/* Modals */}
      {showCardForm && (
        <CardForm
          onClose={() => setShowCardForm(false)}
          onSaved={handleRefresh}
        />
      )}

      {showShopForm && (
        <ShopForm
          shop={editingShop}
          onClose={() => { setShowShopForm(false); setEditingShop(null); }}
          onSaved={handleRefresh}
        />
      )}

      {showImageRecognition && (
        <ImageRecognition
          onClose={() => setShowImageRecognition(false)}
          onRecognized={handleRefresh}
        />
      )}


      {showTwitterFeed && selectedShop && (
        <TwitterFeed
          shop={selectedShop}
          onClose={() => setShowTwitterFeed(false)}
          onImageSelect={(imageUrl: string) => {
            console.log('Selected image:', imageUrl)
            setShowTwitterFeed(false)
          }}
        />
      )}

      {showCardImporter && (
        <CardImporter
          onClose={() => setShowCardImporter(false)}
          onCompleted={() => { setShowCardImporter(false); handleRefresh(); }}
        />
      )}

      {/* ★ 修正: pendingImageIdとinitialAiResultを追加 */}
      {showBulkRecognition && (
        <BulkRecognition
          imageUrl={bulkRecognitionImage?.url}
          imageBase64={bulkRecognitionImage?.base64}
          shop={selectedShop}
          tweetTime={bulkRecognitionImage?.tweetTime}
          tweetUrl={bulkRecognitionImage?.tweetUrl}
          pendingImageId={bulkRecognitionImage?.pendingImageId}    // ← 追加
          initialAiResult={bulkRecognitionImage?.aiResult}          // ← 追加
          onClose={() => { setShowBulkRecognition(false); setBulkRecognitionImage(null); handleRefresh(); }}
          onCompleted={() => { setShowBulkRecognition(false); setBulkRecognitionImage(null); handleRefresh(); }}
        />
      )}
    </div>
  )
}

export default TorekaApp
