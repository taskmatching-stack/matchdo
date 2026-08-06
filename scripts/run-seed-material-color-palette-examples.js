// 執行 docs/seed-material-color-palette-examples.sql（材料組合配色範例種子資料）
// 使用 SUPABASE_DB_URL 直連 Postgres，可重複執行（皆用 WHERE NOT EXISTS 去重）

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

  const sqlPath = path.join(__dirname, '..', 'docs', 'seed-material-color-palette-examples.sql');
  if (!fs.existsSync(sqlPath)) {
    console.error('[run-seed] 找不到 SQL 檔：', sqlPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(sqlPath, 'utf8');
  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  const client = await pool.connect();
  try {
    const pre = await client.query(
      `SELECT
         to_regclass('public.material_color_palette_types') IS NOT NULL AS types_table,
         to_regclass('public.material_color_palettes') IS NOT NULL AS palettes_table,
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='material_color_palettes' AND column_name='ratio_percents') AS has_ratio,
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='material_color_palettes' AND column_name='note') AS has_note,
         EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='material_color_palettes' AND column_name='name_en') AS has_i18n
      `
    );
    console.log('[run-seed] 前置檢查：', pre.rows[0]);
    const row = pre.rows[0];
    if (!row.types_table || !row.palettes_table || !row.has_ratio || !row.has_note || !row.has_i18n) {
      console.error('[run-seed] 缺少必要的表／欄位，請先執行 add-material-color-palettes.sql / add-material-color-palette-ratios.sql / add-material-color-palette-notes.sql / add-material-color-palette-i18n.sql');
      process.exit(1);
    }

    console.log('[run-seed] 開始執行 seed-material-color-palette-examples.sql ...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('[run-seed] 執行完成。');

    const typeCount = await client.query(`SELECT COUNT(*)::int AS n FROM public.material_color_palette_types`);
    const dualCount = await client.query(`SELECT COUNT(*)::int AS n FROM public.material_color_palettes WHERE owner_scope='platform' AND color_count=2`);
    const triCount = await client.query(`SELECT COUNT(*)::int AS n FROM public.material_color_palettes WHERE owner_scope='platform' AND color_count=3`);
    console.log('[run-seed] 目前總數：types=', typeCount.rows[0].n, ' dual=', dualCount.rows[0].n, ' tri=', triCount.rows[0].n);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[run-seed] 錯誤：', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error('[run-seed] 未預期錯誤：', e);
  process.exit(1);
});
