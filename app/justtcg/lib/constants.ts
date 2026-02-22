// ゲーム設定
export const GAME_OPTIONS = [
  { id: 'pokemon-japan', label: 'ポケモンカード（日本版）', short: 'ポケカ JP' },
  { id: 'pokemon', label: 'Pokemon TCG（英語版）', short: 'ポケカ EN' },
  { id: 'one-piece-card-game', label: 'ワンピースカードゲーム', short: 'ワンピ' },
  { id: 'digimon-card-game', label: 'デジモンカードゲーム', short: 'デジモン' },
  { id: 'union-arena', label: 'ユニオンアリーナ', short: 'UA' },
  { id: 'hololive-official-card-game', label: 'hololive OFFICIAL CARD GAME', short: 'ホロライブ' },
  { id: 'dragon-ball-super-fusion-world', label: 'ドラゴンボール超 FW', short: 'ドラゴンボール' },
] as const

// レアリティバッジの色マッピング
export const RARITY_COLORS: Record<string, { bg: string; text: string }> = {
  'Common':             { bg: 'bg-slate-100', text: 'text-slate-700' },
  'C':                  { bg: 'bg-slate-100', text: 'text-slate-700' },
  'Uncommon':           { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  'U':                  { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  'Rare':               { bg: 'bg-blue-50', text: 'text-blue-700' },
  'R':                  { bg: 'bg-blue-50', text: 'text-blue-700' },
  'RR':                 { bg: 'bg-blue-50', text: 'text-blue-700' },
  'Holo Rare':          { bg: 'bg-indigo-50', text: 'text-indigo-700' },
  'Double Rare':        { bg: 'bg-indigo-50', text: 'text-indigo-700' },
  'Secret Rare':        { bg: 'bg-amber-50', text: 'text-amber-700' },
  'SR':                 { bg: 'bg-amber-50', text: 'text-amber-700' },
  'Ultra Rare':         { bg: 'bg-purple-50', text: 'text-purple-700' },
  'UR':                 { bg: 'bg-purple-50', text: 'text-purple-700' },
  'Illustration Rare':  { bg: 'bg-orange-50', text: 'text-orange-700' },
  'AR':                 { bg: 'bg-orange-50', text: 'text-orange-700' },
  'Special Art Rare':   { bg: 'bg-pink-50', text: 'text-pink-700' },
  'SAR':                { bg: 'bg-pink-50', text: 'text-pink-700' },
  'Hyper Rare':         { bg: 'bg-yellow-50', text: 'text-yellow-700' },
  'HR':                 { bg: 'bg-yellow-50', text: 'text-yellow-700' },
  'Promo':              { bg: 'bg-rose-50', text: 'text-rose-700' },
  'PR':                 { bg: 'bg-rose-50', text: 'text-rose-700' },
}

// ソートオプション
export const SORT_OPTIONS = [
  { value: 'price', label: '価格' },
  { value: 'change7d', label: '7日変動' },
  { value: 'change30d', label: '30日変動' },
  { value: 'number', label: 'カード番号' },
  { value: 'name', label: '名前' },
] as const

export type SortKey = typeof SORT_OPTIONS[number]['value']
