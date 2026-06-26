// Import default categories using supabase-js (no server needed)
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { Pool } = require('pg');

(async () => {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY; // prefer service role
  const dbUrl = process.env.SUPABASE_DB_URL;
  const filePath = path.join(__dirname, '..', 'public', 'config', 'default-categories.json');
  if (!fs.existsSync(filePath)) {
    console.error('Default categories file not found:', filePath);
    process.exit(1);
  }
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  const list = Array.isArray(raw.categories) ? raw.categories : [];
  if (!list.length) {
    console.error('No categories in default-categories.json');
    process.exit(1);
  }
  const payload = list.map(c => ({
    key: c.key,
    name: c.name,
    prompt: c.prompt || '',
    subcategories: Array.isArray(c.sub) ? c.sub : []
  }));

  // Try supabase upsert first
  try {
    const supabase = createClient(url, key);
    const { data, error } = await supabase.from('ai_categories').upsert(payload);
    if (error) {
      console.log('Supabase upsert error:', error.message);
      // Try PG direct fallback only if DB URL provided
      if (dbUrl) {
        try {
          const pool = new Pool({ connectionString: dbUrl });
          const client = await pool.connect();
          await client.query(`create table if not exists public.ai_categories (
            key text primary key,
            name text not null,
            prompt text not null default '',
            subcategories jsonb not null default '[]'::jsonb,
            updated_at timestamptz not null default now()
          );`);
          for (const c of list) {
            await client.query(
              'insert into public.ai_categories(key, name, prompt, subcategories) values($1, $2, $3, $4) on conflict (key) do update set name=excluded.name, prompt=excluded.prompt, subcategories=excluded.subcategories',
              [c.key, c.name, c.prompt || '', JSON.stringify(Array.isArray(c.sub) ? c.sub : [])]
            );
          }
          client.release();
          await pool.end();
          console.log('Imported via PG direct:', list.length);
          process.exit(0);
        } catch (e2) {
          console.error('PG direct import error:', e2.message);
          process.exit(1);
        }
      } else {
        process.exit(1);
      }
    } else {
      console.log('Imported via Supabase REST:', (data || payload).length);
      process.exit(0);
    }
  } catch (e) {
    console.error('Supabase client exception:', e.message);
    process.exit(1);
  }
})();
