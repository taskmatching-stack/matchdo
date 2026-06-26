// Apply schema and seed data to Supabase Postgres using ENV
// Supports connection via SUPABASE_DB_URL (postgres connection string)

const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.log('[db:init] 未偵測到資料庫連線字串（SUPABASE_DB_URL 或 DATABASE_URL）。');
    console.log('請在 Supabase 專案的 Database > Connection strings 取得 Postgres 連線字串，');
    console.log('然後在 .env 增加：SUPABASE_DB_URL=postgresql://<user>:<pass>@<host>:<port>/<db>?sslmode=require');
    console.log('你也可以直接將 db/schema.sql 與 db/seed.sql 貼到 Supabase SQL Editor 執行。');
    return;
  }

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  const schemaSql = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
  const seedSql = fs.readFileSync(path.join(__dirname, '..', 'db', 'seed.sql'), 'utf8');

  const client = await pool.connect();
  try {
    console.log('[db:init] 開始套用 schema...');
    await client.query('BEGIN');
    await client.query(schemaSql);
    await client.query('COMMIT');
    console.log('[db:init] schema 套用完成。');

    console.log('[db:init] 開始灑入 seed...');
    await client.query('BEGIN');
    await client.query(seedSql);
    await client.query('COMMIT');
    console.log('[db:init] seed 灑入完成。');

    console.log('[db:init] 全部完成 ✅');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[db:init] 發生錯誤，已回滾：', err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error('[db:init] 未預期錯誤：', e);
});
