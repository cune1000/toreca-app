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
  'Kagayaku': 'K',
  'Black White Rare': 'BWR',
  'Shiny Secret Rare': 'SSR',
  'Super Rare': 'SR',
  'Mega Ultra Rare': 'MUR',
  'Mega Attack Rare': 'MAR',
  'None': '−',
}

/**
 * レアリティを日本語表示名に変換
 * - 英語テキスト → RARITY_EN_TO_JA でマッピング
 * - マッチしなければ原文を返す
 */
export function getRarityDisplayName(rarity: string | null | undefined): string {
  if (!rarity) return ''
  return RARITY_EN_TO_JA[rarity] || rarity
}

/**
 * レアリティ値をDB保存用の正規化された値に変換
 * - 英語フルネーム（"Special Art Rare"）→ 日本語短縮名（"SAR"）
 * - 既に短縮名の場合はそのまま返す
 * - マッチしなければ原文を返す（未知のレアリティも保存可能にする）
 * - null/undefined/空文字 → null
 */
export function normalizeRarityForDb(rarity: string | null | undefined): string | null {
  if (!rarity || !rarity.trim()) return null
  const trimmed = rarity.trim()
  // RARITY_EN_TO_JA に英語フルネームがあれば短縮名に変換
  if (RARITY_EN_TO_JA[trimmed]) return RARITY_EN_TO_JA[trimmed]
  // 既に短縮名（RARITY_EN_TO_JA の value に含まれる）ならそのまま
  const knownValues = new Set(Object.values(RARITY_EN_TO_JA))
  if (knownValues.has(trimmed)) return trimmed
  // 未知の値はそのまま保存
  return trimmed
}
