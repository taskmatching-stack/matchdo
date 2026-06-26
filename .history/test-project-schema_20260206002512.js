
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// 使用 server.js 相同的環境變數配置
const supabaseUrl = process.env.SUPABASE_URL;
// 這裡我們刻意使用 SUPABASE_KEY (通常是 anon key) 來模擬前端使用者的行為
// 如果 server 端有 service_role key，我們會優先測試權限最嚴格的情況
const supabaseKey = process.env.SUPABASE_KEY; 

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Missing SUPABASE_URL or SUPABASE_KEY in .env');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testProjectInsert() {
    console.log('--- Starting Project Insert Test ---');

    // 1. 模擬一個已登入的使用者 ID
    // 為了測試真實性，我們需要一個真實存在的 user id，或者我們嘗試用 service role key 繞過 auth
    // 為了不依賴特定用戶，我們先用 Service Role Key 來確認 Schema 正確性
    // 如果 Schema 正確，但前端失敗，那就是 RLS 問題
    
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY; // Fallback to anon key if service role is missing
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey);

    // 模擬前端傳送的 payload
    const testPayload = {
        title: 'Test Project - Schema Validation',
        description: JSON.stringify({ prompt: 'test prompt', source: 'simulation', items: [] }),
        status: 'editing',
        // 這裡需要一個有效的 UUID，我們先生成一個隨機的，
        // 注意：如果是 RLS，隨機 UUID 可能會被擋，但用 Service Role 應該沒問題
        owner_id: '00000000-0000-0000-0000-000000000000', 
        analysis: { items: [{ item_name: 'Test Item', quantity: 1 }] }
    };

    console.log('Payload:', JSON.stringify(testPayload, null, 2));

    try {
        const { data, error } = await adminSupabase
            .from('projects')
            .insert(testPayload)
            .select()
            .single();

        if (error) {
            console.error('❌ Insert Failed:', error);
            console.error('Error Code:', error.code);
            console.error('Error Message:', error.message);
            console.error('Error Details:', error.details);
            console.error('Hint:', error.hint);
        } else {
            console.log('✅ Insert Successful!');
            console.log('Created Project ID:', data.id);
            
            // Clean up
            await adminSupabase.from('projects').delete().eq('id', data.id);
            console.log('🧹 Test data cleaned up.');
        }

    } catch (e) {
        console.error('Unexpected Error:', e);
    }
}

testProjectInsert();
