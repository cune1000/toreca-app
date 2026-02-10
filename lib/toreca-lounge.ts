/**
 * トレカラウンジ スクレイピングロジック
 * 
 * /products ページのNext.js RSCストリームから
 * JSON商品データを正規表現で抽出する方式
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
    const MAX_PAGES = 50  // 安全上限

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
            break  // データがなければ最終ページ
        }

        cards.push(...pageCards)
    }

    return cards
}

/**
 * HTML文字列からRSCストリーム内のproductデータを正規表現で抽出
 */
function parseProductsFromHtml(html: string): LoungeCard[] {
    const cards: LoungeCard[] = []

    // RSCストリーム内の product JSON を抽出
    // HTMLのscriptタグ内では JSON が \" でエスケープされている
    const q = '\\\\"'  // エスケープされたクォート \"
    const productRegex = new RegExp(
        `${q}product${q}:\\\\{` +
        `${q}productFormat${q}:${q}([^\\\\\\\\]*)${q},` +
        `${q}productId${q}:${q}([^\\\\\\\\]*)${q},` +
        `${q}productName${q}:${q}([^\\\\\\\\]*)${q},` +
        `${q}grade${q}:${q}([^\\\\\\\\]*)${q},` +
        `${q}modelNumber${q}:${q}([^\\\\\\\\]*)${q},` +
        `${q}rarity${q}:${q}([^\\\\\\\\]*)${q},` +
        `${q}buyPrice${q}:${q}([^\\\\\\\\]*)${q},` +
        `${q}imageUrl${q}:${q}([^\\\\\\\\]*)${q}`,
        'g'
    )

    let match
    while ((match = productRegex.exec(html)) !== null) {
        const [, productFormat, productId, productName, grade, modelNumber, rarity, buyPrice, imageUrl] = match

        const name = decodeUnicode(productName)
        const modelno = decodeUnicode(modelNumber)
        const price = parseInt(buyPrice, 10) || 0

        if (name && price > 0) {
            cards.push({
                productId,
                name,
                modelno,
                rarity: decodeUnicode(rarity),
                grade,
                productFormat,
                price,
                key: `${name}::${modelno}`,
                imageUrl: decodeUnicode(imageUrl),
            })
        }
    }

    return cards
}

/**
 * Unicode エスケープシーケンス (\uXXXX) をデコード
 */
function decodeUnicode(str: string): string {
    return str.replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
        String.fromCharCode(parseInt(hex, 16))
    )
}
