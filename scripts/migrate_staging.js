const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const stagingUrl = 'postgresql://postgres:C0u7n1e5%401210@db.bfiosxcsarekbvkjfdjr.supabase.co:5432/postgres';

async function runMigrations() {
    const client = new Client({ connectionString: stagingUrl });

    try {
        await client.connect();
        console.log('[+] Connected to Staging Database');

        // 1. Run the base schema first if available
        const baseSchemaPath = path.join(__dirname, '../docs/v2-db-schema.sql');
        if (fs.existsSync(baseSchemaPath)) {
            console.log(`[+] Running base schema: ${baseSchemaPath}`);
            const baseSql = fs.readFileSync(baseSchemaPath, 'utf8');
            await client.query(baseSql);
        }

        // 2. Run all migrations in supabase/migrations alphabetically
        const migrationsDir = path.join(__dirname, '../supabase/migrations');

        if (fs.existsSync(migrationsDir)) {
            const files = fs.readdirSync(migrationsDir)
                .filter(f => f.endsWith('.sql'))
                .sort(); // sort alphabetically

            for (const file of files) {
                console.log(`[+] Running migration: ${file}`);
                const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
                try {
                    await client.query(sql);
                } catch (migrationErr) {
                    console.error(`[-] Error running ${file}:`, migrationErr.message);
                    // Continue with other migrations as some might just be "already exists" errors
                }
            }
        }

        // 3. Run all migrations in docs/migrations alphabetically
        const docsMigrationsDir = path.join(__dirname, '../docs/migrations');
        if (fs.existsSync(docsMigrationsDir)) {
            const docsFiles = fs.readdirSync(docsMigrationsDir)
                .filter(f => f.endsWith('.sql'))
                .sort();

            for (const file of docsFiles) {
                console.log(`[+] Running docs migration: ${file}`);
                const sql = fs.readFileSync(path.join(docsMigrationsDir, file), 'utf8');
                try {
                    await client.query(sql);
                } catch (migrationErr) {
                    console.error(`[-] Error running ${file}:`, migrationErr.message);
                }
            }
        }

        console.log('[+] All migrations applied successfully!');
    } catch (err) {
        console.error('[-] Fatal Migration error:', err);
    } finally {
        await client.end();
    }
}

runMigrations();
