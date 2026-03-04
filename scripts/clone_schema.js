const fs = require('fs');
const { Client } = require('pg');

const OLD_DB_URL = 'postgresql://postgres:C0u7n1e5%401210@db.slouyljgiytgytyegyde.supabase.co:5432/postgres';
const OUTPUT_FILE = 'staging_schema_dump.sql';

async function extractSchema() {
    const client = new Client({ connectionString: OLD_DB_URL });
    await client.connect();

    console.log('[+] Connected to Old Database to extract schema...');
    let sqlDump = '-- Auto-generated schema dump from old Supabase\n\n';

    // Get all user tables
    const tablesRes = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  `);

    const tables = tablesRes.rows.map(r => r.table_name);
    console.log(`[+] Found ${tables.length} tables.`);

    for (const table of tables) {
        console.log(`  - Extracting schema for: ${table}`);

        // Get columns
        const columnsRes = await client.query(`
      SELECT column_name, data_type, character_maximum_length, column_default, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [table]);

        let tableDef = `CREATE TABLE IF NOT EXISTS public."${table}" (\n`;
        const colDefs = [];

        for (const col of columnsRes.rows) {
            let def = `  "${col.column_name}" ${col.data_type === 'USER-DEFINED' ? 'text' : col.data_type}`;

            if (col.character_maximum_length) {
                def += `(${col.character_maximum_length})`;
            }

            if (col.is_nullable === 'NO') {
                def += ` NOT NULL`;
            }

            if (col.column_default) {
                def += ` DEFAULT ${col.column_default}`;
            }

            colDefs.push(def);
        }

        tableDef += colDefs.join(',\n') + '\n);\n\n';
        sqlDump += tableDef;
    }

    // Get Primary Keys (simplified)
    const pkRes = await client.query(`
    SELECT tc.table_name, c.column_name
    FROM information_schema.table_constraints tc 
    JOIN information_schema.constraint_column_usage AS ccu USING (constraint_schema, constraint_name) 
    JOIN information_schema.columns AS c ON c.table_schema = tc.constraint_schema
      AND tc.table_name = c.table_name AND ccu.column_name = c.column_name
    WHERE constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public';
  `);

    if (pkRes.rows.length > 0) {
        const pkMap = {};
        for (const row of pkRes.rows) {
            if (!pkMap[row.table_name]) pkMap[row.table_name] = [];
            if (!pkMap[row.table_name].includes(row.column_name)) {
                pkMap[row.table_name].push(row.column_name);
            }
        }

        for (const [table, cols] of Object.entries(pkMap)) {
            sqlDump += `DO $$ BEGIN\n`;
            sqlDump += `  ALTER TABLE public."${table}" ADD PRIMARY KEY ("${cols.join('", "')}");\n`;
            sqlDump += `EXCEPTION WHEN invalid_table_definition THEN NULL; END $$;\n\n`; // ignore if exists
        }
    }

    fs.writeFileSync(OUTPUT_FILE, sqlDump);
    console.log(`[+] Schema saved to ${OUTPUT_FILE}`);
    await client.end();
}

extractSchema().catch(console.error);
