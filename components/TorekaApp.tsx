'use client'

import React, { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'
import { 
  Home, Database, Store, Settings, Eye,
  ChevronLeft, ChevronRight, Plus, Cpu,
  Globe, Layers, Tag, Edit2, Clock, Inbox, X,
  Search, RefreshCw
} from 'lucide-react'
import DashboardContent from './DashboardContent'
import CardForm from './CardForm'
import ShopForm from './ShopForm'
import ImageRecognition from './ImageRecognition'
import TwitterFeed from './TwitterFeed'
import CardDetail from './CardDetail'
import CategoryManager from './CategoryManager'
import CardImporter from './CardImporter'
import BulkRecognition from './BulkRecognition'
import CronDashboard from './CronDashboard'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const TorekaApp = () => {
  const [currentPage, setCurrentPage] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('toreca-currentPage') || 'dashboard'
    }
    return 'dashboard'
  })
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [showCardForm, setShowCardForm] = useState(false)
  const [showShopForm, setShowShopForm] = useState(false)
  const [showImageRecognition, setShowImageRecognition] = useState(false)
  const [showTwitterFeed, setShowTwitterFeed] = useState(false)
  const [showCardDetail, setShowCardDetail] = useState(false)
  const [showCardImporter, setShowCardImporter] = useState(false)
  const [selectedShop, setSelectedShop] = useState<any>(null)
  const [editingShop, setEditingShop] = useState<any>(null)  // 編集用
  const [selectedCard, setSelectedCard] = useState(null)
  const [refresh, setRefresh] = useState(0)

  // カードリスト
  const [cards, setCards] = useState([])
  const [shops, setShops] = useState([])
  const [sites, setSites] = useState([])
  const [pendingImages, setPendingImages] = useState<any[]>([])
  
  // BulkRecognition用
  const [showBulkRecognition, setShowBulkRecognition] = useState(false)
  const [bulkRecognitionImage, setBulkRecognitionImage] = useState<{url?: string, base64?: string, tweetTime?: string, tweetUrl?: string} | null>(null)

  // データ取得
  useEffect(() => {
    fetchCards()
    fetchShops()
    fetchSites()
    fetchPendingImages()
  }, [refresh])

  // ページ変更時にlocalStorageに保存
  useEffect(() => {
    localStorage.setItem('toreca-currentPage', currentPage)
  }, [currentPage])

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

  const fetchPendingImages = async () => {
    const { data, error } = await supabase
      .from('pending_images')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    
    if (error) {
      console.error('Error fetching pending_images:', error)
    }
    setPendingImages(data || [])
  }

  // 店舗編集を開く
  const openShopEdit = (shop: any, e: React.MouseEvent) => {
    e.stopPropagation() // TwitterFeedが開くのを防ぐ
    setEditingShop(shop)
    setShowShopForm(true)
  }

  // 新規店舗追加を開く
  const openShopAdd = () => {
    setEditingShop(null)
    setShowShopForm(true)
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
          { id: 'pending', icon: Inbox, label: '保留', badge: pendingImages.length },
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

  // カード管理ページ（検索・ページネーション・ステータス付き）
  const CardsPage = () => {
    const [searchQuery, setSearchQuery] = useState('')
    const [filterCategory, setFilterCategory] = useState('')
    const [filterRarity, setFilterRarity] = useState('')
    const [currentPage, setCurrentPage] = useState(1)
    const [totalCount, setTotalCount] = useState(0)
    const [filteredCards, setFilteredCards] = useState<any[]>([])
    const [categories, setCategories] = useState<any[]>([])
    const [rarities, setRarities] = useState<any[]>([])
    const [cardStatuses, setCardStatuses] = useState<Record<string, any>>({})
    const [isLoading, setIsLoading] = useState(false)
    const ITEMS_PER_PAGE = 50
    
    // カテゴリとレアリティを取得
    useEffect(() => {
      const fetchFilters = async () => {
        const { data: catData } = await supabase.from('category_large').select('id, name, icon').order('sort_order')
        setCategories(catData || [])
        const { data: rarData } = await supabase.from('rarities').select('id, name, large_id').order('sort_order')
        setRarities(rarData || [])
      }
      fetchFilters()
    }, [])
    
    // カードステータスを取得
    useEffect(() => {
      const fetchStatuses = async () => {
        const { data } = await supabase
          .from('card_sale_urls')
          .select('card_id, check_interval, error_count, last_checked_at')
        
        const statusMap: Record<string, any> = {}
        data?.forEach(url => {
          statusMap[url.card_id] = {
            interval: url.check_interval || 30,
            hasError: url.error_count > 0,
            lastChecked: url.last_checked_at
          }
        })
        setCardStatuses(statusMap)
      }
      fetchStatuses()
    }, [])
    
    // 検索・フィルタ・ページネーション
    useEffect(() => {
      const fetchFilteredCards = async () => {
        setIsLoading(true)
        
        let query = supabase
          .from('cards')
          .select(`*, category_large:category_large_id(name, icon), rarity:rarity_id(name)`, { count: 'exact' })
        
        // 検索条件
        if (searchQuery.length >= 2) {
          query = query.or(`name.ilike.%${searchQuery}%,card_number.ilike.%${searchQuery}%`)
        }
        if (filterCategory) {
          query = query.eq('category_large_id', filterCategory)
        }
        if (filterRarity) {
          query = query.eq('rarity_id', filterRarity)
        }
        
        // ページネーション
        const from = (currentPage - 1) * ITEMS_PER_PAGE
        const to = from + ITEMS_PER_PAGE - 1
        
        const { data, count, error } = await query
          .order('created_at', { ascending: false })
          .range(from, to)
        
        if (!error) {
          setFilteredCards(data || [])
          setTotalCount(count || 0)
        }
        setIsLoading(false)
      }
      
      const timer = setTimeout(fetchFilteredCards, 300)
      return () => clearTimeout(timer)
    }, [searchQuery, filterCategory, filterRarity, currentPage])
    
    // フィルタ変更時は1ページ目に戻る
    useEffect(() => {
      setCurrentPage(1)
    }, [searchQuery, filterCategory, filterRarity])
    
    const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE)
    
    // ステータスバッジ
    const getStatusBadge = (cardId: string) => {
      const status = cardStatuses[cardId]
      if (!status) return <span className="text-xs text-gray-400">−</span>
      if (status.hasError) return <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded">🔴 エラー</span>
      if (status.interval <= 30) return <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded">🟢 30分</span>
      if (status.interval <= 180) return <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded">🟡 {status.interval}分</span>
      return <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">⚪ {status.interval >= 1440 ? '24h' : `${status.interval/60}h`}</span>
    }
    
    // フィルタ用レアリティ（カテゴリで絞り込み）
    const filteredRarities = filterCategory 
      ? rarities.filter(r => r.large_id === filterCategory)
      : rarities
    
    return (
      <div className="p-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          {/* ヘッダー */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-800">カード一覧</h2>
              <div className="flex gap-2">
                <button onClick={() => setShowCardImporter(true)} className="px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 flex items-center gap-2">
                  <Globe size={18} /> 公式からインポート
                </button>
                <button onClick={() => setShowImageRecognition(true)} className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 flex items-center gap-2">
                  <Cpu size={18} /> AI認識
                </button>
                <button onClick={() => setShowCardForm(true)} className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2">
                  <Plus size={18} /> カード追加
                </button>
              </div>
            </div>
            
            {/* 検索・フィルタ */}
            <div className="flex gap-3 items-center">
              <div className="relative flex-1 max-w-md">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="カード名・型番で検索（2文字以上）"
                  className="w-full pl-10 pr-4 py-2 border rounded-lg"
                />
              </div>
              <select
                value={filterCategory}
                onChange={(e) => { setFilterCategory(e.target.value); setFilterRarity(''); }}
                className="px-3 py-2 border rounded-lg"
              >
                <option value="">全カテゴリ</option>
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.icon} {cat.name}</option>
                ))}
              </select>
              <select
                value={filterRarity}
                onChange={(e) => setFilterRarity(e.target.value)}
                className="px-3 py-2 border rounded-lg"
              >
                <option value="">全レアリティ</option>
                {filteredRarities.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <span className="text-sm text-gray-500">{totalCount}件中 {Math.min((currentPage-1)*ITEMS_PER_PAGE+1, totalCount)}-{Math.min(currentPage*ITEMS_PER_PAGE, totalCount)}件</span>
            </div>
          </div>
          
          {/* テーブル */}
          {isLoading ? (
            <div className="p-8 text-center"><RefreshCw className="animate-spin mx-auto text-gray-400" size={32} /></div>
          ) : filteredCards.length > 0 ? (
            <div className="overflow-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">画像</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">カード名</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">カテゴリ</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">レアリティ</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">型番</th>
                    <th className="text-center px-4 py-3 text-xs font-medium text-gray-500">監視</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">登録日</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filteredCards.map((card: any) => (
                    <tr key={card.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => { setSelectedCard(card); setShowCardDetail(true); }}>
                      <td className="px-4 py-2">
                        {card.image_url ? (
                          <img src={card.image_url} alt={card.name} className="w-12 h-16 object-cover rounded" />
                        ) : (
                          <div className="w-12 h-16 bg-gray-100 rounded flex items-center justify-center text-gray-400 text-xs">No Image</div>
                        )}
                      </td>
                      <td className="px-4 py-2 font-medium text-gray-800">{card.name}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{card.category_large?.icon} {card.category_large?.name || '-'}</td>
                      <td className="px-4 py-2">
                        {card.rarity?.name && <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs font-medium">{card.rarity.name}</span>}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-600">{card.card_number || '-'}</td>
                      <td className="px-4 py-2 text-center">{getStatusBadge(card.id)}</td>
                      <td className="px-4 py-2 text-right text-sm text-gray-500">{new Date(card.created_at).toLocaleDateString('ja-JP')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-8 text-center text-gray-500">
              <Database size={48} className="mx-auto mb-4 text-gray-300" />
              <p>{searchQuery || filterCategory || filterRarity ? '条件に一致するカードがありません' : 'まだカードが登録されていません'}</p>
            </div>
          )}
          
          {/* ページネーション */}
          {totalPages > 1 && (
            <div className="p-4 border-t flex items-center justify-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
              >
                ← 前
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let page = i + 1
                if (totalPages > 5) {
                  if (currentPage > 3) page = currentPage - 2 + i
                  if (currentPage > totalPages - 2) page = totalPages - 4 + i
                }
                return (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-1 rounded ${currentPage === page ? 'bg-blue-500 text-white' : 'border hover:bg-gray-50'}`}
                  >
                    {page}
                  </button>
                )
              })}
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 border rounded hover:bg-gray-50 disabled:opacity-50"
              >
                次 →
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // 買取店舗ページ（Xアイコン対応・編集機能付き）
  const ShopsPage = () => (
    <div className="p-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-800">買取店舗一覧</h2>
          <button
            onClick={openShopAdd}
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
                className="p-4 flex items-center justify-between hover:bg-gray-50"
              >
                <div 
                  className="flex items-center gap-3 flex-1 cursor-pointer"
                  onClick={() => { setSelectedShop(shop); setShowTwitterFeed(true); }}
                >
                  {/* Xアイコン or デフォルトアイコン */}
                  {shop.icon ? (
                    <img 
                      src={shop.icon} 
                      alt={shop.name}
                      className="w-12 h-12 rounded-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = `https://unavatar.io/twitter/${shop.x_account}`
                      }}
                    />
                  ) : shop.x_account ? (
                    <img 
                      src={`https://unavatar.io/twitter/${shop.x_account}`}
                      alt={shop.name}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                      <Store size={24} className="text-gray-400" />
                    </div>
                  )}
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
                  {/* 編集ボタン */}
                  <button
                    onClick={(e) => openShopEdit(shop, e)}
                    className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <Edit2 size={16} className="text-gray-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-8 text-center text-gray-500">
            <Store size={48} className="mx-auto mb-4 text-gray-300" />
            <p>まだ買取店舗が登録されていません</p>
            <button
              onClick={openShopAdd}
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
  const SettingsPage = () => <CronDashboard />

  // カテゴリページ
  const CategoriesPage = () => <CategoryManager />

  // 認識確認ページ
  const RecognitionPage = () => (
    <div className="p-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="font-bold text-gray-800 mb-4">認識確認</h2>
        <p className="text-gray-500">AI画像認識機能は今後実装予定です。</p>
      </div>
    </div>
  )

  // 保留ページ
  const PendingPage = () => {
    const [pendingCards, setPendingCards] = useState<any[]>([])
    const [activeTab, setActiveTab] = useState<'images' | 'cards'>('images')
    const [searchQuery, setSearchQuery] = useState('')
    const [searchResults, setSearchResults] = useState<any[]>([])
    const [editingCardId, setEditingCardId] = useState<string | null>(null)
    
    // 保留カードを取得
    useEffect(() => {
      fetchPendingCards()
    }, [])
    
    const fetchPendingCards = async () => {
      const { data, error } = await supabase
        .from('pending_cards')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
      
      if (error) {
        console.error('Error fetching pending_cards:', error)
      }
      setPendingCards(data || [])
    }
    
    const handleProcessImage = async (pending: any) => {
      await supabase
        .from('pending_images')
        .update({ status: 'processing' })
        .eq('id', pending.id)
      
      setBulkRecognitionImage({
        url: pending.image_url,
        base64: pending.image_base64,
        tweetTime: pending.tweet_time,
        tweetUrl: pending.tweet_url
      })
      setSelectedShop(shops.find(s => s.id === pending.shop_id))
      setShowBulkRecognition(true)
    }

    const handleDeletePending = async (id: string) => {
      if (!confirm('この保留画像を削除しますか？')) return
      await supabase.from('pending_images').delete().eq('id', id)
      fetchPendingImages()
    }
    
    // カード検索
    const handleSearch = async (query: string) => {
      if (!query.trim()) {
        setSearchResults([])
        return
      }
      const { data } = await supabase
        .from('cards')
        .select('id, name, image_url')
        .ilike('name', `%${query}%`)
        .limit(10)
      setSearchResults(data || [])
    }
    
    // カードをマッチング
    const handleMatchCard = async (pendingCardId: string, cardId: string) => {
      await supabase
        .from('pending_cards')
        .update({ matched_card_id: cardId, status: 'matched' })
        .eq('id', pendingCardId)
      fetchPendingCards()
      setEditingCardId(null)
      setSearchQuery('')
      setSearchResults([])
    }
    
    // 保留カードを削除
    const handleDeletePendingCard = async (id: string) => {
      if (!confirm('この保留カードを削除しますか？')) return
      await supabase.from('pending_cards').delete().eq('id', id)
      fetchPendingCards()
    }
    
    // マッチ済みカードを買取価格として保存
    const handleSaveMatchedCards = async () => {
      const matchedCards = pendingCards.filter(c => c.status === 'matched' && c.matched_card_id && c.price)
      
      if (matchedCards.length === 0) {
        alert('保存できるカードがありません（価格が必要です）')
        return
      }
      
      try {
        const records = matchedCards.map(card => ({
          card_id: card.matched_card_id,
          shop_id: card.shop_id,
          price: card.price,
          recorded_at: new Date().toISOString(),
          tweet_time: card.tweet_time
        }))
        
        const { error } = await supabase.from('purchase_prices').insert(records)
        if (error) throw error
        
        // 保存したカードを削除
        const ids = matchedCards.map(c => c.id)
        await supabase.from('pending_cards').delete().in('id', ids)
        
        alert(`${matchedCards.length}件を保存しました`)
        fetchPendingCards()
      } catch (err: any) {
        alert('保存に失敗しました: ' + err.message)
      }
    }
    
    // 価格を更新
    const handleUpdatePrice = async (id: string, price: number) => {
      await supabase.from('pending_cards').update({ price }).eq('id', id)
      fetchPendingCards()
    }

    return (
      <div className="p-6">
        {/* タブ */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('images')}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === 'images' 
                ? 'bg-purple-500 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            📷 画像 ({pendingImages.length})
          </button>
          <button
            onClick={() => setActiveTab('cards')}
            className={`px-4 py-2 rounded-lg font-medium ${
              activeTab === 'cards' 
                ? 'bg-orange-500 text-white' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            🃏 カード ({pendingCards.length})
          </button>
        </div>
        
        {/* 画像タブ */}
        {activeTab === 'images' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-800">保留画像一覧</h2>
              <span className="text-sm text-gray-500">{pendingImages.length}件</span>
            </div>
            
            {pendingImages.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {pendingImages.map((pending: any) => (
                  <div key={pending.id} className="p-4 flex items-center gap-4 hover:bg-gray-50">
                    <div className="flex-shrink-0">
                      {pending.image_url ? (
                        <img
                          src={pending.image_url}
                          alt="保留画像"
                          className="w-24 h-24 object-cover rounded-lg border"
                        />
                      ) : pending.image_base64 ? (
                        <img
                          src={pending.image_base64}
                          alt="保留画像"
                          className="w-24 h-24 object-cover rounded-lg border"
                        />
                      ) : (
                        <div className="w-24 h-24 bg-gray-200 rounded-lg flex items-center justify-center">
                          <Inbox size={32} className="text-gray-400" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-gray-800">
                          {pending.shop?.name || '不明な店舗'}
                        </span>
                      </div>
                      
                      {pending.tweet_time && (
                        <p className="text-sm text-gray-500 flex items-center gap-1">
                          <Clock size={14} />
                          {new Date(pending.tweet_time).toLocaleString('ja-JP')}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleProcessImage(pending)}
                        className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 flex items-center gap-2"
                      >
                        <Eye size={18} />
                        認識
                      </button>
                      <button
                        onClick={() => handleDeletePending(pending.id)}
                        className="px-3 py-2 text-red-500 hover:bg-red-50 rounded-lg"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-12 text-center text-gray-500">
                <Inbox size={48} className="mx-auto mb-4 text-gray-300" />
                <p>保留中の画像はありません</p>
              </div>
            )}
          </div>
        )}
        
        {/* カードタブ */}
        {activeTab === 'cards' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="font-bold text-gray-800">保留カード一覧</h2>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">{pendingCards.length}件</span>
                {pendingCards.filter(c => c.status === 'matched').length > 0 && (
                  <button
                    onClick={handleSaveMatchedCards}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm"
                  >
                    マッチ済みを保存
                  </button>
                )}
              </div>
            </div>
            
            {pendingCards.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {pendingCards.map((card: any) => {
                  const shopName = shops.find((s: any) => s.id === card.shop_id)?.name || '不明な店舗'
                  return (
                  <div key={card.id} className={`p-4 flex items-center gap-4 ${
                    card.status === 'matched' ? 'bg-green-50' : 'bg-orange-50'
                  }`}>
                    {/* カード画像 */}
                    <div className="flex-shrink-0">
                      {card.card_image ? (
                        <img
                          src={card.card_image}
                          alt="カード"
                          className="w-20 h-28 object-cover rounded border"
                        />
                      ) : (
                        <div className="w-20 h-28 bg-gray-200 rounded flex items-center justify-center">
                          <span className="text-gray-400">?</span>
                        </div>
                      )}
                      {card.ocr_text && (
                        <p className="text-xs text-gray-500 mt-1 truncate w-20">{card.ocr_text}</p>
                      )}
                    </div>
                    
                    {/* 情報 */}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm text-gray-600">{shopName}</span>
                        <span className={`px-2 py-0.5 text-xs rounded ${
                          card.status === 'matched' 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-orange-100 text-orange-700'
                        }`}>
                          {card.status === 'matched' ? 'マッチ済み' : '未マッチ'}
                        </span>
                      </div>
                      
                      {/* 検索・マッチング */}
                      {editingCardId === card.id ? (
                        <div className="space-y-2">
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => {
                              setSearchQuery(e.target.value)
                              handleSearch(e.target.value)
                            }}
                            placeholder="カード名を検索..."
                            className="w-full px-3 py-2 border rounded-lg text-sm"
                            autoFocus
                          />
                          {searchResults.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {searchResults.map(result => (
                                <button
                                  key={result.id}
                                  onClick={() => handleMatchCard(card.id, result.id)}
                                  className="flex items-center gap-2 px-2 py-1 border rounded hover:bg-blue-50"
                                >
                                  {result.image_url && (
                                    <img src={result.image_url} alt="" className="w-8 h-10 object-cover rounded" />
                                  )}
                                  <span className="text-xs">{result.name}</span>
                                </button>
                              ))}
                            </div>
                          )}
                          <button
                            onClick={() => {
                              setEditingCardId(null)
                              setSearchQuery('')
                              setSearchResults([])
                            }}
                            className="text-xs text-gray-500 hover:underline"
                          >
                            キャンセル
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setEditingCardId(card.id)}
                          className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                        >
                          カード検索
                        </button>
                      )}
                      
                      {/* 価格 */}
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-sm">¥</span>
                        <input
                          type="number"
                          value={card.price || ''}
                          onChange={(e) => handleUpdatePrice(card.id, parseInt(e.target.value) || 0)}
                          className="w-28 px-2 py-1 border rounded text-right text-sm"
                        />
                      </div>
                    </div>
                    
                    {/* 削除 */}
                    <button
                      onClick={() => handleDeletePendingCard(card.id)}
                      className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                    >
                      <X size={18} />
                    </button>
                  </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-12 text-center text-gray-500">
                <Inbox size={48} className="mx-auto mb-4 text-gray-300" />
                <p>保留中のカードはありません</p>
                <p className="text-sm mt-2">認識画面で「中断して保存」すると追加されます</p>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

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
      case 'pending':
        return (
          <>
            <Header title="保留" subtitle={`${pendingImages.length}件の保留画像`} />
            <PendingPage />
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
          shop={editingShop}
          onClose={() => {
            setShowShopForm(false)
            setEditingShop(null)
          }}
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
          }}
        />
      )}

      {showCardDetail && selectedCard && (
        <CardDetail
          card={selectedCard}
          onClose={() => setShowCardDetail(false)}
          onUpdated={() => setRefresh(r => r + 1)}
        />
      )}

      {showCardImporter && (
        <CardImporter
          onClose={() => setShowCardImporter(false)}
          onCompleted={() => {
            setShowCardImporter(false)
            setRefresh(r => r + 1)
          }}
        />
      )}

      {showBulkRecognition && (
        <BulkRecognition
          imageUrl={bulkRecognitionImage?.url}
          imageBase64={bulkRecognitionImage?.base64}
          shop={selectedShop}
          tweetTime={bulkRecognitionImage?.tweetTime}
          tweetUrl={bulkRecognitionImage?.tweetUrl}
          onClose={() => {
            setShowBulkRecognition(false)
            setBulkRecognitionImage(null)
            fetchPendingImages()
          }}
          onCompleted={() => {
            setShowBulkRecognition(false)
            setBulkRecognitionImage(null)
            setRefresh(r => r + 1)
            fetchPendingImages()
          }}
        />
      )}
    </div>
  )
}

export default TorekaApp
