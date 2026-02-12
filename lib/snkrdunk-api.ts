/**
 * スニダン（SNKRDUNK）内部API クライアント
 * 
 * ブラウザスクレイピングの代わりにスニダンの内部APIを直接呼び出す。
 * ZenRows対応: 環境変数 ZENROWS_API_KEY があればプロキシ経由でリクエスト。
 */

const SNKRDUNK_BASE = 'https://snkrdunk.com'
const ZENROWS_API_KEY = process.env.ZENROWS_API_KEY

// ============================================================================
// Types
// ============================================================================

export interface SnkrdunkProductInfo {
    id: number
    productNumber: string
    name: string
    localizedName: string
    minPrice: number | null
    totalListingCount: number
    isSingleCard: boolean
    isBox: boolean
    category: string
    imageUrl: string | null
}

export interface SnkrdunkSaleRecord {
    price: number
    date: string        // "7時間前", "2026/01/17" etc
    size: string        // BOX: "1個", "2個" etc, シングル: ""
    condition: string   // シングル: "PSA10", "A" etc, BOX: ""
    label: string       // "中古" etc
    imageUrl: string    // user icon URL
}

export interface SnkrdunkListing {
    id: number
    price: number
    size: string
    condition: string
    status: string
    note: string
    accessoriesNote: string | null
    createdAt: string
    updatedAt: string
    imageUrl: string | null
}

// ============================================================================
// Fetch Helper (直接 or ZenRows経由)
// ============================================================================

async function snkrdunkFetch(url: string): Promise<Response> {
    const TIMEOUT_MS = 15000 // 15秒タイムアウト
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

    const headers: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'ja,en-US;q=0.9,en;q=0.8',
        'Referer': 'https://snkrdunk.com/',
    }

    try {
        let res: Response

        if (ZENROWS_API_KEY) {
            // ZenRows プロキシ経由
            const zenrowsUrl = `https://api.zenrows.com/v1/?apikey=${ZENROWS_API_KEY}&url=${encodeURIComponent(url)}`
            console.log(`[SnkrdunkAPI] Fetching via ZenRows: ${url}`)
            res = await fetch(zenrowsUrl, { signal: controller.signal })
        } else {
            // 直接呼び出し
            console.log(`[SnkrdunkAPI] Fetching directly: ${url}`)
            res = await fetch(url, { headers, signal: controller.signal })
        }

        console.log(`[SnkrdunkAPI] Response: ${res.status} ${res.statusText}, content-type: ${res.headers.get('content-type')}`)

        // JSONでない場合（Cloudflareチャレンジ等）はエラー
        const contentType = res.headers.get('content-type') || ''
        if (res.ok && !contentType.includes('application/json')) {
            const body = await res.text()
            console.error(`[SnkrdunkAPI] Non-JSON response (${contentType}): ${body.substring(0, 500)}`)
            throw new Error(`APIがJSON以外を返しました (${contentType})。Cloudflare/WAFでブロックされている可能性があります`)
        }

        return res
    } catch (error: any) {
        if (error.name === 'AbortError') {
            throw new Error(`API呼び出しが${TIMEOUT_MS / 1000}秒でタイムアウトしました: ${url}`)
        }
        throw error
    } finally {
        clearTimeout(timeout)
    }
}

// ============================================================================
// URL からの apparelId 抽出
// ============================================================================

/**
 * スニダンのURLからapparelIdを抽出
 * @param url - https://snkrdunk.com/apparels/93021 or similar
 * @returns apparelId number, or null if not found
 */
export function extractApparelId(url: string): number | null {
    const match = url.match(/apparels\/(\d+)/)
    if (match) {
        return parseInt(match[1], 10)
    }
    return null
}

// ============================================================================
// API Functions
// ============================================================================

/**
 * 商品情報を取得して商品タイプを判定
 */
export async function getProductInfo(apparelId: number): Promise<SnkrdunkProductInfo> {
    const res = await snkrdunkFetch(`${SNKRDUNK_BASE}/v1/apparels/${apparelId}`)

    if (!res.ok) {
        throw new Error(`商品情報の取得に失敗: HTTP ${res.status}`)
    }

    const data = await res.json()

    const categories = (data.categories || []).map((c: any) => c.name)
    const isSingleCard = categories.includes('trading-card-single')
    const isBox = categories.includes('trading-card-box-pack')

    return {
        id: data.id,
        productNumber: data.productNumber || '',
        name: data.name || '',
        localizedName: data.localizedName || data.name || '',
        minPrice: data.minPrice || null,
        totalListingCount: data.totalListingCount || 0,
        isSingleCard,
        isBox,
        category: categories[0] || 'unknown',
        imageUrl: data.primaryMedia?.imageUrl || null,
    }
}

/**
 * 売買履歴を取得
 */
export async function getSalesHistory(
    apparelId: number,
    page: number = 1,
    perPage: number = 20
): Promise<{ history: SnkrdunkSaleRecord[], minPrice: number | null }> {
    const url = `${SNKRDUNK_BASE}/v1/apparels/${apparelId}/sales-history?size_id=0&page=${page}&per_page=${perPage}`
    const res = await snkrdunkFetch(url)

    if (!res.ok) {
        throw new Error(`売買履歴の取得に失敗: HTTP ${res.status}`)
    }

    const data = await res.json()

    const history: SnkrdunkSaleRecord[] = (data.history || []).map((item: any) => ({
        price: item.price,
        date: item.date || '',
        size: item.size || '',
        condition: item.condition || '',
        label: item.label || '',
        imageUrl: item.imageUrl || '',
    }))

    return {
        history,
        minPrice: data.minPrice || null,
    }
}

/**
 * 売買履歴を全ページ取得
 */
export async function getAllSalesHistory(
    apparelId: number,
    maxPages: number = 10,
    perPage: number = 50
): Promise<SnkrdunkSaleRecord[]> {
    const allRecords: SnkrdunkSaleRecord[] = []

    for (let page = 1; page <= maxPages; page++) {
        const { history } = await getSalesHistory(apparelId, page, perPage)

        if (history.length === 0) break

        allRecords.push(...history)

        // レート制限対策: 500ms待機
        if (page < maxPages && history.length === perPage) {
            await new Promise(resolve => setTimeout(resolve, 500))
        } else {
            break // 最後のページ
        }
    }

    return allRecords
}

/**
 * 出品一覧（販売価格）を取得
 */
export async function getListings(
    apparelId: number,
    productType: 'single' | 'box',
    page: number = 1,
    perPage: number = 20
): Promise<SnkrdunkListing[]> {
    const params = new URLSearchParams({
        perPage: perPage.toString(),
        page: page.toString(),
    })

    if (productType === 'single') {
        params.append('sizeId', '0')
        params.append('isSaleOnly', 'false')
    } else {
        params.append('withAllColors', 'true')
    }

    const url = `${SNKRDUNK_BASE}/v1/apparels/${apparelId}/used?${params}`
    const res = await snkrdunkFetch(url)

    if (!res.ok) {
        throw new Error(`出品一覧の取得に失敗: HTTP ${res.status}`)
    }

    const data = await res.json()

    return (data.apparelUsedItems || []).map((item: any) => ({
        id: item.id,
        price: item.price,
        size: item.size?.localizedName || '',
        condition: item.displayWearCount || '',
        status: item.statusText || '',
        note: item.note || '',
        accessoriesNote: item.accessoriesNote || null,
        createdAt: item.createdAt || '',
        updatedAt: item.updatedAt || '',
        imageUrl: item.primaryPhoto?.imageUrl || null,
    }))
}
