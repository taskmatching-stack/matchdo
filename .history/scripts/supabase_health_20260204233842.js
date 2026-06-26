// Health check for Supabase and optional direct Postgres
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');

(async () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY;
  const dbUrl = process.env.SUPABASE_DB_URL;
  console.log('Env:', { SUPABASE_URL: !!url, SUPABASE_KEY: !!key, SUPABASE_DB_URL: !!dbUrl });

  // Supabase REST via supabase-js
  try {
    const supabase = createClient(url, key);
    const { data, error } = await supabase.from('ai_categories').select('key,name').limit(10);
    if (error) {
      console.log('Supabase REST error:', error.message);
    } else {
      console.log('Supabase REST ok, rows:', (data || []).length);
      console.log('Sample:', data);
    }
  } catch (e) {
    console.log('Supabase client exception:', e.message);
  }

  // Optional direct Postgres check
  if (dbUrl) {
    try {
      const pool = new Pool({ connectionString: dbUrl });
      const client = await pool.connect();
      const r = await client.query("select to_regclass('public.ai_categories') as exists, (select count(*) from public.ai_categories) as cnt");
      client.release();
      await pool.end();
      console.log('PG direct exists:', !!r.rows[0].exists, 'count:', r.rows[0].cnt);
    } catch (e) {
      console.log('PG direct error:', e.message);
    }
  }
})();
