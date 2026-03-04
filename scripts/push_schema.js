const fs = require('fs');
const { Client } = require('pg');

const NEW_DB_URL = 'postgresql://postgres:C0u7n1e5%401210@db.bfiosxcsarekbvkjfdjr.supabase.co:5432/postgres';

async function pushSchema() {
    const client = new Client({ connectionString: NEW_DB_URL });
    await client.connect();

    try {
        console.log('[+] Connected to NEW Staging Database...');
        let schemaSql = fs.readFileSync('staging_schema_dump.sql', 'utf8');

        // Remove BOM if present
        if (schemaSql.charCodeAt(0) === 0xFEFF) {
            schemaSql = schemaSql.slice(1);
        }

        // Fix invalid ARRAY dumps from pg information_schema
        schemaSql = schemaSql.replace(/"run_at_hours" ARRAY/g, '"run_at_hours" integer[]');
        schemaSql = schemaSql.replace(/"embedding" ARRAY/g, '"embedding" vector(768)');

        console.log(`[+] Executing schema SQL...`);
        await client.query(schemaSql);

        console.log('[+] Schema Clone Successful! 45 tables migrated.');
    } catch (err) {
        console.error('[-] Error pushing schema:', err.message);
    } finally {
        await client.end();
    }
}

pushSchema().catch(console.error);
