const { Client } = require('pg');
const DB_URL = 'postgresql://postgres:C0u7n1e5%401210@db.bfiosxcsarekbvkjfdjr.supabase.co:5432/postgres';

async function main() {
    const client = new Client({ connectionString: DB_URL });
    await client.connect();
    console.log('[+] Connected');

    // Drop all CHECK constraints on the cards table
    const constraints = await client.query(`
    SELECT conname FROM pg_constraint 
    WHERE conrelid = 'public.cards'::regclass AND contype = 'c'
  `);
    console.log('CHECK constraints found:', constraints.rows.map(r => r.conname));

    for (const row of constraints.rows) {
        await client.query(`ALTER TABLE public.cards DROP CONSTRAINT "${row.conname}"`);
        console.log(`  [+] Dropped: ${row.conname}`);
    }

    // Also list all remaining constraints
    const allCons = await client.query(`
    SELECT conname, contype FROM pg_constraint 
    WHERE conrelid = 'public.cards'::regclass
  `);
    console.log('\nRemaining constraints:', allCons.rows.map(r => `${r.conname} (${r.contype})`));

    await client.end();
    console.log('[+] Done');
}

main().catch(e => console.error('Error:', e.message));
