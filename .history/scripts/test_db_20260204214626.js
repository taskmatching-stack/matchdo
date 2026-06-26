require('dotenv').config();
const { Pool } = require('pg');

async function test() {
  const url = process.env.SUPABASE_DB_URL;
  if (!url) {
    console.error('[db:test] 缺少 SUPABASE_DB_URL');
    process.exit(1);
  }
  console.log('[db:test] 連線字串：', url.replace(/:(password=)?([^@:]+)@/, ':***@'));
  const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  try {
    const client = await pool.connect();
    const res = await client.query('select now() as now, version()');
    console.log('[db:test] 連線成功 ✅');
    console.log(res.rows[0]);
    client.release();
  } catch (err) {
    console.error('[db:test] 連線失敗：', err.message);
    console.error('提示：若看到 ENOTFOUND 或 IPv4 提示，請到 Supabase Settings → Database → Connection strings，改用 Session pooler 的 URI（port 6543）。');
  } finally {
    await pool.end();
  }
}

test();
