const fetch = require('node-fetch');

async function testSupabase() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error("Provide URL and KEY via NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars.");
        process.exit(1);
    }

    const res = await fetch(`${supabaseUrl}/rest/v1/cards?select=id,name&limit=3`, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
        }
    });

    const data = await res.json();
    console.log('Cards Response:', data);

    const history = await fetch(`${supabaseUrl}/rest/v1/snkrdunk_sales_history?select=*&limit=3&order=sold_at.desc`, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
        }
    });
    const historyData = await history.json();
    console.log('\nSnkrdunk History Response:', historyData);

    const snkrdunkCards = await fetch(`${supabaseUrl}/rest/v1/snkrdunk_cards?select=*&limit=3`, {
        headers: {
            'apikey': supabaseKey,
            'Authorization': `Bearer ${supabaseKey}`
        }
    });
    const scData = await snkrdunkCards.json();
    console.log('\nSnkrdunk Cards Response:', scData);
}

testSupabase();
