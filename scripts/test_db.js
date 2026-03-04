const { Client } = require('pg');

const client = new Client({
    connectionString: 'postgresql://postgres:C0u7n1e5%401210@db.bfiosxcsarekbvkjfdjr.supabase.co:5432/postgres'
});

async function test() {
    try {
        await client.connect();
        console.log('Connected to Staging Database Successfully!');
        const res = await client.query('SELECT NOW()');
        console.log(res.rows[0]);
    } catch (err) {
        console.error('Connection error', err.stack);
    } finally {
        await client.end();
    }
}

test();
