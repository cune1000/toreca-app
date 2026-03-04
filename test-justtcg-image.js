const apiKey = 'tcg_8736b1b1417c4914bcfd82dd079662f0';
fetch('https://api.justtcg.com/v1/cards?limit=1', {
    headers: { 'x-api-key': apiKey }
})
    .then(r => r.json())
    .then(d => console.log(JSON.stringify(d.data[0], null, 2)))
    .catch(console.error);
