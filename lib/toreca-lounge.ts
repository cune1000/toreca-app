/**
 * トレカラウンジ スクレイピングロジック
 * 
 * /products ページのNext.js RSCストリームから
 * JSON商品データを抽出する方式
 * 全ページをループして取得（1ページ約50件）
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
 * RSCストリームはscriptタグ内のJavaScript文字列として埋め込まれている：
 * self.__next_f.push([1,"...\"product\":{\"productFormat\":\"PSA\",...}..."])
 * 
 * HTML上では \" がエスケープされた状態で、
 * 実際のテキストには \"product\":{\"productFormat\":\"PSA\",...} のように現れる
 */
function parseProductsFromHtml(html: string): LoungeCard[] {
    const cards: LoungeCard[] = []

    // "product":{ で始まるJSON風ブロックを探す
    // HTML内では \" がリテラルの \" として現れる
    // シンプルにindexOfで位置を探し、手動でフィールドを抽出する
    const marker = '\\"product\\":{\\"productFormat\\":\\"'
    let searchStart = 0

    while (true) {
        const idx = html.indexOf(marker, searchStart)
        if (idx === -1) break

        // この位置から十分な範囲を抽出
        const chunk = html.substring(idx, idx + 1000)

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

    return cards
}

/**
 * エスケープされたJSON風テキストからフィールド値を抽出
 * パターン: \\"fieldName\\":\\"value\\"
 */
function extractField(chunk: string, fieldName: string): string | null {
    const pattern = `\\"${fieldName}\\":\\"`
    const start = chunk.indexOf(pattern)
    if (start === -1) return null

    const valueStart = start + pattern.length
    const valueEnd = chunk.indexOf('\\"', valueStart)
    if (valueEnd === -1) return null

    return chunk.substring(valueStart, valueEnd)
}

/**
 * Unicode エスケープシーケンス (\uXXXX) をデコード
 */
function decodeUnicode(str: string): string {
    return str.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16))
    )
}
