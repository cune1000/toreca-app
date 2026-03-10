// アフィリエイトリンク生成
// 環境変数未設定時はIDなしのリンクを生成

const MERCARI_AFFILIATE_ID = process.env.NEXT_PUBLIC_MERCARI_AFFILIATE_ID || ''
const SURUGAYA_AFFILIATE_ID = process.env.NEXT_PUBLIC_SURUGAYA_AFFILIATE_ID || ''
const RAKUTEN_AFFILIATE_ID = process.env.NEXT_PUBLIC_RAKUTEN_AFFILIATE_ID || ''

export function getMercariUrl(
    cardName: string,
    rarity?: string,
    avgPrice?: number
): string {
    const keyword = [cardName, rarity].filter(Boolean).join(' ')
    const url = new URL('https://jp.mercari.com/search')
    url.searchParams.set('keyword', keyword)
    if (avgPrice) {
        url.searchParams.set('price_min', String(Math.floor(avgPrice * 0.7)))
        url.searchParams.set('price_max', String(Math.ceil(avgPrice * 1.3)))
    }
    if (MERCARI_AFFILIATE_ID) {
        url.searchParams.set('afid', MERCARI_AFFILIATE_ID)
    }
    return url.toString()
}

export function getSurugayaUrl(cardName: string): string {
    const url = new URL('https://www.suruga-ya.jp/search')
    url.searchParams.set('search_word', cardName)
    url.searchParams.set('category', 'トレカ')
    if (SURUGAYA_AFFILIATE_ID) {
        url.searchParams.set('aid', SURUGAYA_AFFILIATE_ID)
    }
    return url.toString()
}

export function getRakutenUrl(cardName: string): string {
    const encoded = encodeURIComponent(cardName)
    let url = `https://search.rakuten.co.jp/search/mall/${encoded}/`
    if (RAKUTEN_AFFILIATE_ID) {
        url += `?scid=${RAKUTEN_AFFILIATE_ID}`
    }
    return url
}

export interface AffiliateLink {
    name: string
    url: string
    icon: string
    color: string
    sub?: string
}

export function getAffiliateLinks(cardName: string, rarity?: string, avgPrice?: number): AffiliateLink[] {
    const min = avgPrice ? Math.floor(avgPrice * 0.7) : undefined
    const max = avgPrice ? Math.ceil(avgPrice * 1.3) : undefined

    return [
        {
            name: '駿河屋で探す',
            url: getSurugayaUrl(cardName),
            icon: '🏪',
            color: 'bg-blue-600 hover:bg-blue-700',
        },
        {
            name: '楽天で探す',
            url: getRakutenUrl(cardName),
            icon: '🎯',
            color: 'bg-pink-500 hover:bg-pink-600',
        },
    ]
}
