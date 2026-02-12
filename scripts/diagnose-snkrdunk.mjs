// Node.js fetch 診断スクリプト
// Next.jsのfetchパッチなしで、純粋なNode.jsのfetchを検証する

const APPAREL_ID = 115238

async function diagnose() {
    console.log('=== Node.js fetch 診断 ===')
    console.log(`Node.js version: ${process.version}`)
    console.log()

    // テスト 1: 商品情報API
    console.log('--- Test 1: 商品情報 API ---')
    let t = Date.now()
    try {
        const res = await fetch(`https://snkrdunk.com/v1/apparels/${APPAREL_ID}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Accept': 'application/json',
            },
        })
        const elapsed = Date.now() - t
        console.log(`Status: ${res.status}, Time: ${elapsed}ms`)
        console.log(`Content-Type: ${res.headers.get('content-type')}`)
        const data = await res.json()
        console.log(`Product: ${data.localizedName}`)
    } catch (e) {
        console.error(`Error after ${Date.now() - t}ms:`, e.message)
    }
    console.log()

    // テスト 2: 売買履歴API
    console.log('--- Test 2: 売買履歴 API ---')
    t = Date.now()
    try {
        const res = await fetch(`https://snkrdunk.com/v1/apparels/${APPAREL_ID}/sales-history?size_id=0&page=1&per_page=5`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
                'Accept': 'application/json',
            },
        })
        const elapsed = Date.now() - t
        console.log(`Status: ${res.status}, Time: ${elapsed}ms`)
        console.log(`Content-Type: ${res.headers.get('content-type')}`)
        const data = await res.json()
        console.log(`Records: ${data.history?.length}`)
    } catch (e) {
        console.error(`Error after ${Date.now() - t}ms:`, e.message)
    }
    console.log()

    // テスト 3: AbortControllerでタイムアウト
    console.log('--- Test 3: 5秒タイムアウト付き ---')
    t = Date.now()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)
    try {
        const res = await fetch(`https://snkrdunk.com/v1/apparels/${APPAREL_ID}`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
            },
            signal: controller.signal,
        })
        clearTimeout(timeout)
        const elapsed = Date.now() - t
        console.log(`Status: ${res.status}, Time: ${elapsed}ms`)
        const text = await res.text()
        console.log(`Body length: ${text.length}`)
        console.log(`First 200 chars: ${text.substring(0, 200)}`)
    } catch (e) {
        clearTimeout(timeout)
        console.error(`Error after ${Date.now() - t}ms:`, e.message)
    }

    console.log()
    console.log('=== 診断完了 ===')
}

diagnose().catch(console.error)
