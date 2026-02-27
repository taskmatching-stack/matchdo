// 資料庫連線測試腳本
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');

console.log('=== Supabase 連線測試 ===\n');

// 1. 檢查環境變數
console.log('📋 環境變數檢查:');
console.log(`SUPABASE_URL: ${process.env.SUPABASE_URL ? '✓ 已設定' : '✗ 未設定'}`);
console.log(`SUPABASE_KEY: ${process.env.SUPABASE_KEY ? '✓ 已設定 (長度: ' + process.env.SUPABASE_KEY.length + ')' : '✗ 未設定'}`);
console.log(`SUPABASE_DB_URL: ${process.env.SUPABASE_DB_URL ? '✓ 已設定' : '✗ 未設定'}`);
console.log('');

// 2. 測試 Supabase REST API
async function testSupabaseREST() {
    console.log('🔌 測試 Supabase REST API...');
    try {
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_KEY
        );
        
        const { data, error } = await supabase
            .from('ai_categories')
            .select('key, name')
            .limit(1);
        
        if (error) {
            console.log(`✗ REST API 失敗: ${error.message}`);
            return false;
        } else {
            console.log(`✓ REST API 正常 (回傳 ${data ? data.length : 0} 筆資料)`);
            if (data && data.length > 0) {
                console.log(`  範例: ${JSON.stringify(data[0])}`);
            }
            return true;
        }
    } catch (e) {
        console.log(`✗ REST API 例外: ${e.message}`);
        return false;
    }
}

// 3. 測試直連 PostgreSQL
async function testDirectDB() {
    console.log('\n🔌 測試直連 PostgreSQL...');
    if (!process.env.SUPABASE_DB_URL) {
        console.log('✗ 未設定 SUPABASE_DB_URL');
        return false;
    }
    
    try {
        const pool = new Pool({ connectionString: process.env.SUPABASE_DB_URL });
        const client = await pool.connect();
        
        const result = await client.query('SELECT key, name FROM public.ai_categories LIMIT 1');
        client.release();
        await pool.end();
        
        console.log(`✓ 直連成功 (回傳 ${result.rows.length} 筆資料)`);
        if (result.rows.length > 0) {
            console.log(`  範例: ${JSON.stringify(result.rows[0])}`);
        }
        return true;
    } catch (e) {
        console.log(`✗ 直連失敗: ${e.message}`);
        if (e.message.includes('ENOTFOUND')) {
            console.log('  提示: DNS 解析失敗，網路連線可能有問題');
        } else if (e.message.includes('password')) {
            console.log('  提示: 密碼驗證失敗，請檢查 SUPABASE_DB_URL');
        }
        return false;
    }
}

// 4. 測試表格是否存在
async function testTableExists() {
    console.log('\n🔌 測試表格是否存在...');
    try {
        const supabase = createClient(
            process.env.SUPABASE_URL,
            process.env.SUPABASE_KEY
        );
        
        const { data, error } = await supabase
            .from('ai_categories')
            .select('count')
            .limit(0);
        
        if (error) {
            if (error.message.includes('schema cache')) {
                console.log('✗ 表格未在 PostgREST 快取中（需在 SQL Editor 執行 ALTER 刷新）');
            } else {
                console.log(`✗ 表格檢測失敗: ${error.message}`);
            }
            return false;
        } else {
            console.log('✓ 表格存在且可透過 REST API 存取');
            return true;
        }
    } catch (e) {
        console.log(`✗ 表格檢測例外: ${e.message}`);
        return false;
    }
}

// 執行所有測試
async function runAllTests() {
    const restOK = await testSupabaseREST();
    const tableOK = await testTableExists();
    const dbOK = await testDirectDB();
    
    console.log('\n=== 測試結果總結 ===');
    console.log(`REST API: ${restOK ? '✓ 正常' : '✗ 異常'}`);
    console.log(`表格狀態: ${tableOK ? '✓ 正常' : '✗ 異常'}`);
    console.log(`直連 DB: ${dbOK ? '✓ 正常' : '✗ 異常'}`);
    
    console.log('\n📝 建議處理步驟:');
    if (!restOK && !dbOK) {
        console.log('1. 檢查 .env 檔案的 SUPABASE_URL 和 SUPABASE_KEY 是否正確');
        console.log('2. 確認 Supabase 專案是否暫停或刪除');
        console.log('3. 檢查網路連線是否正常');
    } else if (!tableOK) {
        console.log('1. 開啟 Supabase SQL Editor');
        console.log('2. 執行: CREATE TABLE IF NOT EXISTS public.ai_categories (...)');
        console.log("3. 執行: ALTER TABLE public.ai_categories ALTER COLUMN prompt SET DEFAULT '';");
        console.log('4. 重新執行此測試腳本');
    } else {
        console.log('✓ 資料庫連線正常！可開始使用。');
    }
    
    process.exit(restOK || dbOK ? 0 : 1);
}

runAllTests().catch(console.error);
