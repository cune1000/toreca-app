// 本番環境テスト
const body = JSON.stringify({
    cardId: '03eb0e61-90ad-4d15-972b-0e6573ef86f2',
    url: 'https://snkrdunk.com/apparels/466512'
})

const t = Date.now()
const res = await fetch('https://toreca-app.vercel.app/api/snkrdunk-scrape', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
})
const elapsed = Date.now() - t
const data = await res.json()
console.log(`Elapsed: ${elapsed}ms`)
console.log(JSON.stringify(data, null, 2))
