/**
 * 媒體牆：為 custom_products 加上 show_on_homepage 欄位
 * 使用方式：node scripts/run-add-show-on-homepage.js
 * 需在專案根目錄執行，且 .env 已設定 SUPABASE_DB_URL
 */
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { Pool } = require('pg');

const sqlPath = path.join(__dirname, '..', 'docs', 'add-custom-products-show-on-homepage.sql');

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    console.error('請在 .env 設定 SUPABASE_DB_URL（Supabase Database > Connection string）。');
    process.exit(1);
  }
  if (!fs.existsSync(sqlPath)) {
    console.error('找不到 SQL 檔：', sqlPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');
  const pool = new Pool({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('已成功加入 show_on_homepage 欄位，媒體牆 API 可正常運作。');
  } catch (err) {
    console.error('執行失敗：', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
