// JustTCG英語レアリティ名 → 日本語略称マッピング
export const RARITY_EN_TO_JA: Record<string, string> = {
  'Common': 'コモン',
  'Uncommon': 'アンコモン',
  'Rare': 'R',
  'Holo Rare': 'R',
  'Double Rare': 'RR',
  'Triple Rare': 'RRR',
  'Secret Rare': 'SR',
  'Ultra Rare': 'UR',
  'Illustration Rare': 'AR',
  'Art Rare': 'AR',
  'Special Art Rare': 'SAR',
  'Hyper Rare': 'HR',
  'Promo': 'プロモ',
  'Amazing Rare': 'A',
  'Shiny Rare': 'S',
  'Character Rare': 'CHR',
  'Character Super Rare': 'CSR',
  'Ace Spec Rare': 'ACE',
  'Rare Holo V': 'V',
  'Rare Holo VMAX': 'VMAX',
  'Rare Holo VSTAR': 'VSTAR',
  'Rare Holo GX': 'GX',
  'Rare BREAK': 'BREAK',
  'Rare Holo EX': 'EX',
  'Trainer Gallery Rare Holo': 'CHR',
  'Radiant Rare': 'K',
  'Super Rare': 'SR',
  'None': '−',
}

// raritiesテーブルJOIN結果の短縮名 → 表示用マッピング
// （raritiesテーブルには C, U, R 等の短縮名が入っている）
const SHORT_TO_DISPLAY: Record<string, string> = {
  'C': 'コモン',
  'U': 'アンコモン',
}

/**
 * レアリティを日本語表示名に変換
 * - JOINされたrarities オブジェクト → .name を使用（短縮名→表示名変換あり）
 * - 英語テキスト → RARITY_EN_TO_JA でマッピング
 * - マッチしなければ原文を返す
 */
export function getRarityDisplayName(rarity: string | { name: string } | null | undefined): string {
  if (!rarity) return ''
  if (typeof rarity === 'object') {
    const name = rarity.name
    return SHORT_TO_DISPLAY[name] || name
  }
  return RARITY_EN_TO_JA[rarity] || rarity
}

/**
 * 英語レアリティ名 → raritiesテーブル用の短縮名（C, U, R, SAR等）
 * JustTCG register APIで使用
 */
export function getRarityShortName(rarityEn: string): string | null {
  const mapping: Record<string, string> = {
    'Common': 'C',
    'Uncommon': 'U',
    'Rare': 'R',
    'Holo Rare': 'R',
    'Double Rare': 'RR',
    'Triple Rare': 'RRR',
    'Secret Rare': 'SR',
    'Ultra Rare': 'UR',
    'Illustration Rare': 'AR',
    'Art Rare': 'AR',
    'Special Art Rare': 'SAR',
    'Hyper Rare': 'HR',
    'Promo': 'PR',
    'Amazing Rare': 'A',
    'Shiny Rare': 'S',
    'Character Rare': 'CHR',
    'Character Super Rare': 'CSR',
    'Ace Spec Rare': 'ACE',
    'Rare Holo V': 'V',
    'Rare Holo VMAX': 'VMAX',
    'Rare Holo VSTAR': 'VSTAR',
    'Rare Holo GX': 'GX',
    'Rare BREAK': 'BREAK',
    'Rare Holo EX': 'EX',
    'Trainer Gallery Rare Holo': 'CHR',
    'Radiant Rare': 'K',
    'Super Rare': 'SR',
  }
  return mapping[rarityEn] || null
}
