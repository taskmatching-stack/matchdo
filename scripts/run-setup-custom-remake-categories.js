// 執行 docs/setup-custom-remake-categories-all.sql（訂製品 + 再製分類表與種子資料）
// 使用 SUPABASE_DB_URL 直連 Postgres，可重複執行

const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('[run-setup] 未設定 SUPABASE_DB_URL 或 DATABASE_URL。');
    console.error('請在 .env 設定 Supabase Postgres 連線字串後再執行。');
    process.exit(1);
  }

  const sqlPath = path.join(__dirname, '..', 'docs', 'setup-custom-remake-categories-all.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('[run-setup] 找不到 SQL 檔：', sqlPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();
  try {
    console.log('[run-setup] 開始執行 setup-custom-remake-categories-all.sql ...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('[run-setup] 執行完成。');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[run-setup] 錯誤：', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error('[run-setup] 未預期錯誤：', e);
  process.exit(1);
});
