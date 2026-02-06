import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

// 一般的なWindowsのChromeパス
const chromePaths = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(process.env.ProgramFiles || '', 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(process.env['ProgramFiles(x86)'] || '', 'Google\\Chrome\\Application\\chrome.exe')
];

const executablePath = chromePaths.find(p => fs.existsSync(p));

if (!executablePath) {
    console.error('Chrome executable not found. Please run "npx playwright install chromium" or install Google Chrome.');
    process.exit(1);
}

console.log('Using executable:', executablePath);

async function dumpHtml() {
    console.log('Launching browser...');
    try {
        const browser = await chromium.launch({ headless: true, executablePath });
        const page = await browser.newPage();

        console.log('Navigating to https://snkrdunk.com/apparels/663661 ...');
        await page.goto('https://snkrdunk.com/apparels/663661', { waitUntil: 'networkidle', timeout: 60000 });

        console.log('Page loaded. Checking title...');
        const title = await page.title();
        console.log('Title:', title);

        console.log('Dumping HTML...');
        const html = await page.content();
        fs.writeFileSync('snkrdunk_apparels.html', html);
        console.log('HTML saved to snkrdunk_apparels.html');

        console.log('Taking screenshot...');
        await page.screenshot({ path: 'snkrdunk_apparels.png', fullPage: true });
        console.log('Screenshot saved to snkrdunk_apparels.png');

        await browser.close();
        console.log('Browser closed.');
    } catch (e) {
        console.error('Playwright Error:', e);
    }
}

dumpHtml();
