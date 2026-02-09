/**
 * トレカラウンジ スクレイピングロジック
 * 
 * /products ページのNext.js RSCストリームから
 * JSON商品データを正規表現で抽出する方式
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
 * /products ページからRSCストリーム内のJSON商品データを抽出
 */
export async function fetchAllLoungeCards(): Promise<LoungeCard[]> {
    const res = await fetch(`${BASE_URL}/products`, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'text/html',
        },
    })

    if (!res.ok) {
        throw new Error(`Failed to fetch toreca-lounge: ${res.status}`)
    }

    const html = await res.text()
    const cards: LoungeCard[] = []

    // RSCストリーム内の product JSON を正規表現で抽出
    // パターン: "product":{"productFormat":"...","productId":"...","productName":"...","grade":"...","modelNumber":"...","rarity":"...","buyPrice":"...","imageUrl":"..."}
    const productRegex = /"product":\{[^}]*"productFormat":"([^"]*)"[^}]*"productId":"([^"]*)"[^}]*"productName":"([^"]*)"[^}]*"grade":"([^"]*)"[^}]*"modelNumber":"([^"]*)"[^}]*"rarity":"([^"]*)"[^}]*"buyPrice":"([^"]*)"[^}]*"imageUrl":"([^"]*)"/g

    let match
    while ((match = productRegex.exec(html)) !== null) {
        const [, productFormat, productId, productName, grade, modelNumber, rarity, buyPrice, imageUrl] = match

        // Unicode エスケープをデコード
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
