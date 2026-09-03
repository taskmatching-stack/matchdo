// 執行 docs/add-help-guides-draft-tree.sql（操作介紹草稿樹）
// 可重複執行：已存在的 slug 不覆蓋

const fs = require('fs');
const path = require('path');
require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const dbUrl = process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('[run-seed] 未設定 SUPABASE_DB_URL 或 DATABASE_URL。');
    process.exit(1);
  }

  const sqlPath = path.join(__dirname, '..', 'docs', 'add-help-guides-draft-tree.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });
  const client = await pool.connect();
  try {
    const pre = await client.query(
      `SELECT to_regclass('public.help_guide_pages') IS NOT NULL AS ok`
    );
    if (!pre.rows[0].ok) {
      console.error('[run-seed] 請先執行 migration help-guides（尚無 help_guide_pages）');
      process.exit(2);
    }
    await client.query(sql);
    const folders = await client.query(
      'SELECT slug, title, is_published FROM help_guide_folders ORDER BY sort_order, slug'
    );
    const pages = await client.query(
      `SELECT f.slug AS folder, p.slug, p.title, p.is_published
       FROM help_guide_pages p
       JOIN help_guide_folders f ON f.id = p.folder_id
       ORDER BY f.sort_order, p.sort_order, p.slug`
    );
    console.log('[run-seed] folders', folders.rowCount);
    folders.rows.forEach((r) => {
      console.log('  F', r.slug, r.title, 'published=' + r.is_published);
    });
    console.log('[run-seed] pages', pages.rowCount);
    pages.rows.forEach((r) => {
      console.log('  P /help/' + r.folder + '/' + r.slug, r.title, 'published=' + r.is_published);
    });
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error('[run-seed]', e.message || e);
  process.exit(1);
});
