const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Staging environment check
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials in .env.local');
    process.exit(1);
}

// Simple safety check to try and prevent accidental prod drops if env gets mixed up
const isStaging = supabaseUrl.includes('bfiosxcsarekbvkjfdjr'); // Staging URL ID from previous context

if (!isStaging) {
    console.error('ERROR: You are not connected to the STAGING database. Aborting drop operations.');
    console.log('Connected to:', supabaseUrl);
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const tablesToDrop = [
    "scraping_schedules",
    "cron_rest_times",
    "card_sale_sites",
    "price_history",
    "card_learning_images",
    "recognition_queue",
    "pending_images",
    "recognition_corrections",
    "grid_templates",
    "pending_cards"
];

async function dropTables() {
    console.log(`Starting cleanup of ${tablesToDrop.length} unused tables in STAGING...`);

    for (const table of tablesToDrop) {
        console.log(`Dropping table: ${table}...`);
        // Need to use raw SQL via RPC or similar. Supabase JS doesn't have a DROP TABLE method natively.
        // However, we don't have an RPC function for executing raw SQL.
        // We will have to write an SQL file and execute it via the REST API or tell the user to run it.
    }
}

// Write it as raw SQL so the user doesn't have to install pg or we don't have to fight with RPC limitations.
const fs = require('fs');
let sql = '';
tablesToDrop.forEach(t => {
    sql += `DROP TABLE IF EXISTS public."${t}" CASCADE;\n`;
});
fs.writeFileSync('drop_unused_tables.sql', sql);
console.log('Generated drop_unused_tables.sql. Please execute this block in the Supabase SQL Editor:');
console.log(sql);
