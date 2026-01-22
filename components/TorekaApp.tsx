'use client'

import React, { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  Home, Database, Store, Settings, Eye,
  ChevronLeft, ChevronRight, Plus, Cpu,
  Globe, Layers, Tag, Twitter
} from 'lucide-react'
import DashboardContent from './DashboardContent'
import CardForm from './CardForm'
import ShopForm from './ShopForm'
import ImageRecognition from './ImageRecognition'
import TwitterFeed from './TwitterFeed'

const TorekaApp = () => {
  const [currentPage, setCurrentPage] = useState('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showCardForm, setShowCardForm] = useState(false)
  const [showShopForm, setShowShopForm] = useState(false)
  const [showImageRecognition, setShowImageRecognition] = useState(false)
  const [showTwitterFeed, setShowTwitterFeed] = useState(false)
  const [selectedShop, setSelectedShop] = useState(null)
  const [refresh, setRefresh] = useState(0)

  // カードリスト
  const [cards, setCards] = useState([])
  const [shops, setShops] = useState([])
  const [sites, setSites] = useState([])

  // データ取得
  useEffect(() => {
    fetchCards()
    fetchShops()
    fetchSites()
  }, [refresh])

  const fetchCards = async () => {
    const { data } = await supabase
      .from('cards')
      .select(`*, category_large:category_large_id(name, icon), rarity:rarity_id(name)`)
      .order('created_at', { ascending: false })
    setCards(data || [])
  }

  const fetchShops = async () => {
    const { data } = await supabase.from('purchase_shops').select('*')
    setShops(data || [])
  }

  const fetchSites = async () => {
    const { data } = await supabase.from('sale_sites').select('*')
    setSites(data || [])
  }

  // サイドバー
  const Sidebar = () => (
    <aside className={`fixed left-0 top-0 h-full bg-slate-900 text-white transition-all duration-300 z-50 ${sidebarCollapsed ? 'w-16' : 'w-64'}`}>
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
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${
              currentPage === item.id 
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
          { id: 'shops', icon: Store, label: '買取店舗' },
          { id: 'recognition', icon: Eye, label: '認識確認' },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setCurrentPage(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${
              currentPage === item.id 
                ? 'bg-blue-600 text-white' 
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <item.icon size={20} />
            {!sidebarCollapsed && <span>{item.label}</span>}
          </button>
        ))}

        <div className="mb-2 mt-4 px-3 py-2 text-xs text-slate-400 uppercase">販売価格</div>
        {[
          { id: 'sites', icon: Globe, label: '販売サイト' },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setCurrentPage(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${
              currentPage === item.id 
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
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${
              currentPage === item.id 
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

  // ヘッダー
  const Header = ({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) => (
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

  // カード管理ページ
  const CardsPage = () => (
    <div className="p-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-800">カード一覧</h2>
          <div className="flex gap-2">
            <button
              onClick={() => setShowImageRecognition(true)}
              className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 flex items-center gap-2"
            >
              <Cpu size={18} />
              AI認識
            </button>
            <button
              onClick={() => setShowCardForm(true)}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
            >
              <Plus size={18} />
              カード追加
            </button>
          </div>
        </div>
        {cards.length > 0 ? (
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">カード名</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">カテゴリ</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">レアリティ</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">カード番号</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">登録日</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {cards.map((card: any) => (
                <tr key={card.id} className="hover:bg-gray-50 cursor-pointer">
                  <td className="px-4 py-3 font-medium text-gray-800">{card.name}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {card.category_large ? `${card.category_large.icon} ${card.category_large.name}` : '-'}
                  </td>
                  <td className="px-4 py-3">
                    {card.rarity ? (
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">
                        {card.rarity.name}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{card.card_number || '-'}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-500">
                    {new Date(card.created_at).toLocaleDateString('ja-JP')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <Database size={48} className="mx-auto mb-4 text-gray-300" />
            <p>まだカードが登録されていません</p>
            <button
              onClick={() => setShowCardForm(true)}
              className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              最初のカードを追加
            </button>
          </div>
        )}
      </div>
    </div>
  )

  // 買取店舗ページ
  const ShopsPage = () => (
    <div className="p-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-800">買取店舗一覧</h2>
          <button
            onClick={() => setShowShopForm(true)}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2"
          >
            <Plus size={18} />
            店舗追加
          </button>
        </div>
        {shops.length > 0 ? (
          <div className="divide-y divide-gray-50">
            {shops.map((shop: any) => (
              <div 
                key={shop.id} 
                className="p-4 flex items-center justify-between hover:bg-gray-50 cursor-pointer"
                onClick={() => { setSelectedShop(shop); setShowTwitterFeed(true); }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{shop.icon}</span>
                  <div>
                    <p className="font-medium text-gray-800">{shop.name}</p>
                    {shop.x_account && (
                      <p className="text-sm text-blue-500">@{shop.x_account}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {shop.x_account && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs font-medium">
                      X連携
                    </span>
                  )}
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    shop.status === 'active' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {shop.status === 'active' ? '監視中' : '停止中'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <Store size={48} className="mx-auto mb-4 text-gray-300" />
            <p>まだ買取店舗が登録されていません</p>
            <button
              onClick={() => setShowShopForm(true)}
              className="mt-4 px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600"
            >
              最初の店舗を追加
            </button>
          </div>
        )}
      </div>
    </div>
  )

  // 販売サイトページ
  const SitesPage = () => (
    <div className="p-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-800">販売サイト一覧</h2>
        </div>
        <div className="divide-y divide-gray-50">
          {sites.map((site: any) => (
            <div key={site.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{site.icon}</span>
                <div>
                  <p className="font-medium text-gray-800">{site.name}</p>
                  <p className="text-sm text-blue-500">{site.url}</p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                site.status === 'active' 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-gray-100 text-gray-700'
              }`}>
                {site.status === 'active' ? 'アクティブ' : '停止中'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  // 設定ページ
  const SettingsPage = () => (
    <div className="p-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="font-bold text-gray-800 mb-4">設定</h2>
        <p className="text-gray-500">設定ページは今後実装予定です。</p>
      </div>
    </div>
  )

  // カテゴリページ
  const CategoriesPage = () => (
    <div className="p-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="font-bold text-gray-800 mb-4">カテゴリ管理</h2>
        <p className="text-gray-500">カテゴリ管理ページは今後実装予定です。</p>
      </div>
    </div>
  )

  // 認識確認ページ
  const RecognitionPage = () => (
    <div className="p-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="font-bold text-gray-800 mb-4">認識確認</h2>
        <p className="text-gray-500">AI画像認識機能は今後実装予定です。</p>
      </div>
    </div>
  )

  // ページレンダリング
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
            <Header title="カード管理" subtitle={`${cards.length}件のカード`} />
            <CardsPage />
          </>
        )
      case 'shops':
        return (
          <>
            <Header title="買取店舗" subtitle={`${shops.length}件の店舗`} />
            <ShopsPage />
          </>
        )
      case 'sites':
        return (
          <>
            <Header title="販売サイト" subtitle={`${sites.length}件のサイト`} />
            <SitesPage />
          </>
        )
      case 'recognition':
        return (
          <>
            <Header title="認識確認" />
            <RecognitionPage />
          </>
        )
      case 'categories':
        return (
          <>
            <Header title="カテゴリ管理" />
            <CategoriesPage />
          </>
        )
      case 'settings':
        return (
          <>
            <Header title="設定" />
            <SettingsPage />
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

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className={`transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        {renderPage()}
      </main>

      {showCardForm && (
        <CardForm
          onClose={() => setShowCardForm(false)}
          onSaved={() => {
            setRefresh(r => r + 1)
            fetchCards()
          }}
        />
      )}

      {showShopForm && (
        <ShopForm
          onClose={() => setShowShopForm(false)}
          onSaved={() => {
            setRefresh(r => r + 1)
            fetchShops()
          }}
        />
      )}

      {showImageRecognition && (
        <ImageRecognition
          onClose={() => setShowImageRecognition(false)}
          onRecognized={() => {
            setRefresh(r => r + 1)
            fetchCards()
          }}
        />
      )}

      {showTwitterFeed && selectedShop && (
        <TwitterFeed
          shop={selectedShop}
          onClose={() => setShowTwitterFeed(false)}
          onImageSelect={(imageUrl: string) => {
            console.log('Selected image:', imageUrl)
            setShowTwitterFeed(false)
            // TODO: 選択した画像でAI認識を実行
          }}
        />
      )}
    </div>
  )
}

export default TorekaApp
