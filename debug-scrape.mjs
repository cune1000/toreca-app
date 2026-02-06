import fs from 'fs';
import path from 'path';

// .env.local から読み込み
const envPath = path.resolve('.env.local');
let scraperUrl = '';

if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const [key, val] = line.split('=');
        if (key && key.trim() === 'RAILWAY_SCRAPER_URL') scraperUrl = val.trim().replace(/"/g, '');
    });
}

if (!scraperUrl) {
    scraperUrl = 'https://skillful-love-production.up.railway.app';
}

console.log('Using scraper URL:', scraperUrl);

// 特定されたメガサーナイトexのURL (apparels)
const targetUrl = 'https://snkrdunk.com/apparels/663661';

async function testScrape() {
    console.log(`Scraping ${targetUrl}...`);

    try {
        const res = await fetch(`${scraperUrl}/scrape`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: targetUrl, mode: 'light', wait: 10 }), // 念のため10秒待つ
        });

        if (!res.ok) {
            console.error('Fetch error status:', res.status);
            const text = await res.text();
            console.error('Response:', text);
            return;
        }

        const data = await res.json();
        console.log('Result Success:', data.success);
        if (!data.success) {
            console.log('Error Message:', data.error);
            return;
        }

        // 重要なデータがあるか確認
        console.log('Price:', data.price);
        console.log('Main Price:', data.mainPrice);

        if (data.history) {
            console.log('History Length:', data.history.length);
            if (data.history.length > 0) {
                console.log('First 3 history items:');
                data.history.slice(0, 3).forEach(h => console.log(JSON.stringify(h)));

                // サイズ/Gradeの傾向を見る
                const sizes = data.history.map(h => h.size);
                const uniqueSizes = [...new Set(sizes)];
                console.log('Unique Sizes/Grades found:', uniqueSizes);
            }
        } else {
            console.log('No history found in response');
        }

    } catch (e) {
        console.error('Error:', e);
    }
}

testScrape();
