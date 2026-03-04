async function testApi() {
    console.log('Testing PC Search...');
    try {
        const res = await fetch('https://toreca-app-staging.vercel.app/api/overseas-prices/search?q=pikachu');
        const text = await res.text();
        console.log('Status PC Search:', res.status);
        console.log('Response:', text.substring(0, 500));
    } catch (e) {
        console.error('Error PC search:', e);
    }

    console.log('\nTesting PC Registration (Empty)...');
    try {
        const res = await fetch('https://toreca-app-staging.vercel.app/api/overseas-prices/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({})
        });
        const text = await res.text();
        console.log('Status PC Update:', res.status);
        console.log('Response:', text.substring(0, 500));
    } catch (e) {
        console.error('Error PC update:', e);
    }
}

testApi();
