const fs = require('fs');
const path = require('path');

const tables = [
    "chart_daily_card_prices", "rarities", "card_learning_images", "card_purchase_links",
    "purchase_prices", "purchase_shops", "pos_history", "card_sale_urls", "sale_prices",
    "pos_inventory", "scraping_schedules", "lounge_known_keys", "cron_rest_times",
    "category_medium", "category_small", "fetched_tweets", "grid_templates",
    "lounge_cards_cache", "category_detail", "sale_sites", "shop_monitor_settings",
    "pos_catalogs", "pos_transactions", "pos_checkout_items", "cron_logs",
    "card_sale_sites", "price_history", "overseas_prices", "pos_sources", "pos_lots",
    "cron_schedules", "shinsoku_items", "exchange_rates", "cards", "pos_checkout_folders",
    "api_keys", "daily_price_index", "snkrdunk_sales_history", "recognition_queue",
    "pending_images", "pending_cards", "recognition_corrections", "category_large",
    "justtcg_price_history", "snkrdunk_items_cache"
];

const counts = {};
tables.forEach(t => counts[t] = 0);
const usageFiles = {};

function scanDir(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (['node_modules', '.next', '.git', 'supabase', '.gemini'].includes(file)) continue;
            scanDir(fullPath);
        } else if (file.match(/\.(tsx?|jsx?|ts|js)$/)) {
            if (file.includes('schema_dump') || file.includes('find_unused_tables.js')) continue;

            const content = fs.readFileSync(fullPath, 'utf8');
            tables.forEach(t => {
                // Find exact words, handling edge cases
                const regex = new RegExp(`['"\`\\s(]${t}['"\`\\s)]`, 'g');
                const matches = content.match(regex);
                let matchCount = 0;

                // Also check if the table name simply appears as a boundary word
                const exactWordRegex = new RegExp(`\\b${t}\\b`, 'g');
                const exactMatches = content.match(exactWordRegex);

                if (exactMatches) {
                    matchCount = exactMatches.length;
                }

                if (matchCount > 0) {
                    counts[t] += matchCount;
                    if (!usageFiles[t]) usageFiles[t] = [];
                    usageFiles[t].push(fullPath.replace('c:\\Users\\user\\Desktop\\Desktop\\toreca-app\\', ''));
                }
            });
        }
    }
}

scanDir('c:\\Users\\user\\Desktop\\Desktop\\toreca-app');

let output = "== UNUSED TABLES (0 Hits) ==\n";
tables.filter(t => counts[t] === 0).forEach(t => output += `${t}\n`);

output += "\n== LOW USAGE TABLES (1-5 Hits) ==\n";
tables.filter(t => counts[t] > 0 && counts[t] <= 5).forEach(t => {
    output += `${t} (${counts[t]} hits): ${[...new Set(usageFiles[t])].slice(0, 5).join(', ')}\n`;
});

output += "\n== MODERATE/HIGH USAGE TABLES (>5 Hits) ==\n";
tables.filter(t => counts[t] > 5).forEach(t => {
    output += `${t} (${counts[t]} hits)\n`;
});

fs.writeFileSync('unused_tables_report.txt', output);
console.log('Report generated at unused_tables_report.txt');
