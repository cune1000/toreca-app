// ゲーム設定
export const GAME_OPTIONS = [
  { id: 'pokemon-japan', label: 'ポケモンカード（日本版）', short: 'ポケカ JP' },
  { id: 'one-piece-card-game', label: 'ワンピースカードゲーム', short: 'ワンピ' },
] as const

// レアリティバッジの色マッピング（英語フルネーム + 短縮名の両対応）
export const RARITY_COLORS: Record<string, { bg: string; text: string }> = {
  // Common
  'Common':             { bg: 'bg-slate-100', text: 'text-slate-700' },
  'C':                  { bg: 'bg-slate-100', text: 'text-slate-700' },
  'コモン':             { bg: 'bg-slate-100', text: 'text-slate-700' },
  // Uncommon
  'Uncommon':           { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  'U':                  { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  'アンコモン':         { bg: 'bg-emerald-50', text: 'text-emerald-700' },
  // Rare
  'Rare':               { bg: 'bg-blue-50', text: 'text-blue-700' },
  'R':                  { bg: 'bg-blue-50', text: 'text-blue-700' },
  'Holo Rare':          { bg: 'bg-blue-50', text: 'text-blue-700' },
  // Double Rare
  'Double Rare':        { bg: 'bg-indigo-50', text: 'text-indigo-700' },
  'RR':                 { bg: 'bg-indigo-50', text: 'text-indigo-700' },
  // Triple Rare
  'Triple Rare':        { bg: 'bg-violet-50', text: 'text-violet-700' },
  'RRR':                { bg: 'bg-violet-50', text: 'text-violet-700' },
  // Secret Rare / Super Rare
  'Secret Rare':        { bg: 'bg-amber-50', text: 'text-amber-700' },
  'Super Rare':         { bg: 'bg-amber-50', text: 'text-amber-700' },
  'SR':                 { bg: 'bg-amber-50', text: 'text-amber-700' },
  // Ultra Rare
  'Ultra Rare':         { bg: 'bg-purple-50', text: 'text-purple-700' },
  'UR':                 { bg: 'bg-purple-50', text: 'text-purple-700' },
  // Illustration Rare / Art Rare
  'Illustration Rare':  { bg: 'bg-orange-50', text: 'text-orange-700' },
  'Art Rare':           { bg: 'bg-orange-50', text: 'text-orange-700' },
  'AR':                 { bg: 'bg-orange-50', text: 'text-orange-700' },
  // Special Art Rare
  'Special Art Rare':   { bg: 'bg-pink-50', text: 'text-pink-700' },
  'SAR':                { bg: 'bg-pink-50', text: 'text-pink-700' },
  // Hyper Rare
  'Hyper Rare':         { bg: 'bg-yellow-50', text: 'text-yellow-700' },
  'HR':                 { bg: 'bg-yellow-50', text: 'text-yellow-700' },
  // Promo
  'Promo':              { bg: 'bg-rose-50', text: 'text-rose-700' },
  'PR':                 { bg: 'bg-rose-50', text: 'text-rose-700' },
  'プロモ':             { bg: 'bg-rose-50', text: 'text-rose-700' },
  // Character Rare
  'Character Rare':     { bg: 'bg-teal-50', text: 'text-teal-700' },
  'CHR':                { bg: 'bg-teal-50', text: 'text-teal-700' },
  'Trainer Gallery Rare Holo': { bg: 'bg-teal-50', text: 'text-teal-700' },
  // Character Super Rare
  'Character Super Rare': { bg: 'bg-cyan-50', text: 'text-cyan-700' },
  'CSR':                { bg: 'bg-cyan-50', text: 'text-cyan-700' },
  // Ace Spec Rare
  'Ace Spec Rare':      { bg: 'bg-red-50', text: 'text-red-700' },
  'ACE':                { bg: 'bg-red-50', text: 'text-red-700' },
  // V系
  'Rare Holo V':        { bg: 'bg-sky-50', text: 'text-sky-700' },
  'V':                  { bg: 'bg-sky-50', text: 'text-sky-700' },
  'Rare Holo VMAX':     { bg: 'bg-sky-100', text: 'text-sky-800' },
  'VMAX':               { bg: 'bg-sky-100', text: 'text-sky-800' },
  'Rare Holo VSTAR':    { bg: 'bg-sky-100', text: 'text-sky-800' },
  'VSTAR':              { bg: 'bg-sky-100', text: 'text-sky-800' },
  // GX / EX / BREAK
  'Rare Holo GX':       { bg: 'bg-lime-50', text: 'text-lime-700' },
  'GX':                 { bg: 'bg-lime-50', text: 'text-lime-700' },
  'Rare Holo EX':       { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700' },
  'EX':                 { bg: 'bg-fuchsia-50', text: 'text-fuchsia-700' },
  'Rare BREAK':         { bg: 'bg-amber-100', text: 'text-amber-800' },
  'BREAK':              { bg: 'bg-amber-100', text: 'text-amber-800' },
  // Shiny / Radiant
  'Shiny Rare':         { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  'S':                  { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  'Shiny Secret Rare':  { bg: 'bg-yellow-200', text: 'text-yellow-900' },
  'SSR':                { bg: 'bg-yellow-200', text: 'text-yellow-900' },
  'Radiant Rare':       { bg: 'bg-yellow-50', text: 'text-yellow-700' },
  'Kagayaku':           { bg: 'bg-yellow-50', text: 'text-yellow-700' },
  'K':                  { bg: 'bg-yellow-50', text: 'text-yellow-700' },
  // Amazing Rare
  'Amazing Rare':       { bg: 'bg-gradient-to-r from-pink-50 to-blue-50', text: 'text-purple-700' },
  'A':                  { bg: 'bg-gradient-to-r from-pink-50 to-blue-50', text: 'text-purple-700' },
  // その他
  'Black White Rare':   { bg: 'bg-gray-200', text: 'text-gray-800' },
  'BWR':                { bg: 'bg-gray-200', text: 'text-gray-800' },
  'Mega Ultra Rare':    { bg: 'bg-red-100', text: 'text-red-800' },
  'MUR':                { bg: 'bg-red-100', text: 'text-red-800' },
  'Mega Attack Rare':   { bg: 'bg-red-50', text: 'text-red-700' },
  'MAR':                { bg: 'bg-red-50', text: 'text-red-700' },
  'None':               { bg: 'bg-gray-50', text: 'text-gray-400' },
  '\u2212':             { bg: 'bg-gray-50', text: 'text-gray-400' },
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
