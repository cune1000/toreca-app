/**
 * ひらがな⇔カタカナ変換ユーティリティ
 * 検索時にひらがな入力でもカタカナのカード名にマッチさせる
 */

/** ひらがな → カタカナ変換 */
export function toKatakana(str: string): string {
    return str.replace(/[\u3041-\u3096]/g, (ch) =>
        String.fromCharCode(ch.charCodeAt(0) + 0x60)
    )
}

/** カタカナ → ひらがな変換 */
export function toHiragana(str: string): string {
    return str.replace(/[\u30A1-\u30F6]/g, (ch) =>
        String.fromCharCode(ch.charCodeAt(0) - 0x60)
    )
}

/** 文字列にひらがなが含まれるか */
export function containsHiragana(str: string): boolean {
    return /[\u3041-\u3096]/.test(str)
}

/** 文字列にカタカナが含まれるか */
export function containsKatakana(str: string): boolean {
    return /[\u30A1-\u30F6]/.test(str)
}

/**
 * 検索クエリからSupabaseのOR条件を生成
 * ひらがな入力 → カタカナ版も検索
 * カタカナ入力 → ひらがな版も検索
 * 
 * @param query 検索クエリ
 * @param columns 検索対象カラム名の配列
 * @returns Supabase .or() に渡すフィルタ文字列
 * 
 * 例: buildKanaSearchFilter("ぴかちゅう", ["name", "card_number"])
 * → "name.ilike.%ぴかちゅう%,card_number.ilike.%ぴかちゅう%,name.ilike.%ピカチュウ%,card_number.ilike.%ピカチュウ%"
 */
export function buildKanaSearchFilter(query: string, columns: string[]): string {
    const variants = [query]

    if (containsHiragana(query)) {
        const katakanaVersion = toKatakana(query)
        if (katakanaVersion !== query) {
            variants.push(katakanaVersion)
        }
    }

    if (containsKatakana(query)) {
        const hiraganaVersion = toHiragana(query)
        if (hiraganaVersion !== query) {
            variants.push(hiraganaVersion)
        }
    }

    const conditions: string[] = []
    for (const variant of variants) {
        for (const col of columns) {
            conditions.push(`${col}.ilike.%${variant}%`)
        }
    }

    return conditions.join(',')
}
