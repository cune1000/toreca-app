const { Client } = require('pg');

const oldUrl = 'postgresql://postgres:C0u7n1e5%401210@db.slouyljgiytgytyegyde.supabase.co:5432/postgres';

async function test() {
    const client = new Client({ connectionString: oldUrl });
    try {
        await client.connect();
        console.log('Connected to OLD Database Successfully!');
    } catch (err) {
        console.error('Connection error', err.message);
    } finally {
        await client.end();
    }
}

test();
