import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// .env.local から環境変数を簡易読み込み
const envPath = path.resolve('.env.local');
let supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
let supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach(line => {
        const [key, val] = line.split('=');
        if (key && val) {
            if (key.trim() === 'NEXT_PUBLIC_SUPABASE_URL') supabaseUrl = val.trim().replace(/"/g, '');
            if (key.trim() === 'NEXT_PUBLIC_SUPABASE_ANON_KEY') supabaseKey = val.trim().replace(/"/g, '');
        }
    });
}

if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase credentials not found');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkData() {
    console.log('Checking recent data...');

    // 直近のデータを取得（作成日時順）
    // created_at がない場合は sold_at で代用するかもしれないが、通常はあるはず
    const { data, error } = await supabase
        .from('snkrdunk_sales_history')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error('Error fetching recent data:', error);
    } else {
        console.log('\nLatest 10 records:');
        data.forEach(record => {
            console.log(`[Created: ${record.created_at}] ID: ${record.id}, Grade: ${record.grade}, Price: ${record.price}`);
        });
    }

    // "個"を含むデータがあるか確認
    const { data: boxData, error: boxError } = await supabase
        .from('snkrdunk_sales_history')
        .select('*')
        .like('grade', '%個%')
        .order('created_at', { ascending: false })
        .limit(10);

    if (boxError) {
        console.error('Box Error:', boxError);
    } else {
        console.log('\n--- BOX Data (contains "個") ---');
        if (!boxData || boxData.length === 0) {
            console.log('No BOX data found.');
        } else {
            boxData.forEach(record => {
                console.log(`[Created: ${record.created_at}] Grade: ${record.grade}, Price: ${record.price}, ScrapedAt: ${record.created_at}`);
            });
        }
    }
}

checkData();
