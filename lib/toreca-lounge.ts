/**
 * トレカラウンジ スクレイピングロジック
 * 
 * /products ページのNext.js RSCストリームから
 * JSON商品データを抽出する方式
 * 全ページをループして取得（1ページ約72件）
 */

const BASE_URL = 'https://kaitori.toreca-lounge.com'

export interface LoungeCard {
    productId: string
    name: string
    modelno: string
    rarity: string
    grade: string          // "PSA10", "" など
    productFormat: string  // "PSA", "NORMAL" など
    price: number
    key: string            // "カード名::型番" の一意キー
    imageUrl: string
}

/**
 * /products ページからRSCストリーム内のJSON商品データを全ページ抽出
 */
export async function fetchAllLoungeCards(): Promise<LoungeCard[]> {
    const cards: LoungeCard[] = []
    const MAX_PAGES = 50

    for (let page = 1; page <= MAX_PAGES; page++) {
        const url = `${BASE_URL}/products?page=${page}`
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html',
            },
        })

        if (!res.ok) {
            throw new Error(`Failed to fetch toreca-lounge page ${page}: ${res.status}`)
        }

        const html = await res.text()
        const pageCards = parseProductsFromHtml(html)

        if (pageCards.length === 0) {
            break
        }

        cards.push(...pageCards)
    }

    return cards
}

/**
 * HTML文字列からRSCストリーム内のproductデータを抽出
 * 
 * 複数のマーカーパターンを試して、全カードを確実に抽出する
 */
function parseProductsFromHtml(html: string): LoungeCard[] {
    const cards: LoungeCard[] = []

    // 方法1: \"product\":{ マーカーで探す（フィールド順序問わず）
    const marker = '\\\"product\\\":{'
    let searchStart = 0

    while (true) {
        const idx = html.indexOf(marker, searchStart)
        if (idx === -1) break

        // この位置から十分な範囲を抽出
        const chunk = html.substring(idx, idx + 2000)

        // 各フィールドを個別に抽出
        const productFormat = extractField(chunk, 'productFormat')
        const productId = extractField(chunk, 'productId')
        const productName = extractField(chunk, 'productName')
        const grade = extractField(chunk, 'grade')
        const modelNumber = extractField(chunk, 'modelNumber')
        const rarity = extractField(chunk, 'rarity')
        const buyPrice = extractField(chunk, 'buyPrice')
        const imageUrl = extractField(chunk, 'imageUrl')

        if (productName && buyPrice) {
            const name = decodeUnicode(productName)
            const modelno = decodeUnicode(modelNumber || '')
            const price = parseInt(buyPrice, 10) || 0

            if (name && price > 0) {
                cards.push({
                    productId: productId || '',
                    name,
                    modelno,
                    rarity: decodeUnicode(rarity || ''),
                    grade: grade || '',
                    productFormat: productFormat || '',
                    price,
                    key: `${name}::${modelno}`,
                    imageUrl: decodeUnicode(imageUrl || ''),
                })
            }
        }

        searchStart = idx + marker.length
    }

    // 方法2: buyPrice マーカーで追加探索（方法1で漏れたものを拾う）
    const buyPriceMarker = '\\\"buyPrice\\\":\\\"'
    searchStart = 0

    while (true) {
        const idx = html.indexOf(buyPriceMarker, searchStart)
        if (idx === -1) break

        // buyPriceの前後2000文字を取得してフィールド抽出
        const chunkStart = Math.max(0, idx - 1000)
        const chunk = html.substring(chunkStart, idx + 1000)

        const productName = extractField(chunk, 'productName')
        const buyPrice = extractField(chunk, 'buyPrice')

        if (productName && buyPrice) {
            const name = decodeUnicode(productName)
            const modelno = decodeUnicode(extractField(chunk, 'modelNumber') || '')
            const price = parseInt(buyPrice, 10) || 0

            // 既に方法1で取得済みなら重複スキップ
            const key = `${name}::${modelno}`
            const alreadyExists = cards.some(c => c.key === key && c.price === price)

            if (name && price > 0 && !alreadyExists) {
                cards.push({
                    productId: extractField(chunk, 'productId') || '',
                    name,
                    modelno,
                    rarity: decodeUnicode(extractField(chunk, 'rarity') || ''),
                    grade: extractField(chunk, 'grade') || '',
                    productFormat: extractField(chunk, 'productFormat') || '',
                    price,
                    key,
                    imageUrl: decodeUnicode(extractField(chunk, 'imageUrl') || ''),
                })
            }
        }

        searchStart = idx + buyPriceMarker.length
    }

    return cards
}

/**
 * エスケープされたJSON風テキストからフィールド値を抽出
 * パターン: \\\"fieldName\\\":\\\"value\\\"
 * 数値の場合: \\\"fieldName\\\":value も対応
 */
function extractField(chunk: string, fieldName: string): string | null {
    // 文字列値: \\\"fieldName\\\":\\\"value\\\"
    const strPattern = `\\\"${fieldName}\\\":\\\"`
    const strStart = chunk.indexOf(strPattern)
    if (strStart !== -1) {
        const valueStart = strStart + strPattern.length
        const valueEnd = chunk.indexOf('\\\"', valueStart)
        if (valueEnd !== -1) {
            return chunk.substring(valueStart, valueEnd)
        }
    }

    // 数値値: \\\"fieldName\\\":123
    const numPattern = `\\\"${fieldName}\\\":`
    const numStart = chunk.indexOf(numPattern)
    if (numStart !== -1) {
        const valueStart = numStart + numPattern.length
        // 数値の終端を探す
        let end = valueStart
        while (end < chunk.length && /[0-9]/.test(chunk[end])) {
            end++
        }
        if (end > valueStart) {
            return chunk.substring(valueStart, end)
        }
    }

    return null
}

/**
 * Unicode エスケープシーケンス (\uXXXX) をデコード
 */
function decodeUnicode(str: string): string {
    return str.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16))
    )
}
