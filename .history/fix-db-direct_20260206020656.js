
require('dotenv').config();
const { Pool } = require('pg');

// Using the IPv6 address directly to bypass DNS issues
const dbUrl = "postgresql://postgres:Qqasdfg!%403!!@[2406:da1c:f42:ae0e:50c9:b0:a495:895c]:6543/postgres?sslmode=require";

async function fixDatabase() {
    console.log('Connecting to database via IPv6...');
    const pool = new Pool({ connectionString: dbUrl });
    
    try {
        const client = await pool.connect();
        console.log('✅ Connected to database!');

        console.log('Adding missing columns to projects table...');
        await client.query(`
            -- 1. 新增 items 欄位儲存工項
            ALTER TABLE projects ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;
            
            -- 2. 新增 subcategory 欄位儲存子分類
            ALTER TABLE projects ADD COLUMN IF NOT EXISTS subcategory JSONB DEFAULT '[]'::jsonb;
            
            -- 3. 新增 analysis 欄位儲存 AI 原始分析
            ALTER TABLE projects ADD COLUMN IF NOT EXISTS analysis JSONB DEFAULT '{}'::jsonb;
            
            -- 4. 修正 status check constraint (如果需要)
            -- 這裡我們不隨便動 constraint 避免資料損毀，但確保 draft 是可用的
        `);
        console.log('✅ Database schema updated successfully!');

        client.release();
    } catch (e) {
        console.error('❌ Database Fix Failed:', e.message);
        console.log('\n--- SQL to run in Supabase SQL Editor ---');
        console.log(`
ALTER TABLE projects ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS subcategory JSONB DEFAULT '[]'::jsonb;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS analysis JSONB DEFAULT '{}'::jsonb;
        `);
    } finally {
        await pool.end();
    }
}

fixDatabase();
