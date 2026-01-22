'use client'

import React, { useState } from 'react';
import { 
  Home, Search, Database, Store, Settings, Eye, Tag, Heart,
  ChevronLeft, ChevronRight, ChevronDown, Plus, Filter, Download,
  TrendingUp, TrendingDown, Clock, AlertTriangle, Check, X,
  ExternalLink, RefreshCw, Play, Pause, Edit3, Trash2, 
  Package, BarChart3, Zap, Link, ShoppingCart, Globe,
  Upload, Camera, Cpu, Image, Calendar, DollarSign, Layers,
  BookOpen, Star, Bell, Shield, Key, Users, FileText
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const TorekaApp = () => {
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [selectedShop, setSelectedShop] = useState(null);
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [showAddShopModal, setShowAddShopModal] = useState(false);

  // サンプルデータ
  const cards = [
    { id: 1, name: 'メガカイリューex', rarity: 'SAR', cardNumber: '246/193', pack: 'M2a', categoryLarge: 'ポケモンカード', categoryMedium: 'スカーレット&バイオレット', categorySmall: '拡張パック', categoryDetail: '超電ブレイカー', image: '🐉', purchasePrice: 62000, salePrice: 68000, lastUpdate: '2024/01/20' },
    { id: 2, name: 'メロコ', rarity: 'SAR', cardNumber: '092/066', pack: 'sv4K', categoryLarge: 'ポケモンカード', categoryMedium: 'スカーレット&バイオレット', categorySmall: '拡張パック', categoryDetail: '古代の咆哮', image: '👩‍🦰', purchasePrice: 11000, salePrice: 13500, lastUpdate: '2024/01/20' },
    { id: 3, name: 'メロン', rarity: 'SAR', cardNumber: '244/172', pack: 's12a', categoryLarge: 'ポケモンカード', categoryMedium: 'ソード&シールド', categorySmall: 'ハイクラスパック', categoryDetail: 'VSTARユニバース', image: '👩‍🍳', purchasePrice: 8500, salePrice: 9800, lastUpdate: '2024/01/20' },
    { id: 4, name: 'リーリエ', rarity: 'SR', cardNumber: '068/060', pack: 'SM1M', categoryLarge: 'ポケモンカード', categoryMedium: 'サン&ムーン', categorySmall: '拡張パック', categoryDetail: 'コレクションムーン', image: '👱‍♀️', purchasePrice: 3050000, salePrice: 3500000, lastUpdate: '2024/01/20' },
    { id: 5, name: 'がんばリーリエ', rarity: 'SR', cardNumber: '396/SM-P', pack: 'PROMO', categoryLarge: 'ポケモンカード', categoryMedium: 'サン&ムーン', categorySmall: 'プロモ', categoryDetail: 'プロモーションカード', image: '👱‍♀️', purchasePrice: 2100000, salePrice: 2400000, lastUpdate: '2024/01/20' },
  ];

  // カテゴリデータ（4階層）
  const categories = {
    large: [
      { id: 1, name: 'ポケモンカード', icon: '⚡', rarities: ['SAR', 'SR', 'AR', 'UR', 'HR', 'RR', 'R', 'U', 'C'] },
      { id: 2, name: 'ワンピースカード', icon: '🏴‍☠️', rarities: ['SEC', 'SR', 'R', 'UC', 'C', 'L', 'SP'] },
      { id: 3, name: '遊戯王', icon: '🎴', rarities: ['ホロ', 'ウルトラ', 'スーパー', 'シークレット', 'レリーフ'] },
    ],
    medium: {
      'ポケモンカード': ['スカーレット&バイオレット', 'ソード&シールド', 'サン&ムーン', 'XY', 'BW', 'DP', '旧裏'],
      'ワンピースカード': ['ブースターパック', 'スタートデッキ', 'プロモ'],
      '遊戯王': ['マスターデュエル', 'ラッシュデュエル'],
    },
    small: {
      'スカーレット&バイオレット': ['拡張パック', 'ハイクラスパック', 'スターターセット', 'プロモ'],
      'ソード&シールド': ['拡張パック', 'ハイクラスパック', 'スターターセット', 'プロモ'],
      'サン&ムーン': ['拡張パック', 'ハイクラスパック', 'GXスタートデッキ', 'プロモ'],
    },
    detail: {
      '拡張パック': ['超電ブレイカー', '変幻の仮面', 'ワイルドフォース', 'サイバージャッジ', '古代の咆哮', '未来の一閃'],
      'ハイクラスパック': ['シャイニートレジャーex', 'VSTARユニバース', 'VMAXクライマックス'],
    }
  };

  const purchaseShops = [
    { id: 1, name: 'Blue Rocket', xAccount: 'bluerocket_tcg', icon: '🚀', status: 'active', cardCount: 156, lastUpdate: '2024/01/20 14:30' },
    { id: 2, name: 'フルアヘッド', xAccount: 'fullahead_tcg', icon: '⚡', status: 'active', cardCount: 243, lastUpdate: '2024/01/20 13:00' },
    { id: 3, name: '遊々亭', xAccount: 'yuyu_tei', icon: '🏠', status: 'active', cardCount: 312, lastUpdate: '2024/01/20 12:30' },
  ];

  const saleSites = [
    { id: 1, name: 'スニーカーダンク', url: 'https://snkrdunk.com', icon: '👟', status: 'active', cardCount: 45, successRate: 98 },
    { id: 2, name: 'カードラッシュ', url: 'https://cardrush.jp', icon: '💳', status: 'active', cardCount: 52, successRate: 95 },
    { id: 3, name: 'トレカキャンプ', url: 'https://torekyanpu.com', icon: '🏕️', status: 'paused', cardCount: 38, successRate: 92 },
  ];

  const recognitionQueue = [
    { id: 1, shop: 'Blue Rocket', shopIcon: '🚀', originalImage: '📋', croppedImage: '🎴', recognizedName: 'メガカイリューex SAR', confidence: 92, price: 62000, status: 'pending' },
    { id: 2, shop: 'フルアヘッド', shopIcon: '⚡', originalImage: '📋', croppedImage: '🎴', recognizedName: 'メロコ SAR', confidence: 88, price: 11000, status: 'pending' },
    { id: 3, shop: 'Blue Rocket', shopIcon: '🚀', originalImage: '📋', croppedImage: '🎴', recognizedName: null, confidence: 0, price: 8500, status: 'unmatched', candidates: ['メロン SAR', 'モモワロウ SAR'] },
  ];

  const priceHistory = [
    { date: '1/14', purchase: 58000, sale: 64000 },
    { date: '1/15', purchase: 59000, sale: 65000 },
    { date: '1/16', purchase: 60000, sale: 66000 },
    { date: '1/17', purchase: 61000, sale: 67000 },
    { date: '1/18', purchase: 60000, sale: 66000 },
    { date: '1/19', purchase: 62000, sale: 68000 },
    { date: '1/20', purchase: 62000, sale: 68000 },
  ];

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
      
      <nav className="p-2 space-y-1">
        {/* メイン */}
        {!sidebarCollapsed && <p className="px-3 py-2 text-xs text-slate-500 uppercase">メイン</p>}
        {[
          { id: 'dashboard', icon: Home, label: 'ダッシュボード' },
          { id: 'cards', icon: Database, label: 'カード管理' },
          { id: 'search', icon: Search, label: '価格検索' },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setCurrentPage(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
              currentPage === item.id
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <item.icon size={20} />
            {!sidebarCollapsed && <span>{item.label}</span>}
          </button>
        ))}

        {/* 買取価格 */}
        {!sidebarCollapsed && <p className="px-3 py-2 text-xs text-slate-500 uppercase mt-4">買取価格</p>}
        {[
          { id: 'purchaseShops', icon: Store, label: '買取店舗' },
          { id: 'recognition', icon: Cpu, label: '認識確認', badge: recognitionQueue.length },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setCurrentPage(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
              currentPage === item.id
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <item.icon size={20} />
            {!sidebarCollapsed && (
              <>
                <span className="flex-1 text-left">{item.label}</span>
                {item.badge && (
                  <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">
                    {item.badge}
                  </span>
                )}
              </>
            )}
          </button>
        ))}

        {/* 販売価格 */}
        {!sidebarCollapsed && <p className="px-3 py-2 text-xs text-slate-500 uppercase mt-4">販売価格</p>}
        {[
          { id: 'saleSites', icon: Globe, label: '販売サイト' },
          { id: 'scraping', icon: RefreshCw, label: 'スクレイピング' },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setCurrentPage(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
              currentPage === item.id
                ? 'bg-blue-600 text-white'
                : 'text-slate-300 hover:bg-slate-800'
            }`}
          >
            <item.icon size={20} />
            {!sidebarCollapsed && <span>{item.label}</span>}
          </button>
        ))}

        {/* 設定 */}
        {!sidebarCollapsed && <p className="px-3 py-2 text-xs text-slate-500 uppercase mt-4">設定</p>}
        {[
          { id: 'categories', icon: Tag, label: 'カテゴリ' },
          { id: 'api', icon: Key, label: 'API設定' },
          { id: 'settings', icon: Settings, label: '設定' },
        ].map(item => (
          <button
            key={item.id}
            onClick={() => setCurrentPage(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
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
  );

  // ヘッダー
  const Header = ({ title, subtitle }) => (
    <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-40">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-800">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="カード名で検索..."
              className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg w-80 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>
          <button className="p-2 hover:bg-gray-100 rounded-lg relative">
            <Bell size={20} className="text-gray-600" />
            <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">3</span>
          </button>
        </div>
      </div>
    </header>
  );

  // ダッシュボード
  const DashboardPage = () => (
    <div className="p-6 space-y-6">
      {/* 統計カード */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">登録カード</p>
              <p className="text-2xl font-bold text-gray-800">{cards.length}</p>
            </div>
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Database size={20} className="text-blue-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">買取店舗</p>
              <p className="text-2xl font-bold text-gray-800">{purchaseShops.length}</p>
            </div>
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Store size={20} className="text-green-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">販売サイト</p>
              <p className="text-2xl font-bold text-gray-800">{saleSites.length}</p>
            </div>
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Globe size={20} className="text-purple-600" />
            </div>
          </div>
        </div>
        
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">認識待ち</p>
              <p className="text-2xl font-bold text-yellow-600">{recognitionQueue.length}</p>
            </div>
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <Clock size={20} className="text-yellow-600" />
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* 価格推移グラフ */}
        <div className="col-span-2 bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800">メガカイリューex SAR - 価格推移</h2>
            <select className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm">
              <option>過去7日間</option>
              <option>過去30日間</option>
            </select>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={priceHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `¥${(v/1000)}k`} />
              <Tooltip formatter={(value) => `¥${value.toLocaleString()}`} />
              <Area type="monotone" dataKey="sale" stroke="#10b981" fill="#10b98120" strokeWidth={2} name="販売価格" />
              <Area type="monotone" dataKey="purchase" stroke="#3b82f6" fill="#3b82f620" strokeWidth={2} name="買取価格" />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-6 mt-2">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-xs text-gray-600">買取価格</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-xs text-gray-600">販売価格</span>
            </div>
          </div>
        </div>

        {/* 認識待ちリスト */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-gray-800">認識待ち</h2>
            <button 
              onClick={() => setCurrentPage('recognition')}
              className="text-sm text-blue-600 hover:text-blue-700"
            >
              すべて見る →
            </button>
          </div>
          <div className="space-y-3">
            {recognitionQueue.slice(0, 3).map(item => (
              <div key={item.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <span className="text-xl">{item.shopIcon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-800 truncate">
                    {item.recognizedName || '未認識'}
                  </p>
                  <p className="text-xs text-gray-500">{item.shop}</p>
                </div>
                {item.confidence > 0 ? (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    item.confidence >= 90 ? 'bg-green-100 text-green-600' :
                    item.confidence >= 70 ? 'bg-yellow-100 text-yellow-600' :
                    'bg-red-100 text-red-600'
                  }`}>
                    {item.confidence}%
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-xs">要確認</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 最新価格一覧 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-800">価格一覧</h2>
          <button className="text-sm text-blue-600 hover:text-blue-700">すべて見る →</button>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">カード名</th>
              <th className="text-left px-4 py-3 text-xs font-medium text-gray-500">レアリティ</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">買取価格</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">販売価格</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">差額</th>
              <th className="text-right px-4 py-3 text-xs font-medium text-gray-500">更新日</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {cards.map(card => (
              <tr key={card.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => { setSelectedCard(card); setCurrentPage('cardDetail'); }}>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{card.image}</span>
                    <div>
                      <p className="font-medium text-gray-800">{card.name}</p>
                      <p className="text-xs text-gray-500">{card.pack}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 bg-purple-100 text-purple-600 rounded text-xs font-medium">{card.rarity}</span>
                </td>
                <td className="px-4 py-3 text-right font-medium text-blue-600">¥{card.purchasePrice.toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-medium text-green-600">¥{card.salePrice.toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-800">¥{(card.salePrice - card.purchasePrice).toLocaleString()}</td>
                <td className="px-4 py-3 text-right text-sm text-gray-500">{card.lastUpdate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // カード管理ページ
  const CardsPage = () => (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-500">登録カードの管理・追加</p>
        </div>
        <button 
          onClick={() => setShowAddCardModal(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
        >
          <Plus size={18} />
          カード追加
        </button>
      </div>

      {/* フィルター */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
        <div className="flex items-center gap-4">
          <select className="px-3 py-2 border border-gray-200 rounded-lg bg-white">
            <option>すべてのカテゴリ</option>
            <option>ポケモンカード</option>
            <option>ワンピースカード</option>
            <option>遊戯王</option>
          </select>
          <select className="px-3 py-2 border border-gray-200 rounded-lg bg-white">
            <option>すべてのレアリティ</option>
            <option>SAR</option>
            <option>SR</option>
            <option>UR</option>
          </select>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="カード名で検索..."
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* カードグリッド */}
      <div className="grid grid-cols-4 gap-4">
        {cards.map(card => (
          <div 
            key={card.id}
            onClick={() => { setSelectedCard(card); setCurrentPage('cardDetail'); }}
            className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow cursor-pointer"
          >
            <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center text-6xl mb-3">
              {card.image}
            </div>
            <h3 className="font-bold text-gray-800 truncate">{card.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="px-2 py-0.5 bg-purple-100 text-purple-600 rounded text-xs">{card.rarity}</span>
              <span className="text-xs text-gray-500 truncate">{card.categoryDetail}</span>
            </div>
            <div className="mt-3 pt-3 border-t border-gray-100">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">買取</span>
                <span className="font-medium text-blue-600">¥{card.purchasePrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-gray-500">販売</span>
                <span className="font-medium text-green-600">¥{card.salePrice.toLocaleString()}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // カード詳細ページ
  const CardDetailPage = () => {
    const card = selectedCard || cards[0];
    const [activeTab, setActiveTab] = useState('price');
    
    return (
    <div className="p-6 space-y-6">
      <button onClick={() => setCurrentPage('cards')} className="flex items-center gap-2 text-gray-500 hover:text-gray-800">
        <ChevronLeft size={20} />
        <span>カード一覧に戻る</span>
      </button>

      <div className="grid grid-cols-3 gap-6">
        {/* カード情報 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center text-8xl mb-4">
            {card.image}
          </div>
          <h2 className="text-xl font-bold text-gray-800">{card.name}</h2>
          <div className="flex items-center gap-2 mt-2">
            <span className="px-2 py-1 bg-purple-100 text-purple-600 rounded text-sm font-medium">{card.rarity}</span>
            <span className="text-sm text-gray-500">{card.cardNumber}</span>
          </div>
          
          <div className="mt-4 space-y-2">
            <div className="flex justify-between py-2 border-b border-gray-50">
              <span className="text-sm text-gray-500">大カテゴリ</span>
              <span className="text-sm font-medium text-gray-800">{card.categoryLarge}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-50">
              <span className="text-sm text-gray-500">中カテゴリ</span>
              <span className="text-sm font-medium text-gray-800">{card.categoryMedium}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-50">
              <span className="text-sm text-gray-500">小カテゴリ</span>
              <span className="text-sm font-medium text-gray-800">{card.categorySmall}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-50">
              <span className="text-sm text-gray-500">詳細</span>
              <span className="text-sm font-medium text-gray-800">{card.categoryDetail}</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-sm text-gray-500">最終更新</span>
              <span className="text-sm font-medium text-gray-800">{card.lastUpdate}</span>
            </div>
          </div>
          
          <button className="mt-4 w-full py-2 border border-blue-500 text-blue-500 rounded-lg hover:bg-blue-50 flex items-center justify-center gap-2">
            <Edit3 size={16} />
            編集
          </button>
        </div>

        {/* 価格情報 */}
        <div className="col-span-2 space-y-6">
          {/* タブ */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100">
            <div className="flex border-b border-gray-100">
              {[
                { id: 'price', label: '価格推移' },
                { id: 'purchase', label: '買取価格' },
                { id: 'sale', label: '販売価格' },
                { id: 'urls', label: '販売URL設定' },
                { id: 'learning', label: '学習用画像' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-800'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {activeTab === 'price' && (
              <div className="p-6">
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-600">最高買取価格</p>
                    <p className="text-2xl font-bold text-blue-600">¥{card.purchasePrice.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 mt-1">Blue Rocket</p>
                  </div>
                  <div className="p-4 bg-green-50 rounded-lg">
                    <p className="text-sm text-green-600">最安販売価格</p>
                    <p className="text-2xl font-bold text-green-600">¥{card.salePrice.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 mt-1">スニーカーダンク</p>
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={priceHistory}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `¥${(v/1000)}k`} />
                    <Tooltip formatter={(value) => `¥${value.toLocaleString()}`} />
                    <Area type="monotone" dataKey="sale" stroke="#10b981" fill="#10b98120" strokeWidth={2} name="販売" />
                    <Area type="monotone" dataKey="purchase" stroke="#3b82f6" fill="#3b82f620" strokeWidth={2} name="買取" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}

            {activeTab === 'purchase' && (
              <div className="p-6">
                <h3 className="font-bold text-gray-800 mb-4">買取店舗別価格</h3>
                <div className="space-y-3">
                  {purchaseShops.map(shop => (
                    <div key={shop.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{shop.icon}</span>
                        <div>
                          <p className="font-medium text-gray-800">{shop.name}</p>
                          <p className="text-xs text-gray-500">更新: {shop.lastUpdate}</p>
                        </div>
                      </div>
                      <p className="text-xl font-bold text-blue-600">¥{(card.purchasePrice - Math.floor(Math.random() * 3000)).toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'sale' && (
              <div className="p-6">
                <h3 className="font-bold text-gray-800 mb-4">販売サイト別価格</h3>
                <div className="space-y-3">
                  {saleSites.map(site => (
                    <div key={site.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{site.icon}</span>
                        <div>
                          <p className="font-medium text-gray-800">{site.name}</p>
                          <p className="text-xs text-gray-500">在庫あり</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-green-600">¥{(card.salePrice + Math.floor(Math.random() * 5000)).toLocaleString()}</p>
                        <a href="#" className="text-xs text-blue-500 hover:underline flex items-center gap-1 justify-end">
                          商品ページ <ExternalLink size={10} />
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'urls' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-gray-800">販売URL設定</h3>
                    <p className="text-sm text-gray-500">スクレイピング対象のURLを設定</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {saleSites.map(site => (
                    <div key={site.id} className="p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-2xl">{site.icon}</span>
                        <span className="font-medium text-gray-800">{site.name}</span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder={`${site.url}/products/...`}
                          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                          defaultValue={site.id === 1 ? 'https://snkrdunk.com/products/pokemon-card-mega-kairyu-ex-sar' : ''}
                        />
                        <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
                          保存
                        </button>
                      </div>
                      {site.id === 1 && (
                        <div className="mt-3 flex items-center gap-4 text-sm">
                          <span className="text-gray-500">次回取得: <span className="text-gray-800">1時間後</span></span>
                          <span className="text-gray-500">現在間隔: <span className="text-gray-800">1h</span></span>
                          <span className="px-2 py-0.5 bg-green-100 text-green-600 rounded text-xs">稼働中</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'learning' && (
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-gray-800">学習用画像</h3>
                    <p className="text-sm text-gray-500">複数の画像を登録すると認識精度が上がります</p>
                  </div>
                  <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2">
                    <Plus size={16} />
                    画像追加
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-4">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="relative group">
                      <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center text-4xl">
                        {card.image}
                      </div>
                      <button className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <div className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 hover:border-blue-500 hover:text-blue-500 cursor-pointer transition-colors">
                    <Plus size={24} />
                    <span className="text-xs mt-1">追加</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )};

  // カード追加モーダル
  const AddCardModal = () => {
    const [imageUploaded, setImageUploaded] = useState(false);
    const [recognizing, setRecognizing] = useState(false);
    const [recognized, setRecognized] = useState(false);
    const [selectedLarge, setSelectedLarge] = useState('ポケモンカード');
    const [selectedMedium, setSelectedMedium] = useState('スカーレット&バイオレット');
    const [selectedSmall, setSelectedSmall] = useState('拡張パック');
    const [selectedDetail, setSelectedDetail] = useState('超電ブレイカー');
    const [rarityInput, setRarityInput] = useState('SAR');

    // 選択中の大カテゴリのレアリティ候補を取得
    const currentRarities = categories.large.find(c => c.name === selectedLarge)?.rarities || [];

    const handleImageUpload = () => {
      setImageUploaded(true);
      setRecognizing(true);
      setTimeout(() => {
        setRecognizing(false);
        setRecognized(true);
      }, 1500);
    };

    return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl w-[800px] max-h-[90vh] overflow-auto">
        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">カード追加</h2>
          <button onClick={() => setShowAddCardModal(false)} className="p-2 hover:bg-gray-100 rounded-lg">
            <X size={20} className="text-gray-500" />
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* 画像アップロード */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">カード画像</label>
            {!imageUploaded ? (
              <div 
                onClick={handleImageUpload}
                className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:border-blue-500 cursor-pointer transition-colors"
              >
                <Upload size={40} className="mx-auto text-gray-400 mb-2" />
                <p className="text-gray-600">クリックして画像をアップロード</p>
                <p className="text-xs text-gray-400 mt-1">画像から自動でカード情報を認識します</p>
              </div>
            ) : (
              <div className="flex gap-4">
                <div className="w-40 h-56 bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg flex items-center justify-center text-6xl">
                  🐉
                </div>
                <div className="flex-1">
                  {recognizing ? (
                    <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-lg">
                      <RefreshCw size={20} className="text-blue-500 animate-spin" />
                      <span className="text-blue-600">AI認識中...</span>
                    </div>
                  ) : recognized ? (
                    <div className="p-4 bg-green-50 rounded-lg">
                      <div className="flex items-center gap-2 text-green-600 mb-2">
                        <Check size={20} />
                        <span className="font-medium">認識完了</span>
                      </div>
                      <p className="text-sm text-gray-600">カード情報が自動入力されました</p>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>

          {/* 認識結果のフォーム */}
          {recognized && (
            <>
              {/* 基本情報 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">カード名</label>
                  <input
                    type="text"
                    defaultValue="メガカイリューex"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">カード番号</label>
                  <input
                    type="text"
                    defaultValue="246/193"
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                  />
                </div>
              </div>

              {/* 4階層カテゴリ */}
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm font-medium text-gray-700 mb-3">カテゴリ（4階層）</p>
                <div className="grid grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">大カテゴリ</label>
                    <select 
                      value={selectedLarge}
                      onChange={(e) => {
                        setSelectedLarge(e.target.value);
                        setSelectedMedium('');
                        setSelectedSmall('');
                        setSelectedDetail('');
                      }}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm"
                    >
                      {categories.large.map(cat => (
                        <option key={cat.id} value={cat.name}>{cat.icon} {cat.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">中カテゴリ</label>
                    <select 
                      value={selectedMedium}
                      onChange={(e) => {
                        setSelectedMedium(e.target.value);
                        setSelectedSmall('');
                        setSelectedDetail('');
                      }}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm"
                    >
                      <option value="">選択してください</option>
                      {(categories.medium[selectedLarge] || []).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">小カテゴリ</label>
                    <select 
                      value={selectedSmall}
                      onChange={(e) => {
                        setSelectedSmall(e.target.value);
                        setSelectedDetail('');
                      }}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm"
                    >
                      <option value="">選択してください</option>
                      {(categories.small[selectedMedium] || []).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">詳細</label>
                    <select 
                      value={selectedDetail}
                      onChange={(e) => setSelectedDetail(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-sm"
                    >
                      <option value="">選択してください</option>
                      {(categories.detail[selectedSmall] || []).map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* レアリティ（カテゴリ別サジェスト） */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">レアリティ</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={rarityInput}
                    onChange={(e) => setRarityInput(e.target.value)}
                    placeholder="自由入力可能"
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg"
                  />
                </div>
                {/* サジェスト */}
                <div className="flex flex-wrap gap-2 mt-2">
                  {currentRarities.map(rarity => (
                    <button
                      key={rarity}
                      onClick={() => setRarityInput(rarity)}
                      className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                        rarityInput === rarity 
                          ? 'bg-purple-100 border-purple-300 text-purple-600' 
                          : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      {rarity}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1">※ 上記以外も自由に入力できます</p>
              </div>

              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">
                  <Cpu size={14} className="inline mr-1" />
                  Claude Vision で認識 | 信頼度: 98%
                </p>
              </div>
            </>
          )}
        </div>

        <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
          <button
            onClick={() => setShowAddCardModal(false)}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
          >
            キャンセル
          </button>
          <button
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            disabled={!recognized}
          >
            登録
          </button>
        </div>
      </div>
    </div>
  )};

  // 買取店舗ページ
  const PurchaseShopsPage = () => (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-gray-500">Xから買取表を取得する店舗を管理</p>
        <button 
          onClick={() => setShowAddShopModal(true)}
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
        >
          <Plus size={18} />
          店舗追加
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {purchaseShops.map(shop => (
          <div key={shop.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center text-3xl">
                  {shop.icon}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">{shop.name}</h3>
                  <p className="text-sm text-gray-500">@{shop.xAccount}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  shop.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                }`}>
                  {shop.status === 'active' ? '監視中' : '停止中'}
                </span>
                <button className="p-2 hover:bg-gray-100 rounded-lg">
                  <Edit3 size={18} className="text-gray-500" />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-gray-800">{shop.cardCount}</p>
                <p className="text-xs text-gray-500">登録価格</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-gray-800">{shop.lastUpdate.split(' ')[1]}</p>
                <p className="text-xs text-gray-500">最終取得</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">95%</p>
                <p className="text-xs text-gray-500">認識精度</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // 認識確認ページ
  const RecognitionPage = () => {
    const [activeTab, setActiveTab] = useState('pending');
    
    return (
    <div className="p-6 space-y-6">
      {/* 統計 */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">要確認</p>
              <p className="text-2xl font-bold text-yellow-600">2</p>
            </div>
            <Clock size={20} className="text-yellow-600" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">未マッチ</p>
              <p className="text-2xl font-bold text-red-600">1</p>
            </div>
            <AlertTriangle size={20} className="text-red-600" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">本日承認</p>
              <p className="text-2xl font-bold text-green-600">24</p>
            </div>
            <Check size={20} className="text-green-600" />
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">認識精度</p>
              <p className="text-2xl font-bold text-blue-600">87%</p>
            </div>
            <Cpu size={20} className="text-blue-600" />
          </div>
        </div>
      </div>

      {/* タブ */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="flex border-b border-gray-100">
          {[
            { id: 'pending', label: '要確認', count: 2 },
            { id: 'unmatched', label: '未マッチ', count: 1 },
            { id: 'lowConfidence', label: '低信頼度', count: 0 },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {tab.label}
              <span className={`px-2 py-0.5 rounded-full text-xs ${
                tab.count > 0 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'
              }`}>{tab.count}</span>
            </button>
          ))}
        </div>

        <div className="p-6">
          {recognitionQueue.filter(item => 
            activeTab === 'pending' ? item.status === 'pending' :
            activeTab === 'unmatched' ? item.status === 'unmatched' :
            item.confidence < 70 && item.confidence > 0
          ).map(item => (
            <div key={item.id} className="border border-gray-200 rounded-xl p-4 mb-4">
              <div className="flex gap-6">
                {/* 元画像 */}
                <div className="text-center">
                  <p className="text-xs text-gray-400 mb-2">元画像</p>
                  <div className="w-32 h-40 bg-gray-100 rounded-lg flex items-center justify-center text-4xl relative">
                    {item.originalImage}
                    <div className="absolute inset-4 border-2 border-red-500 rounded"></div>
                  </div>
                </div>

                {/* 矢印 */}
                <div className="flex items-center text-gray-300">
                  <ChevronRight size={24} />
                </div>

                {/* 切り出し画像 */}
                <div className="text-center">
                  <p className="text-xs text-gray-400 mb-2">切り出し</p>
                  <div className="w-24 h-32 bg-blue-50 border-2 border-blue-300 rounded-lg flex items-center justify-center text-3xl">
                    {item.croppedImage}
                  </div>
                </div>

                {/* 矢印 */}
                <div className="flex items-center text-gray-300">
                  <ChevronRight size={24} />
                </div>

                {/* 認識結果 */}
                <div className="flex-1">
                  <p className="text-xs text-gray-400 mb-2">認識結果</p>
                  <div className={`p-4 rounded-lg ${item.recognizedName ? 'bg-green-50' : 'bg-red-50'}`}>
                    {item.recognizedName ? (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-bold text-gray-800">{item.recognizedName}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-sm font-medium ${
                            item.confidence >= 90 ? 'bg-green-100 text-green-600' :
                            item.confidence >= 70 ? 'bg-yellow-100 text-yellow-600' :
                            'bg-red-100 text-red-600'
                          }`}>
                            {item.confidence}%
                          </span>
                        </div>
                        <p className="text-lg font-bold text-blue-600">¥{item.price.toLocaleString()}</p>
                        <p className="text-xs text-gray-500 mt-1">{item.shop}</p>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2 text-red-600 mb-2">
                          <AlertTriangle size={16} />
                          <span className="font-medium">マッチするカードが見つかりません</span>
                        </div>
                        <p className="text-lg font-bold text-blue-600 mb-2">¥{item.price.toLocaleString()}</p>
                        {item.candidates && (
                          <div>
                            <p className="text-xs text-gray-500 mb-2">候補:</p>
                            <div className="flex gap-2">
                              {item.candidates.map((c, i) => (
                                <button key={i} className="px-3 py-1.5 border border-blue-300 text-blue-600 rounded-lg text-sm hover:bg-blue-50">
                                  {c}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* アクション */}
                  <div className="flex gap-2 mt-3">
                    {item.recognizedName && (
                      <button className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm hover:bg-green-600 flex items-center gap-1">
                        <Check size={16} />
                        承認
                      </button>
                    )}
                    <button className="px-4 py-2 border border-blue-300 text-blue-600 rounded-lg text-sm hover:bg-blue-50 flex items-center gap-1">
                      <Search size={16} />
                      カード検索
                    </button>
                    <button className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm hover:bg-gray-50 flex items-center gap-1">
                      <X size={16} />
                      スキップ
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )};

  // 販売サイトページ
  const SaleSitesPage = () => (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-gray-500">スクレイピング対象サイトを管理</p>
        <button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2">
          <Plus size={18} />
          サイト追加
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {saleSites.map(site => (
          <div key={site.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl flex items-center justify-center text-3xl">
                  {site.icon}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800">{site.name}</h3>
                  <a href={site.url} className="text-sm text-blue-500 hover:underline flex items-center gap-1">
                    {site.url} <ExternalLink size={12} />
                  </a>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  site.status === 'active' ? 'bg-green-100 text-green-600' : 'bg-yellow-100 text-yellow-600'
                }`}>
                  {site.status === 'active' ? '稼働中' : '一時停止'}
                </span>
                <button className="p-2 hover:bg-gray-100 rounded-lg">
                  <Settings size={18} className="text-gray-500" />
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-3 gap-4 mt-6">
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-gray-800">{site.cardCount}</p>
                <p className="text-xs text-gray-500">監視カード</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-green-600">{site.successRate}%</p>
                <p className="text-xs text-gray-500">成功率</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg text-center">
                <p className="text-2xl font-bold text-gray-800">4時間</p>
                <p className="text-xs text-gray-500">平均間隔</p>
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 flex items-center gap-2">
                <Play size={16} />
                今すぐ実行
              </button>
              <button className="px-4 py-2 border border-gray-300 text-gray-600 rounded-lg hover:bg-gray-50">
                詳細設定
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // スクレイピング設定ページ
  const ScrapingSettingsPage = () => (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 gap-6">
        {/* 間隔設定 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-bold text-gray-800 mb-4">間隔自動調整</h3>
          <div className="space-y-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-600 mb-2">間隔段階</p>
              <div className="flex items-center gap-2 text-sm">
                <span className="px-2 py-1 bg-blue-100 rounded">30分</span>
                <ChevronRight size={16} className="text-gray-400" />
                <span className="px-2 py-1 bg-blue-100 rounded">1時間</span>
                <ChevronRight size={16} className="text-gray-400" />
                <span className="px-2 py-1 bg-blue-100 rounded">3時間</span>
                <ChevronRight size={16} className="text-gray-400" />
                <span className="px-2 py-1 bg-blue-100 rounded">6時間</span>
                <ChevronRight size={16} className="text-gray-400" />
                <span className="px-2 py-1 bg-blue-100 rounded">12時間</span>
                <ChevronRight size={16} className="text-gray-400" />
                <span className="px-2 py-1 bg-blue-100 rounded">24時間</span>
              </div>
            </div>
            <div className="flex items-center justify-between py-3 border-b border-gray-100">
              <div>
                <p className="font-medium text-gray-800">価格変動時</p>
                <p className="text-xs text-gray-500">1段階上（短く）に戻る</p>
              </div>
              <span className="text-sm text-gray-600">例: 3時間 → 1時間</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-gray-800">変動なし時</p>
                <p className="text-xs text-gray-500">1段階下（長く）に進む</p>
              </div>
              <span className="text-sm text-gray-600">例: 3時間 → 6時間</span>
            </div>
            <div className="flex items-center justify-between py-3 border-t border-gray-100">
              <div>
                <p className="font-medium text-gray-800">揺らぎ幅</p>
                <p className="text-xs text-gray-500">機械的なアクセスに見せない</p>
              </div>
              <select className="px-3 py-1.5 border border-gray-200 rounded-lg text-sm">
                <option>0〜30%</option>
                <option>0〜50%</option>
                <option>0〜100%</option>
              </select>
            </div>
          </div>
        </div>

        {/* 監視しない時間 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-bold text-gray-800 mb-4">監視しない時間</h3>
          <p className="text-sm text-gray-500 mb-4">曜日ごとに2枠まで設定可能</p>
          
          <div className="space-y-3">
            {['月', '火', '水', '木', '金', '土', '日'].map((day, index) => (
              <div key={day} className="flex items-center gap-4 py-2 border-b border-gray-50">
                <span className="w-8 text-sm font-medium text-gray-800">{day}</span>
                <div className="flex-1 flex items-center gap-2">
                  <input type="time" defaultValue="02:00" className="px-2 py-1 border border-gray-200 rounded text-sm" />
                  <span className="text-gray-400">〜</span>
                  <input type="time" defaultValue="07:00" className="px-2 py-1 border border-gray-200 rounded text-sm" />
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <input type="time" defaultValue="11:00" className="px-2 py-1 border border-gray-200 rounded text-sm" />
                  <span className="text-gray-400">〜</span>
                  <input type="time" defaultValue="13:00" className="px-2 py-1 border border-gray-200 rounded text-sm" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  // API設定ページ
  const ApiSettingsPage = () => (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 gap-6">
        {/* AI認識設定 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-bold text-gray-800 mb-4">AI認識設定</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">認識エンジン</label>
              <div className="space-y-2">
                {[
                  { id: 'claude', name: 'Claude Vision', desc: '推奨', active: true },
                  { id: 'gpt4v', name: 'GPT-4 Vision', desc: '高精度', active: false },
                  { id: 'gemini', name: 'Gemini Vision', desc: '低コスト', active: false },
                ].map(engine => (
                  <label key={engine.id} className={`flex items-center p-3 rounded-lg cursor-pointer ${engine.active ? 'bg-blue-50 border-2 border-blue-500' : 'bg-gray-50 border-2 border-transparent'}`}>
                    <input type="radio" name="engine" defaultChecked={engine.active} className="mr-3" />
                    <div>
                      <p className="font-medium text-gray-800">{engine.name}</p>
                      <p className="text-xs text-gray-500">{engine.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <p className="text-xs text-gray-500">※ 後から別のAIに変更可能です</p>
          </div>
        </div>

        {/* APIキー設定 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="font-bold text-gray-800 mb-4">APIキー設定</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Anthropic API Key</label>
              <input
                type="password"
                placeholder="sk-ant-..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                defaultValue="sk-ant-xxxxx"
              />
              <p className="text-xs text-gray-500 mt-1">Claude Vision用</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">X API Key</label>
              <input
                type="password"
                placeholder="..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                defaultValue="xxxxx"
              />
              <p className="text-xs text-gray-500 mt-1">買取表取得用</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Google Vision API Key（将来用）</label>
              <input
                type="password"
                placeholder="..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg"
              />
              <p className="text-xs text-gray-500 mt-1">2重チェック用（オプション）</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // カテゴリ管理ページ
  const CategoriesPage = () => {
    const [selectedLarge, setSelectedLarge] = useState(categories.large[0]);
    const [showAddRarityModal, setShowAddRarityModal] = useState(false);
    const [newRarity, setNewRarity] = useState('');

    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <p className="text-gray-500">カテゴリとレアリティを管理</p>
        </div>

        <div className="grid grid-cols-3 gap-6">
          {/* 大カテゴリ一覧 */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-800">大カテゴリ</h3>
              <button className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                <Plus size={16} />
              </button>
            </div>
            <div className="space-y-2">
              {categories.large.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setSelectedLarge(cat)}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors text-left ${
                    selectedLarge.id === cat.id
                      ? 'bg-blue-50 border-2 border-blue-500'
                      : 'bg-gray-50 hover:bg-gray-100 border-2 border-transparent'
                  }`}
                >
                  <span className="text-2xl">{cat.icon}</span>
                  <div>
                    <p className="font-medium text-gray-800">{cat.name}</p>
                    <p className="text-xs text-gray-500">{cat.rarities.length}種のレアリティ</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* 選択中のカテゴリ詳細 */}
          <div className="col-span-2 space-y-6">
            {/* レアリティ管理 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-bold text-gray-800">
                    {selectedLarge.icon} {selectedLarge.name} のレアリティ
                  </h3>
                  <p className="text-sm text-gray-500">自由に追加・削除できます</p>
                </div>
                <button 
                  onClick={() => setShowAddRarityModal(true)}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center gap-2"
                >
                  <Plus size={16} />
                  レアリティ追加
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {selectedLarge.rarities.map(rarity => (
                  <div key={rarity} className="flex items-center gap-1 px-3 py-2 bg-purple-50 border border-purple-200 rounded-lg">
                    <span className="text-purple-600 font-medium">{rarity}</span>
                    <button className="p-0.5 hover:bg-purple-100 rounded">
                      <X size={14} className="text-purple-400" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 中カテゴリ */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800">中カテゴリ</h3>
                <button className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                  <Plus size={16} />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(categories.medium[selectedLarge.name] || []).map(cat => (
                  <div key={cat} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-800">{cat}</span>
                    <button className="p-1 hover:bg-gray-200 rounded">
                      <Edit3 size={14} className="text-gray-400" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* カテゴリ階層図 */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-bold text-gray-800 mb-4">カテゴリ階層</h3>
              <div className="p-4 bg-gray-50 rounded-lg font-mono text-sm">
                <p className="text-gray-800">{selectedLarge.icon} {selectedLarge.name}</p>
                {(categories.medium[selectedLarge.name] || []).slice(0, 2).map((med, i) => (
                  <div key={med} className="ml-4">
                    <p className="text-gray-600">├── {med}</p>
                    {(categories.small[med] || []).slice(0, 2).map((small, j) => (
                      <div key={small} className="ml-4">
                        <p className="text-gray-500">├── {small}</p>
                        {(categories.detail[small] || []).slice(0, 2).map((detail, k) => (
                          <p key={detail} className="ml-4 text-gray-400">├── {detail}</p>
                        ))}
                      </div>
                    ))}
                  </div>
                ))}
                <p className="text-gray-400 ml-4">└── ...</p>
              </div>
            </div>
          </div>
        </div>

        {/* レアリティ追加モーダル */}
        {showAddRarityModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl w-[400px] p-6">
              <h3 className="font-bold text-gray-800 mb-4">レアリティ追加</h3>
              <p className="text-sm text-gray-500 mb-4">「{selectedLarge.name}」に新しいレアリティを追加</p>
              <input
                type="text"
                value={newRarity}
                onChange={(e) => setNewRarity(e.target.value)}
                placeholder="例: SSR, UR, など"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg mb-4"
              />
              <div className="flex justify-end gap-3">
                <button 
                  onClick={() => setShowAddRarityModal(false)}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                >
                  キャンセル
                </button>
                <button 
                  onClick={() => setShowAddRarityModal(false)}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                >
                  追加
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  // 設定ページ
  const SettingsPage = () => (
    <div className="p-6 space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h3 className="font-bold text-gray-800 mb-4">一般設定</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <p className="font-medium text-gray-800">高信頼度（90%以上）は自動承認</p>
              <p className="text-xs text-gray-500">認識確認をスキップ</p>
            </div>
            <button className="w-12 h-6 bg-gray-300 rounded-full relative">
              <div className="w-5 h-5 bg-white rounded-full shadow absolute left-0.5 top-0.5"></div>
            </button>
          </div>
          <div className="flex items-center justify-between py-3 border-b border-gray-100">
            <div>
              <p className="font-medium text-gray-800">価格変更なしはスキップ</p>
              <p className="text-xs text-gray-500">同じ価格の場合は確認リストに表示しない</p>
            </div>
            <button className="w-12 h-6 bg-blue-500 rounded-full relative">
              <div className="w-5 h-5 bg-white rounded-full shadow absolute right-0.5 top-0.5"></div>
            </button>
          </div>
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-gray-800">認識完了通知</p>
              <p className="text-xs text-gray-500">認識が完了したら通知</p>
            </div>
            <button className="w-12 h-6 bg-blue-500 rounded-full relative">
              <div className="w-5 h-5 bg-white rounded-full shadow absolute right-0.5 top-0.5"></div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  // ページルーティング
  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard': return <><Header title="ダッシュボード" /><DashboardPage /></>;
      case 'cards': return <><Header title="カード管理" subtitle={`${cards.length}件のカード`} /><CardsPage /></>;
      case 'cardDetail': return <><Header title="カード詳細" /><CardDetailPage /></>;
      case 'search': return <><Header title="価格検索" /><DashboardPage /></>;
      case 'purchaseShops': return <><Header title="買取店舗" subtitle="Xから買取表を取得" /><PurchaseShopsPage /></>;
      case 'recognition': return <><Header title="認識確認" subtitle="買取表の認識結果を確認" /><RecognitionPage /></>;
      case 'saleSites': return <><Header title="販売サイト" subtitle="スクレイピング対象サイト" /><SaleSitesPage /></>;
      case 'scraping': return <><Header title="スクレイピング設定" /><ScrapingSettingsPage /></>;
      case 'categories': return <><Header title="カテゴリ管理" subtitle="4階層カテゴリとレアリティ" /><CategoriesPage /></>;
      case 'api': return <><Header title="API設定" subtitle="認識エンジン・APIキー" /><ApiSettingsPage /></>;
      case 'settings': return <><Header title="設定" /><SettingsPage /></>;
      default: return <><Header title="ダッシュボード" /><DashboardPage /></>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Hiragino Sans", "Hiragino Kaku Gothic ProN", Meiryo, sans-serif' }}>
      <Sidebar />
      <main className={`transition-all duration-300 ${sidebarCollapsed ? 'ml-16' : 'ml-64'}`}>
        {renderPage()}
      </main>
      {showAddCardModal && <AddCardModal />}
    </div>
  );
};

export default TorekaApp;
